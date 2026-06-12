-- Free-vs-paid tier: link a host to their Player account and add a one-time UNLOCK product kind.

-- Game now optionally references the host's Player account (null = anonymous/guest host).
ALTER TABLE "Game" ADD COLUMN "hostPlayerId" TEXT;

CREATE INDEX "Game_hostPlayerId_idx" ON "Game"("hostPlayerId");

ALTER TABLE "Game" ADD CONSTRAINT "Game_hostPlayerId_fkey"
  FOREIGN KEY ("hostPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- New product kind for a permanent, one-time unlock (the paid 35-question tier).
ALTER TYPE "ProductKind" ADD VALUE 'UNLOCK';
