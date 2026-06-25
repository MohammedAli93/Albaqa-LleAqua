-- Player profile stats: add a "team wins" counter alongside points/elimination wins.
-- The client wants each player's profile to show wins by points, by elimination, and by teams.

ALTER TABLE "Player" ADD COLUMN "teamWins" INTEGER NOT NULL DEFAULT 0;
