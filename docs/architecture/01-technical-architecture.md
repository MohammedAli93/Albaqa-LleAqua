# 01 — Technical Architecture

## 1. Architectural style

- **Monorepo** (pnpm workspaces) containing three React clients, one Node
  backend, and shared packages. Single source of truth for the socket/REST
  contracts — the #1 source of bugs in real-time apps is client/server drift, so
  the contract lives in `packages/shared` and is imported by both sides.
- **Modular monolith backend**, not microservices. At MVP scale a single
  deployable with clean internal module boundaries (auth, rooms, game, content,
  media, payments, analytics) is faster, cheaper, and easier to reason about.
  Boundaries are drawn so a module can later be extracted (esp. `game` realtime).
- **Server-authoritative realtime.** The server owns all game truth. Clients send
  *intents* (`answer:submit`), never *facts* (`score = 100`). See doc 06.

## 2. Component map

```
┌─────────────────────────────────────────────────────────────────────┐
│ CLIENTS (browser)                                                     │
│  apps/screen      apps/controller     apps/admin                      │
│  React+Vite       React+Vite          React+Vite                      │
│  Zustand          Zustand             Zustand + React Query           │
│  Framer Motion    Framer Motion       TanStack Table                  │
│        │                │                   │                         │
└────────┼────────────────┼───────────────────┼─────────────────────────┘
   WS /screen        WS /play           HTTPS REST /api/admin
   HTTPS REST        HTTPS REST                │
         └──────────────┴───────────┬──────────┘
┌────────────────────────────────────▼────────────────────────────────┐
│ BACKEND  apps/server (Node + Express + Socket.IO + TypeScript)        │
│                                                                       │
│  HTTP layer            Realtime layer           Cross-cutting         │
│  ─────────             ──────────────           ────────────          │
│  • REST routers        • Socket.IO namespaces   • Auth (JWT)          │
│  • Zod validation      • Room registry          • Rate limiter        │
│  • Controllers         • Game FSM engine        • Audit logger        │
│  • Error envelope      • Tick/timer scheduler    • Telemetry (OTel)   │
│                        • Redis pub/sub adapter   • Config loader      │
│                                                                       │
│  Domain modules: auth · rooms · game · content · media · payments ·   │
│                  analytics · users                                    │
│                                                                       │
│  Data access: Prisma Client (Postgres) · ioredis (Redis) · S3 SDK     │
└───────┬───────────────────────┬──────────────────────┬───────────────┘
        │                       │                       │
 ┌──────▼──────┐        ┌───────▼──────┐        ┌───────▼────────┐
 │ PostgreSQL  │        │    Redis     │        │ S3-compatible  │
 │ (Prisma)    │        │ adapter +    │        │ object storage │
 │ durable     │        │ ephemeral    │        │ media assets   │
 │ content,    │        │ game state,  │        │ images/audio/  │
 │ users,      │        │ rate limits, │        │ video          │
 │ results     │        │ presence     │        │                │
 └─────────────┘        └──────────────┘        └────────────────┘
        external: Sentry · OpenTelemetry collector · payment providers
```

## 3. Technology choices & rationale

| Concern | Choice | Why |
|---------|--------|-----|
| Language | **TypeScript** everywhere | One language, shared types across the wire. |
| Client framework | **React + Vite** | Mandated; fast HMR, small prod bundles, per-app builds. |
| Client animation | **Framer Motion** | Declarative, layout animations, gesture support — core to the TV feel. |
| Client styling | **TailwindCSS** | Token-driven, RTL plugin, tiny runtime, consistent across 3 apps. |
| Client state | **Zustand** | Minimal, no boilerplate, transient updates (timers) without re-render storms. |
| Server data fetching (admin) | **TanStack Query** | Caching, mutations, optimistic UI for the dashboard. |
| Backend | **Node + Express** | Mandated; mature, huge ecosystem, simple middleware model. |
| Realtime | **Socket.IO** | Mandated; rooms, namespaces, auto-reconnect, fallbacks, Redis adapter for scale. |
| Validation | **Zod** | One schema → TS type + runtime validation for REST and WS payloads. |
| ORM | **Prisma** | Mandated; type-safe, great migrations, readable schema. |
| DB | **PostgreSQL** | Mandated; relational integrity for content/results, JSONB for flexible bits. |
| Cache/coordination | **Redis** | Socket.IO adapter, authoritative-state mirror, rate limiting, presence, locks. |
| Object storage | **S3-compatible** | Mandated; media (images/audio/video) off the DB, CDN-frontable. |
| Auth | **JWT** | Mandated; stateless API auth + short-lived socket tokens. |
| Deploy | **Docker on Railway** | Mandated; reproducible images, managed Postgres/Redis. |
| Errors | **Sentry** | Mandated; client + server error capture with release tracking. |
| Tracing/metrics | **OpenTelemetry** | Mandated; spans across REST/WS/DB, exportable to any backend. |

## 4. Why Redis is non-optional

Socket.IO with a single process keeps room state in memory — fine until you run a
second instance (which we must, for 100+ concurrent players and zero-downtime
deploys). Redis provides:

1. **Pub/Sub adapter** — broadcasts reach sockets on any instance.
2. **Authoritative state mirror** — current room/round snapshot in a Redis hash so
   any instance can serve a reconnecting client and survive a single-process crash.
3. **Distributed rate limiting** — token buckets keyed in Redis.
4. **Presence + locks** — `SETNX` lock per room mutation prevents double-resolve
   races; presence TTL keys detect dropped hosts.

Postgres remains the **durable** store (content, users, finished-game results,
audit, payments). Redis holds **ephemeral, hot** state. A room's final outcome is
flushed to Postgres on `GAME_COMPLETED`.

## 5. Request & event flow examples

### A. Player submits an answer (happy path)
```
Controller                 Server (WS /play)                Redis        Screen
   │  answer:submit ─────────▶│                               │            │
   │  {questionId,optionId,   │ 1 verify socket auth+room     │            │
   │   clientTs}              │ 2 FSM state == COLLECTING?    │            │
   │                          │ 3 dedupe (one answer/round)──▶│ SETNX lock │
   │                          │ 4 store answer + serverTs ───▶│ hash       │
   │  ◀─ answer:ack ──────────│ 5 ack only to sender          │            │
   │                          │ 6 broadcast count delta ──────┼──────────▶ │ live viz
```
Score is **not** computed here — only at round resolution, server-side, from
stored `serverTs` and correctness. Client never learns the correct option until
`question:reveal`.

### B. Round resolution (timer expiry or all-answered)
```
FSM tick ─▶ state COLLECTING→LOCKED ─▶ compute results (correct set, speed bonus,
           lives decrement, eliminations) ─▶ persist round to Postgres ─▶
           emit question:reveal (screen+controllers) ─▶ emit score:update ─▶
           emit player:eliminated[] ─▶ state LOCKED→INTERMISSION ─▶ next round
```

## 6. Latency budget (target < 100 ms perceived)

| Segment | Budget |
|---------|--------|
| Client → edge (regional) | 10–40 ms |
| Socket.IO parse + auth + FSM guard | < 5 ms |
| Redis round-trip (lock/store) | < 3 ms |
| Broadcast fan-out (100 sockets) | < 10 ms |
| Client render of ack/optimistic state | < 16 ms (1 frame) |

Optimistic UI on the controller (button shows "locked in" instantly on tap) hides
network time; the authoritative ack corrects if needed.

## 7. Failure & recovery posture

- **Controller disconnect** → participant marked `DISCONNECTED` after a grace TTL;
  on reconnect, socket presents `participantToken`, server replays current snapshot.
- **Host (screen) disconnect** → room enters `PAUSED`; reconnect within grace window
  resumes; otherwise room is suspended and players notified.
- **Server instance crash** → clients auto-reconnect to a healthy instance; room
  state rehydrated from Redis; in-flight timers reconstructed from `roundEndsAt`.
- **Redis blip** → writes retried with backoff; if Redis is down the room pauses
  rather than risk inconsistent scoring (fail-safe, not fail-open).

See doc 06 (state) and doc 09 (scaling) for mechanics.
