# 09 — Scaling Strategy

Design target: **100 concurrent players per room**, many concurrent rooms, 60 FPS
client animations, < 100 ms perceived socket latency, with graceful behavior far
beyond MVP load.

## 1. Where the load actually is

A trivia game is **bursty, fan-out heavy, light per-message**:
- 100 players answer within a ~15 s window → up to 100 inbound `player:answer`.
- Each round resolution fans out a handful of broadcasts to 100+ sockets.
- Between rounds, near-idle except `timer:tick` (coalesced) and heartbeats.

So the bottlenecks are **broadcast fan-out** and **per-round resolution work**, not
raw request volume. We optimize for those.

## 2. Horizontal scaling of the realtime tier

- `server` replicas are **stateless** (all room state in Redis) → add replicas to
  scale connection capacity linearly.
- **Socket.IO Redis adapter** (`@socket.io/redis-adapter`) propagates broadcasts
  across replicas via Redis pub/sub, so a player on replica A and the host on
  replica B stay in sync.
- **Sticky sessions** at the LB pin each long-lived socket to one replica;
  cross-replica delivery is handled by the adapter, not by re-routing frames.
- A single room's sockets *may* span replicas; this is fine because no replica
  holds authoritative state — Redis does.

```
        ┌── replica 1 ──┐        ┌── replica 2 ──┐
players │ sockets a,b,c │        │ sockets d,e   │ players
        └──────┬────────┘        └──────┬────────┘
               └──────── Redis pub/sub adapter ────────┘
                        + room state hash + locks
```

## 3. Capacity model (back-of-envelope)

| Resource | Per-room cost | 100-player room | 1,000 rooms (100k players) |
|----------|---------------|-----------------|----------------------------|
| Open sockets | ~101 | 101 | ~101,000 |
| Inbound msgs / round | ~100 answers | 100 | 100,000 over the window |
| Broadcasts / round | ~5 events | 5 × 101 deliveries | scales w/ rooms |
| Redis ops / round | lock + writes + reads | ~tens | tens of thousands |

A single modern Node instance comfortably holds ~10–20k concurrent sockets. To
reach 100k players we run ~6–10 replicas plus a suitably sized Redis. Numbers are
planning estimates to validate in Phase 9 load tests (k6/artillery), not promises.

## 4. Reducing fan-out cost (the key optimizations)

1. **Coalesced `answer:received`** — at most 1 broadcast / 100 ms with the latest
   count, instead of 1 per answer. Cuts 100 broadcasts → ≤ 10 per window.
2. **`timer:tick` at ~4 Hz**, client tweens to 60 fps — countdown smoothness is a
   client concern, not a network one.
3. **Personal vs room messages** — correctness/score-detail go personally only to
   the player they concern; the room gets aggregate distributions, not per-player
   data.
4. **`perMessageDeflate` only on large payloads** (`room:state`); skip compression
   on tiny frequent frames where CPU > bandwidth savings.
5. **Pre-serialized broadcasts** — build the JSON once, send to all; avoid
   per-socket serialization.

## 5. Database scaling

- Live game does **near-zero** Postgres traffic (state is in Redis). Postgres load
  is: room creation, admin content reads, and milestone flushes (round resolved,
  game completed). This is exactly the access pattern Postgres handles best.
- **Read/write split**: analytics and admin reads go to a **read replica**; writes
  to primary. Prisma supports this via separate clients/datasources.
- **Connection pooling** via PgBouncer (transaction mode) — many replicas, bounded
  DB connections.
- Hot indexes defined in doc 02; analytics queries are bounded by date range +
  cursor pagination, never full scans.
- Flush batching: round answers persisted in one transaction per round, not per
  answer.

## 6. Redis scaling & resilience

- Start single-primary + replica (managed). Scale vertically first (Redis is very
  fast); the workload is small values + pub/sub.
- If pub/sub fan-out becomes the limit, shard by `gameId` across a Redis Cluster /
  multiple adapter shards (a room's traffic is independent of other rooms — a
  naturally shardable key).
- AOF persistence so a Redis restart doesn't drop live rooms; rooms are also
  rebuildable from the FSM + last PG flush as a last resort.

## 7. Static client delivery

- `screen`, `controller`, `admin` are static bundles served from the edge/CDN —
  effectively infinite scale, cheap, cached. Player load on the static tier is a
  non-issue.
- Vite code-splitting + route-level lazy loading keeps initial controller payload
  tiny (critical for players on mobile data joining fast).
- Media served from S3 + CDN, never through the API.

## 8. Autoscaling policy

- Scale `server` replicas on **concurrent socket count** and **event loop lag**
  (better signals than CPU for an I/O-bound socket server).
- Scale-up fast (bursty joins when a show starts), scale-down slow (avoid
  disrupting mid-game rooms; drain gracefully).
- Per-room hard cap (`maxPlayers ≤ 100`) and per-instance soft cap protect against
  a single hot room or a thundering herd.

## 9. Graceful degradation

| Pressure | Degradation (in order) |
|----------|------------------------|
| High broadcast load | Increase coalescing windows; drop `timer:tick` to 2 Hz; clients interpolate. |
| Redis saturation | Shed new room creation (`503` on `POST /rooms`) before harming live rooms. |
| Server replica overload | LB stops routing new sockets to it; existing rooms unaffected. |
| Total Redis outage | Live rooms PAUSE (fail-safe), no data loss; resume on recovery. |

The system always prefers **pausing a game** over **corrupting a game**.

## 10. What we explicitly defer (post-MVP)

- Multi-region active-active (latency-routing players to nearest region with
  cross-region room affinity).
- Event sourcing / replayable game logs for full deterministic replays.
- Dedicated game-engine microservice extraction (boundary already drawn in
  `domain/game` so this is a lift, not a rewrite).
