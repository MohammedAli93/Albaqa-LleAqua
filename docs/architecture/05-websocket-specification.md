# 05 — WebSocket Event Specification

Socket.IO over `wss://`. This is the contract for the live game. All event names
and payload schemas live in `packages/shared/events.ts` (Zod) and are imported by
both server and clients — a typo or shape change is a compile error, not a
production incident.

## 1. Namespaces

| Namespace | Who connects | Purpose |
|-----------|--------------|---------|
| `/screen` | Main Screen (host) | Receives full room projection; sends host control intents. |
| `/play` | Mobile Controllers | One per player; sends join/answer intents; receives personal + shared state. |
| `/admin` | Admin Dashboard (optional live) | Live ops feed: active rooms, moderation. Read-mostly. |

Within a namespace, every connection for a game joins the Socket.IO **room**
`game:<gameId>`. Personal messages target the individual `socket.id`.

## 2. Connection handshake & auth

Socket auth happens in a namespace middleware **before** any event is processed.

```
client connects with auth payload:
  /screen : { hostToken, roomCode }
  /play   : { roomCode, sessionToken? }   // sessionToken present on reconnect
  /admin  : { accessToken }               // JWT

server middleware:
  1 resolve gameId from roomCode (Redis); reject UNKNOWN_ROOM if absent
  2 /screen : verify hostToken hash matches room.hostToken → attach {role:host}
    /play   : if sessionToken → rebind to existing participant (reconnect)
              else → provisional connection awaiting player:join
    /admin  : verify JWT + role≥VIEWER
  3 attach context to socket.data; join game:<gameId> room
  4 enforce per-namespace connection rate limit (doc 08)
```

Tokens are **opaque, single-purpose, short-lived**. `hostToken`/`sessionToken`
are random 256-bit secrets; the server stores only their hash. A socket token is
useless outside its room.

## 3. Naming & direction conventions

- Events are `domain:verb` lowercase, e.g. `player:join`, `question:reveal`.
- **C→S = intents** (imperative, may be rejected). **S→C = facts/notifications**
  (past tense or noun-state), e.g. `player:joined`, `score:update`.
- Every C→S intent receives an **ack callback** `(response) => void` with
  `{ ok: true, data } | { ok: false, error }` — never fire-and-forget for intents.

## 4. Client → Server intents

### `/play`

| Event | Payload (Zod) | Ack data | Notes |
|-------|---------------|----------|-------|
| `player:join` | `{ nickname: string(2..20), avatarId: string }` | `{ participantId, sessionToken }` | Rejected if room not LOBBY, nickname taken, room full, or banned word. `sessionToken` is the reconnect secret. |
| `player:answer` | `{ roundId, optionId, clientTs }` | `{ accepted: boolean, lockedAt }` | Only valid in COLLECTING for current round. Idempotent: a second submit for same round returns the first result. Score withheld. |
| `player:heartbeat` | `{}` | `{ serverTs }` | Lightweight liveness + clock-sync hint. Every 10s. |
| `player:leave` | `{}` | `{ ok }` | Graceful exit; frees nickname. |

### `/screen` (host)

| Event | Payload | Ack | Notes |
|-------|---------|-----|-------|
| `game:start` | `{}` | `{ ok }` | Host-only; LOBBY→ACTIVE; requires ≥ minPlayers. |
| `round:next` | `{}` | `{ ok }` | Advance after reveal/intermission (auto-advance also supported). |
| `game:pause` / `game:resume` | `{}` | `{ ok }` | Host control; freezes timers. |
| `player:kick` | `{ participantId }` | `{ ok }` | Moderation; removes a player. |
| `game:end` | `{}` | `{ ok }` | Force end → resolves winner from current standings. |

### `/admin`

| Event | Payload | Notes |
|-------|---------|-------|
| `admin:subscribe` | `{}` | Stream of active-room summaries. |
| `admin:room:terminate` | `{ gameId }` | ADMIN+ only; kills a room (abuse). |

## 5. Server → Client events

Shared to room (`game:<gameId>`) unless marked **personal**.

| Event | Payload | Audience | When |
|-------|---------|----------|------|
| `room:state` | full `RoomSnapshot` (see §7) | personal, on connect/reconnect | Sync source of truth. |
| `player:joined` | `{ participant: PublicParticipant, playerCount }` | room | New player accepted. |
| `player:left` | `{ participantId, playerCount }` | room | Leave/kick/disconnect-timeout. |
| `player:reconnected` | `{ participantId }` | room | Player came back within grace. |
| `game:started` | `{ totalRounds, mode, settings }` | room | Host started. |
| `question:show` | `{ round, question: PublicQuestion, endsAt }` | room | New round begins; `PublicQuestion` has **no** `correctOptionId`. |
| `timer:tick` | `{ roundId, remainingMs }` | room | Server-driven, ~4/sec; client interpolates between for 60fps. |
| `answer:received` | `{ answeredCount, totalActive }` | room | Live answer count (no identities, no choices) for the answer-viz. |
| `answer:locked` | `{ roundId }` | room | Collection window closed. |
| `question:reveal` | `{ roundId, correctOptionId, distribution: {optionId:count}, explanation? }` | room | Correct answer + how everyone answered. |
| `answer:result` | `{ roundId, isCorrect, pointsAwarded, newScore, livesLeft }` | **personal** | Each player's own outcome. |
| `score:update` | `{ leaderboard: RankedEntry[] }` | room | Post-resolution standings. |
| `player:eliminated` | `{ participantIds: string[], round }` | room | Drives elimination animation. |
| `you:eliminated` | `{ finalRank, finalScore }` | **personal** | Player learns they're out. |
| `round:completed` | `{ roundIndex, nextInMs? }` | room | Intermission → next. |
| `game:paused` / `game:resumed` | `{ reason }` | room | Host paused or host/Redis recovery. |
| `game:completed` | `{ winner: PublicParticipant|Team, finalLeaderboard, stats }` | room | Triggers winner celebration. |
| `error` | `{ code, message }` | personal | Out-of-band error (e.g., forced disconnect reason). |

## 6. Round lifecycle (authoritative timeline)

```
ACTIVE
  └─ for each round:
     question:show  (endsAt = now + timeLimit)         state: COLLECTING
        ├─ players send player:answer  → answer:received (count) per submit
        ├─ timer:tick × N
        └─ stop when (all active answered) OR (now ≥ endsAt)
     answer:locked                                       state: LOCKED
        └─ server computes results from stored serverTs + correctness
     question:reveal + answer:result(personal) +         state: RESOLVING
        score:update + player:eliminated/you:eliminated
     round:completed (intermission)                      state: INTERMISSION
        └─ host round:next OR auto-advance after intermissionMs
  └─ when winner condition met → game:completed          state: COMPLETED
```

## 7. Core payload types (in `packages/shared`)

```ts
PublicParticipant = {
  id: string; nickname: string; avatarId: string;
  status: 'ACTIVE'|'ELIMINATED'|'DISCONNECTED'|'WINNER';
  score: number; lives: number; teamId?: string;
}

PublicQuestion = {
  id: string; type: QuestionType; difficulty: Difficulty;
  promptAr: string; promptEn?: string;
  options: { id: string; textAr: string; textEn?: string; mediaUrl?: string }[];
  promptMediaUrl?: string;
  // NOTE: correctOptionId intentionally absent until question:reveal
}

RankedEntry = { participantId: string; nickname: string; avatarId: string;
                rank: number; score: number; delta: number; status: string }

RoomSnapshot = {
  game: { id; roomCode; mode; status; round: number; totalRounds };
  settings: GameSettings;
  participants: PublicParticipant[];
  teams?: TeamPublic[];
  currentRound?: { roundId; question: PublicQuestion; endsAt: number; phase };
  leaderboard: RankedEntry[];
  self?: { participantId; status; score; lives; hasAnswered };  // /play only
}
```

## 8. Validation

1. **Schema validation** — every inbound payload parsed by its Zod schema; failure
   → ack `{ ok:false, error:{ code:'VALIDATION_ERROR' } }`, event dropped, counter
   incremented (anti-abuse).
2. **State-guard validation** — the FSM rejects intents illegal for the current
   state (e.g., `player:answer` outside COLLECTING) → `INVALID_STATE`.
3. **Authorization validation** — host-only events check `socket.data.role`;
   answer events check the socket owns the participant.
4. **Semantic validation** — `optionId` must belong to the round's question;
   `roundId` must equal the active round.

## 9. Error handling

### Error codes (WS, shared with REST where overlapping)
`UNKNOWN_ROOM` · `ROOM_FULL` · `NICKNAME_TAKEN` · `INVALID_STATE` ·
`NOT_AUTHORIZED` · `DUPLICATE_ANSWER` · `VALIDATION_ERROR` · `RATE_LIMITED` ·
`ROOM_CLOSED` · `INTERNAL`.

### Principles
- **Acks carry errors** for intents the client initiated; the `error` event is
  only for unsolicited/forced conditions.
- **Errors never crash the namespace** — every handler is wrapped so a thrown
  error becomes a structured ack + Sentry capture, not a dropped socket.
- **No silent failures** — a rejected answer always tells the player why so the UI
  can show "answers locked" vs "already answered".
- **Idempotency over rejection** where natural — a duplicate `player:answer`
  returns the original result rather than an error, so a double-tap is harmless.

## 10. Reconnection protocol

```
disconnect (network drop)
  /play socket gone → participant.status = DISCONNECTED, grace timer (e.g. 45s)
  room broadcasts player:left only after grace expires

client auto-reconnect (Socket.IO) with stored {roomCode, sessionToken}
  → middleware rebinds socket to participant
  → server emits room:state (full snapshot) personally
  → broadcasts player:reconnected
  → if a round is COLLECTING and player hasn't answered, they may still answer
    within the remaining window (server clamps to endsAt)
```

Clock handling: the client never trusts its own wall clock for fairness. The
server stamps `serverTs` on every answer; `timer:tick.remainingMs` plus local
interpolation drives the smooth countdown, periodically re-synced to server ticks.

## 11. Throughput & batching

- `timer:tick` emitted at ~4 Hz (not per frame) — the client tweens to 60 fps.
- `answer:received` is coalesced: at most one emit per 100 ms carrying the latest
  count, so 100 simultaneous answers cause ≤ 10 broadcasts, not 100.
- Large one-time payloads (`room:state`) are personal and compressed
  (`perMessageDeflate`) ; high-frequency small ones skip compression overhead.
