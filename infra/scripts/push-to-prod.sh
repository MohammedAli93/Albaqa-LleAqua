#!/usr/bin/env bash
#
# Redeploy Tahaddi to the production EC2 box.
#
#   ./infra/scripts/push-to-prod.sh              # rebuild server + controller
#   ./infra/scripts/push-to-prod.sh --seed       # …and re-seed the question bank
#   ./infra/scripts/push-to-prod.sh --check      # reachability only, change nothing
#
# Why this script exists: the same five-step dance has been done by hand for every
# content deploy since 2026-07-22, and two of its steps are counter-intuitive
# enough that the runbook got them wrong.
#
#   1. `~/tahaddi` ON THE BOX IS A FILE COPY, NOT A GIT CLONE. `git pull` there
#      fails; the code goes up as `git archive | scp | tar xzf`.
#   2. `deploy/` IS UNTRACKED, so the tarball never contains it — which is exactly
#      what keeps the live Tap keys in `deploy/.env.production` from being
#      clobbered on every deploy. The script asserts this rather than trusting it.
#   3. Frontend URLs are baked in at BUILD time, so it is `up -d --build`, never a
#      plain restart.
#   4. A CONTENT change reaches players only through `db:seed`. Rebuilding alone
#      ships new code against the old rows.
#   5. The health endpoint is /healthz on api.bqaqgame.com — not /health, and not
#      on play.*.
#
# Prerequisite the script cannot satisfy for you: inbound SSH. Port 22 on
# security group `tahaddi-prod-sg` (sg-0a20ebdfad5ecbc03, ap-south-1, client AWS
# account 019229937390) is pinned to a single admin IP. When your ISP moves you,
# the connection TIMES OUT and someone with console access has to re-point that
# rule at your current address. `--check` prints the address to give them.
set -euo pipefail

HOST=${TAHADDI_HOST:-ubuntu@3.111.131.166}
KEY=${TAHADDI_KEY:-$HOME/.ssh/tahaddi-prod}
REMOTE=${TAHADDI_REMOTE:-tahaddi}
COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production"
SSH=(ssh -i "$KEY" -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new "$HOST")

SEED=false
CHECK_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --seed) SEED=true ;;
    --check) CHECK_ONLY=true ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

say() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
die() { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ── 1 · Reachability ─────────────────────────────────────────────────────────
say "Checking reachability"
curl -fsS --max-time 15 https://api.bqaqgame.com/healthz >/dev/null \
  && echo "  api.bqaqgame.com/healthz  ok (prod is up)" \
  || echo "  api.bqaqgame.com/healthz  UNREACHABLE"

if ! "${SSH[@]}" -o BatchMode=yes true 2>/dev/null; then
  MY_IP=$(curl -fsS --max-time 10 https://api.ipify.org || echo 'unknown')
  cat >&2 <<EOF

✗ SSH to $HOST is blocked (connection times out).

  This is the security-group rule, not the box: HTTPS is answering, port 22 is
  filtered. Someone with access to the client's AWS console needs to do:

    EC2 (region ap-south-1 / Mumbai) → Security Groups → tahaddi-prod-sg
    (sg-0a20ebdfad5ecbc03) → Inbound rules → Edit → the SSH / port 22 rule
    → set Source to  $MY_IP/32  → Save.

  Then re-run this script. Tighten or remove the rule again afterwards.
EOF
  exit 1
fi
echo "  ssh $HOST              ok"
$CHECK_ONLY && { say "--check: nothing changed"; exit 0; }

# ── 2 · Build the bundle from the committed tree ─────────────────────────────
say "Building bundle from HEAD ($(git rev-parse --short HEAD))"
[ -z "$(git status --porcelain -- apps packages)" ] \
  || die "uncommitted changes under apps/ or packages/ — commit first, the bundle is built from HEAD"

TAR=$(mktemp -t tahaddi-XXXXXX.tar.gz)
trap 'rm -f "$TAR"' EXIT
git archive --format=tar.gz -o "$TAR" HEAD
# The whole reason .env.production survives a deploy. Assert it, don't assume it.
tar tzf "$TAR" | grep -q '^deploy/' \
  && die "the bundle contains deploy/ — it would overwrite .env.production and the live Tap keys"
echo "  $(du -h "$TAR" | cut -f1) · $(tar tzf "$TAR" | wc -l) files · no deploy/ ✓"

# ── 3 · Ship it ──────────────────────────────────────────────────────────────
say "Uploading to $HOST:~/$REMOTE"
scp -i "$KEY" -o StrictHostKeyChecking=accept-new "$TAR" "$HOST:/tmp/tahaddi-deploy.tar.gz"
"${SSH[@]}" "mkdir -p ~/$REMOTE && tar xzf /tmp/tahaddi-deploy.tar.gz -C ~/$REMOTE && rm /tmp/tahaddi-deploy.tar.gz"
"${SSH[@]}" "test -f ~/$REMOTE/deploy/.env.production" \
  || die "deploy/.env.production is missing on the box — do not rebuild, restore it first"

# ── 4 · Rebuild ──────────────────────────────────────────────────────────────
# Only server + controller: postgres/redis/caddy carry no app code, and the
# TV/screen app was removed on 2026-07-17 (controller serves every role).
say "Rebuilding server + controller (frontend env is baked in at build time)"
"${SSH[@]}" "cd ~/$REMOTE && $COMPOSE up -d --build server controller"

# ── 5 · Seed (content changes only) ──────────────────────────────────────────
if $SEED; then
  say "Backing up Postgres before the seed"
  STAMP=$(date +%F-%H%M)
  "${SSH[@]}" "mkdir -p ~/backups && cd ~/$REMOTE && $COMPOSE exec -T postgres pg_dump -U tahaddi tahaddi | gzip > ~/backups/pre-seed-$STAMP.sql.gz && ls -lh ~/backups/pre-seed-$STAMP.sql.gz"
  say "Seeding the question bank (retires rows dropped from the bank)"
  "${SSH[@]}" "cd ~/$REMOTE && $COMPOSE exec -T server pnpm db:seed"
fi

# ── 6 · Verify ───────────────────────────────────────────────────────────────
say "Verifying"
for url in https://api.bqaqgame.com/healthz https://api.bqaqgame.com/readyz \
           https://api.bqaqgame.com/api/v1/categories/public https://play.bqaqgame.com; do
  printf '  %-52s %s\n' "$url" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$url")"
done
"${SSH[@]}" "cd ~/$REMOTE && $COMPOSE ps --format '  {{.Service}}\t{{.State}}'"

say "Done — deployed $(git rev-parse --short HEAD)$($SEED && echo ' + re-seeded')"
