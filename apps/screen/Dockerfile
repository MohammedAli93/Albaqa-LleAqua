# ── Tahaddi Main Screen — static build (run from repo root) ──────────────────
# docker build -f apps/screen/Dockerfile --build-arg VITE_API_URL=... -t tahaddi-screen .
FROM node:20-alpine AS build
RUN npm install -g pnpm@9.12.0
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY packages ./packages
COPY apps/screen ./apps/screen
RUN pnpm install --frozen-lockfile

ARG VITE_API_URL
ARG VITE_CONTROLLER_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CONTROLLER_URL=$VITE_CONTROLLER_URL
RUN pnpm --filter @tahaddi/screen build

FROM nginx:alpine
ENV PORT=80
COPY infra/nginx/spa.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/screen/dist /usr/share/nginx/html
EXPOSE 80
