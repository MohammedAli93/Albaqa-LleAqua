# ── Tahaddi Admin Dashboard — static build (run from repo root) ──────────────
# docker build -f apps/admin/Dockerfile --build-arg VITE_API_URL=... -t tahaddi-admin .
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY packages ./packages
COPY apps/admin ./apps/admin
RUN pnpm install --frozen-lockfile

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @tahaddi/admin build

FROM nginx:alpine
COPY infra/nginx/spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 80
