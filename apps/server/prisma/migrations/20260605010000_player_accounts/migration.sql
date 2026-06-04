-- Player accounts (البقاء للأقوى): phone-OTP identity, profile stats, and wiring
-- the entitlement owners (Wallet/GamePass/Order) + Participant to a Player.

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT NOT NULL,
    "country" TEXT,
    "avatarId" TEXT NOT NULL DEFAULT 'falcon',
    "leagueWins" INTEGER NOT NULL DEFAULT 0,
    "cupWins" INTEGER NOT NULL DEFAULT 0,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerOtp" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerOtp_pkey" PRIMARY KEY ("id")
);

-- AlterTable: link a participant to an account (nullable for guest play)
ALTER TABLE "Participant" ADD COLUMN "playerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Player_phone_key" ON "Player"("phone");
CREATE INDEX "Player_country_leagueWins_idx" ON "Player"("country", "leagueWins");
CREATE INDEX "Player_country_cupWins_idx" ON "Player"("country", "cupWins");
CREATE INDEX "PlayerOtp_phone_createdAt_idx" ON "PlayerOtp"("phone", "createdAt");
CREATE INDEX "Participant_playerId_idx" ON "Participant"("playerId");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GamePass" ADD CONSTRAINT "GamePass_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
