# ── Tahaddi Mobile Controller — static build (run from repo root) ────────────
# docker build -f apps/controller/Dockerfile --build-arg VITE_API_URL=... -t tahaddi-controller .
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY packages ./packages
COPY apps/controller ./apps/controller
RUN pnpm install --frozen-lockfile

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @tahaddi/controller build

FROM nginx:alpine
COPY infra/nginx/spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/controller/dist /usr/share/nginx/html
EXPOSE 80
