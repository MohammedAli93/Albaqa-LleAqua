# ── Tahaddi server — multi-stage build (run from repo root) ──────────────────
# Build: docker build -f apps/server/Dockerfile -t tahaddi-server .
FROM node:20-alpine AS base
# openssl: Prisma's query/migration engine needs it on Alpine (musl) at runtime.
RUN apk add --no-cache openssl && npm install -g pnpm@9.12.0
WORKDIR /app

# ── deps: install the whole workspace (needed for shared package) ─────────────
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN pnpm install --frozen-lockfile

# ── build: generate prisma client + bundle server ────────────────────────────
FROM deps AS build
RUN pnpm --filter @tahaddi/server db:generate
RUN pnpm --filter @tahaddi/server build

# ── runtime: minimal image ────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=8080
# node_modules carries @prisma/client (+ engine) and the prisma CLI for migrate.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/prisma ./apps/server/prisma
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
WORKDIR /app/apps/server

EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=5s --retries=5 \
  CMD wget -qO- http://localhost:8080/healthz || exit 1

# Apply migrations, then boot. Migrations are backward-compatible (expand/contract)
# so rolling deploys are safe (doc 07 §6).
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/index.js"]
