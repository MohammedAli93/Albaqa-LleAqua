# 06 — State Management Architecture

Two distinct concerns: **server-authoritative game state** (the truth) and
**client UI state** (projections + ephemeral interaction state). They are designed
separately and connected only through the WS contract (doc 05).

## 1. Principle: the server is the only source of truth

Clients hold a *cache* of server state plus their own UI state. They render from
that cache and send intents. They never compute scores, eliminations, correctness,
or timers as facts — only as optimistic guesses that the next server message
confirms or overrides. This is what makes the game fair and reconnection-safe.

## 2. Server-side game state

### 2.1 The Game FSM (finite state machine)

```
            ┌──────────────────────── ABANDONED ◀───── (host gone past grace,
            │                                            or empty room TTL)
            ▼
  ┌──────┐ game:start  ┌────────┐
  │LOBBY │────────────▶│ ACTIVE │
  └──────┘             └───┬────┘
                           │ enter round
                           ▼
                   ┌──────────────┐  all answered / timer=0  ┌────────┐
                   │  COLLECTING  │─────────────────────────▶│ LOCKED │
                   └──────────────┘                          └───┬────┘
                           ▲                                     │ resolve
                           │ next round                          ▼
                   ┌──────────────┐    ◀──────────────── ┌──────────────┐
                   │ INTERMISSION │                       │  RESOLVING   │
                   └──────┬───────┘                       └──────────────┘
                          │ winner condition
                          ▼
                    ┌───────────┐
                    │ COMPLETED │
                    └───────────┘
   PAUSED is an orthogonal overlay enterable from ACTIVE/COLLECTING/INTERMISSION;
   it freezes the timer and stores remaining time, restored on resume.
```

The FSM is implemented as a **pure module** in `domain/game/fsm.ts`: given
`(state, event, context)` it returns `{ nextState, sideEffects[] }`. Side effects
(emit X, persist Y, schedule timer Z) are *described*, not executed, inside the
FSM — the realtime layer interprets them. This keeps the engine deterministic and
unit-testable with zero sockets.

### 2.2 Where game state lives

| Data | Store | Lifetime |
|------|-------|----------|
| Authoritative live room (participants, scores, current round, phase, timers) | **Redis** hash `room:<gameId>` | Until game end + 2h TTL |
| Per-round answers (in flight) | **Redis** `round:<roundId>:answers` | Until resolved → flushed to PG |
| Room code → gameId index | **Redis** `code:<roomCode>` | While live |
| Presence / disconnect grace timers | **Redis** keys w/ TTL | Ephemeral |
| Mutation lock | **Redis** `lock:room:<gameId>` (SETNX) | Per critical section |
| Finished game, rounds, answers, results | **PostgreSQL** | Durable |

Redis is the **hot path**; Postgres is the **system of record for outcomes**.
Writing every tick to Postgres would not scale; writing nothing durable would lose
analytics. So: live in Redis, flush milestones (round resolved, game completed) to
Postgres.

### 2.3 Authority, locks, and races

The dangerous race is **double resolution** (timer fires *and* last answer arrives
simultaneously). Guard:

```
resolveRound(roundId):
  acquired = redis SET lock:room:<gid> <token> NX PX 5000
  if not acquired: return            // someone else is resolving
  if round.phase != COLLECTING: release; return   // already resolved
  ... compute, persist, emit, advance FSM ...
  redis DEL lock (only if token matches)
```

Combined with the Postgres `Answer @@unique([roundId, participantId])`, every
answer is counted exactly once and every round resolves exactly once.

### 2.4 Timers

A single **timer scheduler** per instance holds in-memory timeouts keyed by
`roundEndsAt` (an absolute epoch ms stored in Redis). On instance restart, the
scheduler rehydrates from Redis: for each live room with a COLLECTING round it
re-arms a timeout for `max(0, endsAt - now)`. Because `endsAt` is absolute and
authoritative, a restart or failover never desyncs the countdown.

## 3. Client-side state (Zustand)

Each app has small, focused stores. Zustand chosen for: no provider boilerplate,
selector-based subscriptions (a timer update re-renders only the countdown, not the
whole tree), and transient updates for high-frequency data.

### 3.1 Main Screen (`apps/screen`)
- `connectionStore` — socket status, reconnect state.
- `roomStore` — `RoomSnapshot`: participants, leaderboard, mode, settings.
- `roundStore` — current question, phase, `endsAt`, live answer count, distribution.
- `sceneStore` — UI orchestration: which full-screen scene is active, transition
  flags (so Framer Motion can run enter/exit sequences cleanly).

### 3.2 Mobile Controller (`apps/controller`)
- `sessionStore` — `{ roomCode, participantId, sessionToken, nickname, avatarId }`,
  persisted to `localStorage` for reconnection across refreshes/lock-screen.
- `gameStore` — phase, current question (no correct answer), my status/score/lives,
  `hasAnswered`, last result.
- `uiStore` — selected option (optimistic), haptic/animation flags.

### 3.3 Admin (`apps/admin`)
- Server cache via **TanStack Query** (questions, packages, analytics) — caching,
  pagination, optimistic mutations, background refetch.
- `authStore` (Zustand) — access token in memory (never localStorage), user/role.
- `uiStore` — table filters, selection, modal state.

## 4. The sync model

```
                server authoritative state (Redis/FSM)
                              │  emits via WS contract
                              ▼
   client socket layer  →  reducer maps event → store mutation
                              │
                              ▼
                      Zustand store (cache)
                              │  selectors
                              ▼
                      React components (render)
                              ▲
                  user action → intent (ack) ─┘ optimistic update, reconciled by next fact
```

Rules:
1. **One reducer surface.** Each app has a single `applyServerEvent(event)` that
   maps WS events to store mutations — the only place server data enters state.
2. **`room:state` is a hard reset.** On connect/reconnect the snapshot *replaces*
   cached game state, healing any drift from missed events.
3. **Optimistic, then reconciled.** Controller marks an option "locked in"
   instantly; `answer:result` confirms score/lives. If the ack says `accepted:
   false` (e.g., window closed), the optimistic lock is rolled back.
4. **Derived, not stored.** Ranks, deltas, and "am I winning" are computed in
   selectors from the leaderboard, not duplicated in state.

## 5. Recovery scenarios → state outcome

| Scenario | Mechanism | Player-visible result |
|----------|-----------|-----------------------|
| Controller refresh / lock screen | `sessionStore` persisted → auto reconnect → `room:state` | Seamlessly back in, current question restored. |
| Brief network drop mid-question | Socket.IO reconnect within grace → snapshot, can still answer if window open | "Reconnecting…" toast, then resume. |
| Host (screen) drop | Room PAUSED, players see "host reconnecting"; resume on return | Game freezes, no progress lost. |
| Server instance crash | Reconnect to healthy instance, state from Redis, timer rehydrated | Countdown continues from correct remaining time. |
| Redis unavailable | Room PAUSED (fail-safe) until Redis returns | Temporary pause rather than corrupted scores. |

## 6. Consistency guarantees (summary)

- **Exactly-once answer counting** — Redis lock + PG unique constraint.
- **Exactly-once round resolution** — phase check under lock.
- **Monotonic scores** — only the resolver mutates score, under lock.
- **Snapshot convergence** — any client can fully rebuild from `room:state`.
- **Timer determinism** — absolute `endsAt`, rehydratable, host-pause aware.
