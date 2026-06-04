# Deployment Runbook

## Local (Docker Compose)

```bash
cp .env.example .env                 # then edit secrets
pnpm install
pnpm infra:up                        # postgres + redis + minio + mailhog
pnpm db:migrate                      # apply schema
pnpm db:seed                         # super admin + demo package
pnpm dev                             # all 4 apps + API concurrently
```

Open:
- Main Screen → http://localhost:5173
- Controller → http://localhost:5174 (or scan the QR on the screen)
- Admin → http://localhost:5175 (login with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
- MinIO console → http://localhost:9001 · Mailhog → http://localhost:8025

## Production (Railway + Docker)

Four services, each with its own `railway.json` + Dockerfile (built from repo root):

| Service | Dockerfile | Notes |
|---------|-----------|-------|
| `server` | `apps/server/Dockerfile` | API + WS. `numReplicas: 2`, sticky sessions for WS, `/readyz` healthcheck. Runs `prisma migrate deploy` on boot. |
| `screen` | `apps/screen/Dockerfile` | nginx static. Build arg `VITE_API_URL`, `VITE_CONTROLLER_URL`. |
| `controller` | `apps/controller/Dockerfile` | nginx static. Build arg `VITE_API_URL`. |
| `admin` | `apps/admin/Dockerfile` | nginx static. Build arg `VITE_API_URL`. |

Plus managed **PostgreSQL** and **Redis** add-ons, and an S3-compatible bucket
(R2 / S3 / Backblaze) configured via `S3_*` env.

### Required env (server)
See `.env.example`. At minimum in production: `DATABASE_URL`, `REDIS_URL`,
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (≥32 chars), `TOKEN_PEPPER`, all `S3_*`,
and the `PUBLIC_*_URL`s (used for the CORS allowlist + QR join links). Optional:
`STRIPE_*`, `SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT`.

### Networking
- LB must enable **sticky sessions** for the server's WebSocket upgrade.
- Cross-replica broadcasts are handled by the Socket.IO **Redis adapter** — no
  extra config beyond `REDIS_URL`.
- CORS allowlist is derived from `PUBLIC_SCREEN_URL`, `PUBLIC_CONTROLLER_URL`,
  `PUBLIC_ADMIN_URL`.

### Migrations & zero-downtime
- Migrations run as the server's start step (`prisma migrate deploy`) and are
  written backward-compatible (expand/contract) so old and new replicas coexist
  during a rolling deploy.
- Rollback = redeploy the previous image tag.
- `SIGTERM` triggers graceful shutdown: stop accepting connections → close
  realtime → disconnect Redis/Prisma → exit.

### Observability
- **Sentry** auto-enables when `SENTRY_DSN` is set (errors + perf sampling).
- **OpenTelemetry**: set `OTEL_EXPORTER_OTLP_ENDPOINT` and install the SDK packages
  listed in `src/telemetry/otel.ts` to enable auto-instrumented traces.
- Health: `/healthz` (liveness), `/readyz` (DB + Redis), `/metrics` (internal).

## CI

`.github/workflows/ci.yml`: install → typecheck (all) → unit tests → migrate →
build (all), with ephemeral Postgres + Redis service containers. On `main`, the
deploy job is the place to wire Railway/registry credentials.
