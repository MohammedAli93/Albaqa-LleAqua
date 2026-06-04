# 03 — Folder Structure

pnpm-workspace monorepo. Three browser apps + one server + shared packages.

```
tahaddi/
├─ package.json                 # root scripts, workspaces
├─ pnpm-workspace.yaml
├─ tsconfig.base.json           # shared compiler options, path aliases
├─ .env.example
├─ docker-compose.yml           # local: postgres + redis + minio (S3) + mailhog
├─ railway.json                 # Railway service config
├─ .github/workflows/ci.yml
├─ docs/
│  └─ architecture/             # ← these documents
│
├─ packages/
│  ├─ shared/                   # the contract — imported by clients AND server
│  │  ├─ src/
│  │  │  ├─ events.ts           # WS event names (enum) + payload Zod schemas
│  │  │  ├─ rest.ts             # REST DTOs + Zod schemas
│  │  │  ├─ domain.ts           # shared domain types (GameMode, Status, etc.)
│  │  │  ├─ errors.ts           # error codes + error envelope type
│  │  │  ├─ avatars.ts          # built-in avatar catalogue
│  │  │  └─ index.ts
│  │  └─ package.json
│  │
│  ├─ ui/                       # shared React design-system components
│  │  ├─ src/
│  │  │  ├─ tokens/             # design tokens (re-exported to tailwind preset)
│  │  │  ├─ components/         # Button, Card, GlassPanel, Avatar, Countdown…
│  │  │  ├─ motion/             # Framer Motion variants & presets
│  │  │  ├─ particles/          # particle/confetti systems
│  │  │  └─ index.ts
│  │  └─ package.json
│  │
│  ├─ i18n/                     # ar/en message catalogues + RTL helpers
│  │  └─ src/{ar.json,en.json,index.ts}
│  │
│  └─ config/                   # shared tailwind preset, eslint, tsconfig, prettier
│     ├─ tailwind-preset.cjs
│     ├─ eslint-preset.cjs
│     └─ tsconfig.react.json
│
├─ apps/
│  ├─ server/                   # backend (Phases 2,3,4,8)
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma
│  │  │  ├─ migrations/
│  │  │  └─ seed.ts
│  │  ├─ src/
│  │  │  ├─ index.ts            # bootstrap: http + socket + graceful shutdown
│  │  │  ├─ app.ts              # express app assembly
│  │  │  ├─ config/             # env loader (zod-validated), constants
│  │  │  ├─ lib/                # prisma client, redis client, s3 client, logger
│  │  │  ├─ middleware/         # auth, rateLimit, errorHandler, requestId, audit
│  │  │  ├─ http/               # REST layer
│  │  │  │  ├─ routes/          # auth, admin/*, public, media, payments
│  │  │  │  ├─ controllers/
│  │  │  │  └─ validators/      # zod schemas (re-export from shared where shared)
│  │  │  ├─ realtime/           # WebSocket layer
│  │  │  │  ├─ index.ts         # io server, adapter, namespace registration
│  │  │  │  ├─ namespaces/      # screen.ns.ts, play.ns.ts, admin.ns.ts
│  │  │  │  ├─ middleware/      # socketAuth, socketRateLimit
│  │  │  │  └─ handlers/        # per-event handlers
│  │  │  ├─ domain/             # business logic (framework-agnostic, testable)
│  │  │  │  ├─ rooms/           # room registry, code gen, lifecycle
│  │  │  │  ├─ game/            # FSM, scoring, elimination, timer scheduler
│  │  │  │  ├─ content/         # packages, questions, categories, import
│  │  │  │  ├─ media/           # upload signing, transcode hooks
│  │  │  │  ├─ payments/        # provider abstraction + adapters
│  │  │  │  ├─ analytics/
│  │  │  │  └─ auth/            # jwt, password, roles
│  │  │  ├─ telemetry/          # otel setup, sentry init
│  │  │  └─ types/
│  │  ├─ test/                  # vitest unit + supertest integration + socket e2e
│  │  ├─ Dockerfile
│  │  └─ package.json
│  │
│  ├─ screen/                   # Main Screen app (Phase 5)
│  │  ├─ src/
│  │  │  ├─ main.tsx
│  │  │  ├─ App.tsx
│  │  │  ├─ socket/             # socket client + typed event bindings
│  │  │  ├─ store/              # zustand: roomStore, gameStore, uiStore
│  │  │  ├─ screens/            # Lobby, Question, Reveal, Scoreboard, Elimination, Winner
│  │  │  ├─ components/         # QR, RoomCode, PlayerGrid, Timer, AnswerBars
│  │  │  ├─ scenes/             # full-screen animated scene compositions
│  │  │  └─ hooks/
│  │  ├─ index.html
│  │  ├─ Dockerfile             # nginx static serve
│  │  └─ package.json
│  │
│  ├─ controller/               # Mobile Controller app (Phase 6)
│  │  ├─ src/
│  │  │  ├─ main.tsx
│  │  │  ├─ socket/
│  │  │  ├─ store/              # zustand: sessionStore, gameStore
│  │  │  ├─ screens/            # Join, Avatar, Lobby, Answer, Status, Eliminated, Result
│  │  │  ├─ components/         # AnswerButton, Lives, ScorePill, Haptics
│  │  │  └─ hooks/              # useReconnect, useWakeLock, useHaptics
│  │  ├─ index.html
│  │  ├─ Dockerfile
│  │  └─ package.json
│  │
│  └─ admin/                    # Admin Dashboard (Phase 7)
│     ├─ src/
│     │  ├─ main.tsx
│     │  ├─ api/                # react-query hooks over REST
│     │  ├─ store/
│     │  ├─ pages/              # Login, Questions, Packages, Categories, Media,
│     │  │                      #   Import, Analytics, Sessions, Revenue, Users
│     │  ├─ components/         # DataTable, Uploader, Importer, Charts
│     │  └─ routes.tsx
│     ├─ index.html
│     ├─ Dockerfile
│     └─ package.json
│
└─ infra/
   ├─ nginx/                    # static app serving + gzip/brotli, SPA fallback
   └─ scripts/                  # seed, loadtest (artillery/k6), backup
```

## Module boundary rules

1. **`packages/shared` has zero runtime deps** beyond `zod`. It is the wire
   contract; both server and clients import it so a renamed event breaks the
   build, not production.
2. **`domain/` is framework-free.** No Express/Socket.IO imports inside
   `domain/game`. The FSM is pure logic taking inputs → producing events; the
   realtime layer adapts sockets to it. This makes the game engine unit-testable
   without a network.
3. **Clients never import server internals**, only `packages/shared` and
   `packages/ui`.
4. **One-way dependency:** `http`/`realtime` → `domain` → `lib`. Never reverse.

## Path aliases (`tsconfig.base.json`)

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@tahaddi/shared": ["packages/shared/src"],
      "@tahaddi/ui": ["packages/ui/src"],
      "@tahaddi/i18n": ["packages/i18n/src"],
      "@/*": ["./src/*"]
    }
  }
}
```
