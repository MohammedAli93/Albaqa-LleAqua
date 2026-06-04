# 07 — Deployment Architecture

Target platform: **Railway** with **Docker**. Managed Postgres + Redis add-ons.
S3-compatible object storage (Railway volume + bucket provider, or Cloudflare R2 /
AWS S3 / Backblaze — interchangeable via env).

## 1. Services / deployables

| Service | Image | Scales | Notes |
|---------|-------|--------|-------|
| `server` | Node (multi-stage) | horizontally (N replicas) | API + Socket.IO; stateless thanks to Redis adapter. |
| `screen` | nginx static | CDN/edge | built `apps/screen`; SPA fallback. |
| `controller` | nginx static | CDN/edge | built `apps/controller`. |
| `admin` | nginx static | CDN/edge | built `apps/admin`; behind auth. |
| `postgres` | Railway managed | vertical + read replica | primary DB. |
| `redis` | Railway managed | vertical | adapter + ephemeral state. |

Static apps are just files — cheap to serve, cache aggressively at the edge. Only
`server` is stateful-ish, and it externalizes all state to Redis/PG so replicas are
interchangeable.

## 2. Routing

```
fans:        screen.tahaddi.app ─┐
players:     play.tahaddi.app  ──┼─▶ edge/CDN ─▶ nginx static buckets
admins:      admin.tahaddi.app ──┘
api + ws:    api.tahaddi.app    ───▶ Railway server replicas (sticky for WS)
```

WebSocket sticky sessions: the load balancer routes a socket's HTTP-upgrade and
subsequent frames to the same replica (Socket.IO requires this unless using only
the WebSocket transport). With the Redis adapter, broadcasts still reach sockets on
other replicas; stickiness only pins an individual long-lived connection.

## 3. Dockerfiles

### server (multi-stage)
```dockerfile
# build
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @tahaddi/server prisma generate
RUN pnpm --filter @tahaddi/server build      # tsc → dist

# runtime
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/server/prisma ./prisma
EXPOSE 8080
HEALTHCHECK CMD wget -qO- http://localhost:8080/healthz || exit 1
CMD ["node", "dist/index.js"]
# entrypoint runs `prisma migrate deploy` before boot in start script
```

### static client (screen/controller/admin)
```dockerfile
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @tahaddi/screen build       # → dist static

FROM nginx:alpine
COPY infra/nginx/spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/screen/dist /usr/share/nginx/html
```

## 4. Local development (`docker-compose.yml`)

Brings up Postgres, Redis, MinIO (S3), and Mailhog so a developer runs the full
stack with one command; apps run with Vite dev servers against these.

```
services: postgres(5432) · redis(6379) · minio(9000/9001) · mailhog(1025/8025)
```

`pnpm dev` runs all four app dev servers + the API with `tsx watch` concurrently.

## 5. Configuration & secrets

- 12-factor: **all config via env**, validated at boot by a Zod schema
  (`config/env.ts`). The process refuses to start on missing/invalid config — fail
  fast, never run misconfigured.
- Secrets (JWT secret, DB URL, Redis URL, S3 keys, provider keys, Sentry DSN) come
  from Railway's secret store, never committed. `.env.example` documents every key.
- Separate environments: `development`, `staging`, `production`, each with its own
  DB/Redis/bucket and keys.

## 6. CI/CD (`.github/workflows/ci.yml`)

```
on PR:
  - install (pnpm, cached)
  - lint (eslint) + typecheck (tsc --noEmit) across workspace
  - unit + integration tests (vitest) with ephemeral postgres+redis services
  - build all apps (catch build breaks)
on merge to main:
  - all of the above
  - build & push Docker images (server + 3 statics) tagged with commit sha
  - Railway deploy: run `prisma migrate deploy`, then rolling restart of server
  - upload source maps to Sentry, tag release
```

Migrations run as a **release step before** new server code accepts traffic;
migrations are written backward-compatible (expand/contract) so old and new
replicas coexist during a rolling deploy.

## 7. Observability

- **Sentry** — server (Express + Socket.IO error capture) and all three clients,
  with release + sourcemaps; performance tracing sampled.
- **OpenTelemetry** — auto-instrumented HTTP/Express/Prisma/ioredis spans + custom
  spans around FSM transitions and round resolution; exported via OTLP to a
  collector (Grafana/Tempo/Honeycomb-agnostic). RED metrics (rate/errors/duration)
  per endpoint and per WS event.
- **Structured logs** — pino JSON with `requestId`/`gameId` correlation; shipped to
  Railway logs / log drain.
- **Health** — `/healthz` (liveness), `/readyz` (DB+Redis), used by Railway and the
  load balancer.

## 8. Zero-downtime & rollback

- Rolling deploys with health-gated replica replacement.
- Sticky WS connections drain: a replica marked for shutdown stops accepting new
  sockets, emits `game:paused(reason: "server-maintenance")` only if it can't hand
  off, and existing clients reconnect to healthy replicas (state in Redis).
- `SIGTERM` handler: stop accepting connections → finish in-flight HTTP → flush
  telemetry → close Redis/PG → exit. Grace period configurable.
- Rollback = redeploy previous image tag; backward-compatible migrations make this
  safe.

## 9. Backups & DR

- Postgres automated daily snapshots + PITR (managed).
- Redis is treated as **rebuildable cache** — its loss pauses live rooms but loses
  no durable data; AOF enabled to minimize live-room disruption.
- S3 media: versioning + lifecycle rules; cross-region replication optional.
