# Tahaddi — تحدّي

> A real-time multiplayer trivia & elimination game built for a **TV-show-grade**
> experience. Original product inspired by the *Seen Jeem* format — modern,
> premium, Arabic-first.

Three browser clients + one backend, in a pnpm monorepo:

- **Main Screen** (`apps/screen`) — the broadcast display: lobby, QR, questions,
  timers, live answer visualization, scoreboard, elimination & winner sequences.
- **Mobile Controller** (`apps/controller`) — players join by QR (no install),
  pick a nickname & avatar, and answer on their phones.
- **Admin Dashboard** (`apps/admin`) — content (questions/packages/categories),
  bulk import, media, analytics, revenue, users.
- **Backend** (`apps/server`) — Express REST + Socket.IO realtime, Prisma/Postgres,
  Redis, S3, server-authoritative game engine.

## Status

**All 10 phases complete.** Architecture documented up front (`docs/architecture/`),
then implemented phase by phase. Every workspace typechecks, the server bundles,
all three client apps build, and 31 unit tests pass over the fairness core.

- Run it locally: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**
- Test strategy: **[docs/TESTING.md](docs/TESTING.md)**
- Architecture index: **[docs/architecture/00-overview.md](docs/architecture/00-overview.md)**

```bash
cp .env.example .env
pnpm install
pnpm infra:up && pnpm db:migrate && pnpm db:seed
pnpm dev   # screen:5173  controller:5174  admin:5175  api:8080
```

| Doc | Topic |
|-----|-------|
| [00](docs/architecture/00-overview.md) | Overview, glossary, phase plan |
| [01](docs/architecture/01-technical-architecture.md) | Technical architecture & tech stack |
| [02](docs/architecture/02-database-schema.md) | Database schema (Prisma) |
| [03](docs/architecture/03-folder-structure.md) | Monorepo folder structure |
| [04](docs/architecture/04-api-specification.md) | REST API specification |
| [05](docs/architecture/05-websocket-specification.md) | WebSocket event specification |
| [06](docs/architecture/06-state-management.md) | State management & game FSM |
| [07](docs/architecture/07-deployment-architecture.md) | Deployment (Docker/Railway) |
| [08](docs/architecture/08-security-architecture.md) | Security & anti-cheat |
| [09](docs/architecture/09-scaling-strategy.md) | Scaling strategy |
| [10](docs/architecture/10-payments-architecture.md) | Payments abstraction |
| [11](docs/architecture/11-design-system.md) | Design system & motion |

## Tech stack

React · TypeScript · Vite · Framer Motion · TailwindCSS · Zustand · Socket.IO ·
Node · Express · Prisma · PostgreSQL · Redis · S3 · JWT · Docker · Railway ·
Sentry · OpenTelemetry.

## Development phases

1. ✅ Architecture · 2. ✅ Database · 3. ✅ Backend foundation · 4. ✅ WebSocket system ·
5. ✅ Main Screen · 6. ✅ Mobile Controller · 7. ✅ Admin Dashboard · 8. ✅ Payments ·
9. ✅ Testing · 10. ✅ Deployment.
