# Testing Strategy

Tests are layered by cost and confidence. The fairness-critical logic is pure and
fully unit-tested; integration and load tests validate the wiring and capacity.

## 1. Unit tests (run now — no infra) ✅

`apps/server/test/` via **vitest**. These cover the game's correctness core, which
is deliberately written as pure functions so it needs no DB/Redis/sockets.

| File | Covers |
|------|--------|
| `scoring.test.ts` | speed-bonus curve, answer resolution, life loss, sudden-death elimination, win conditions, active-player counting |
| `fsm.test.ts` | legal status transitions, start guards, **anti-cheat answer guards** (stale round, closed window, locked phase, join-after-start) |
| `contract.test.ts` | shared Zod schemas — correctOptionId invariant, settings bounds, answer payload, avatar validation |

Run: `pnpm --filter @tahaddi/server test` → **31 tests passing**.

These are the tests that protect the money/fairness logic: that you can't score a
wrong answer, can't answer after the window closes, can't be eliminated with lives
remaining (except sudden death), and that the winner is computed deterministically.

## 2. Integration tests (need Postgres + Redis)

Run against the docker-compose stack (`pnpm infra:up`):
- **REST** (supertest): auth flow (login → me → refresh → revoke), content CRUD with
  RBAC enforcement, import preview/commit, room creation.
- **Socket E2E** (socket.io-client): full game — create room, join N players, start,
  answer, reveal, eliminate, complete — asserting the event sequence and that the
  correct answer is never sent before `question:reveal`.

These are scaffolded to run in CI with ephemeral service containers (see
`.github/workflows/ci.yml`).

## 3. Load test (capacity) — `infra/scripts/loadtest.js`

Simulates a full game with N concurrent players against a live server and reports
answer-ack p50/p95/p99 + error count.

```
pnpm infra:up && pnpm db:migrate && pnpm db:seed
pnpm --filter @tahaddi/server dev        # in one terminal
node infra/scripts/loadtest.js --players 100 --api http://localhost:8080
```

Target (doc 09): 100 concurrent players, ack p95 < 100 ms, zero answer errors.
Tune `questionTimerSec` and round count via the script's settings block.

## 4. What to add before GA

- Reconnection test: drop a player mid-round, reconnect within grace, assert
  snapshot restoration and that they can still answer if the window is open.
- Double-resolve race test: fire timer expiry and last-answer simultaneously,
  assert exactly one resolution (Redis lock + phase check).
- Teams-mode end-to-end scoring test.
- Frontend component tests (Vitest + Testing Library) for the answer/optimistic
  rollback path and the reveal rendering.
