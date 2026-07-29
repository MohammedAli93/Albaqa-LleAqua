-- A paid game-credit is now spent when the host actually STARTS the game, not when
-- the room is created. This column records the moment it was charged and doubles as
-- the idempotency guard so a game can never be charged twice.
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "creditChargedAt" TIMESTAMPTZ;

-- Backfill: every game that already started under the old charge-on-create rule was
-- paid for at creation time, so mark it charged to keep history honest.
UPDATE "Game" SET "creditChargedAt" = COALESCE("startedAt", "createdAt")
WHERE "creditChargedAt" IS NULL AND "startedAt" IS NOT NULL;
