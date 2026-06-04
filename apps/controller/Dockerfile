# ── Tahaddi Mobile Controller — static build (run from repo root) ────────────
# docker build -f apps/controller/Dockerfile --build-arg VITE_API_URL=... -t tahaddi-controller .
FROM node:20-alpine AS build
RUN npm install -g pnpm@9.12.0
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY packages ./packages
COPY apps/controller ./apps/controller
RUN pnpm install --frozen-lockfile

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @tahaddi/controller build

FROM nginx:alpine
ENV PORT=80
COPY infra/nginx/spa.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/controller/dist /usr/share/nginx/html
EXPOSE 80
