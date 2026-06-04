#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Finish the Tahaddi Railway deploy from a machine with a stable connection.
#
# Everything is already provisioned by the assistant:
#   • project "tahaddi" (id 36ae5bbf-6491-43ea-953a-d6868dc8e18c)
#   • 6 services: tahaddi-postgres (running), tahaddi-redis (running),
#     tahaddi-server, tahaddi-screen, tahaddi-controller, tahaddi-admin
#   • public domains generated for all 4 app services
#   • all env vars + secrets set (server DB/Redis/JWT/S3/PUBLIC_*; clients VITE_*)
#
# The ONLY step left is uploading the build context (`railway up`), which the
# assistant's sandbox could not do (its connection to Railway's upload endpoint
# times out). Run this from your own terminal. Secrets live in ./.env.railway.
#
# Prereq: Railway CLI logged in as you (`railway whoami` should succeed).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ID=36ae5bbf-6491-43ea-953a-d6868dc8e18c
WORKSPACE_ID=4f2aa4e8-f012-41ca-92de-c7d419b942d4

cd "$(dirname "$0")/../.."   # repo root

echo "▸ linking project…"
railway link -p "$PROJECT_ID" -e production -w "$WORKSPACE_ID"

# Deploy each service. RAILWAY_DOCKERFILE_PATH is already set per service, so the
# correct Dockerfile (built from repo root) is used. --detach returns once the
# build is queued; watch progress at railway.com or with `railway logs -s <svc>`.
for svc in tahaddi-server tahaddi-screen tahaddi-controller tahaddi-admin; do
  echo "▸ deploying $svc…"
  railway up --service "$svc" --detach
done

echo
echo "▸ deploys queued. The server runs 'prisma migrate deploy' on boot, which"
echo "  applies the SEEN_JEEM migration. Watch it come up:"
echo "    railway logs --service tahaddi-server"
echo
echo "▸ Once the server is healthy, seed the DB (admin user + demo package) from"
echo "  INSIDE the server container (the DB is on the private network):"
echo "    railway ssh --service tahaddi-server"
echo "    # then, in the container:"
echo "    cd /app/apps/server && pnpm db:seed"
echo
echo "▸ Play it:"
echo "    Screen   : https://tahaddi-screen-production.up.railway.app/?mode=seenjeem"
echo "    Phones   : the QR on the screen → https://tahaddi-controller-production.up.railway.app"
echo "    Admin    : https://tahaddi-admin-production.up.railway.app (login = SEED_ADMIN_* in .env.railway)"
echo
echo "▸ Watch for in the server logs: if it can't reach Redis over the private"
echo "  network (IPv6), set REDIS_URL with '?family=0' or check ioredis IPv6."
