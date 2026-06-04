-- Seen-Jeem mode: new GameMode value, Lifeline enum, and lifeline-usage audit.

-- AlterEnum: add the SEEN_JEEM mode. (ADD VALUE is not used as a column default
-- in this migration, so it is safe to run alongside the statements below.)
ALTER TYPE "GameMode" ADD VALUE IF NOT EXISTS 'SEEN_JEEM';

-- CreateEnum
CREATE TYPE "Lifeline" AS ENUM ('CALL_FRIEND', 'DISCARD', 'DOUBLE');

-- CreateTable
CREATE TABLE "LifelineUsage" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "lifeline" "Lifeline" NOT NULL,
    "cellId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LifelineUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LifelineUsage_gameId_teamId_lifeline_key" ON "LifelineUsage"("gameId", "teamId", "lifeline");

-- CreateIndex
CREATE INDEX "LifelineUsage_gameId_teamId_idx" ON "LifelineUsage"("gameId", "teamId");

-- AddForeignKey
ALTER TABLE "LifelineUsage" ADD CONSTRAINT "LifelineUsage_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
