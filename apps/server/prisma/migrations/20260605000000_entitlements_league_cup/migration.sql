-- League/Cup modes + play-access entitlements (البقاء للأقوى).

-- AlterEnum: new game modes
ALTER TYPE "GameMode" ADD VALUE IF NOT EXISTS 'LEAGUE';
ALTER TYPE "GameMode" ADD VALUE IF NOT EXISTS 'CUP';

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('CREDITS', 'TIME_PASS');

-- AlterTable: Order can now reference a Product (entitlement) instead of a Package,
-- and carries the host account id. packageId becomes optional.
ALTER TABLE "Order" ALTER COLUMN "packageId" DROP NOT NULL;
ALTER TABLE "Order" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Order" ADD COLUMN "productId" TEXT;

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "kind" "ProductKind" NOT NULL,
    "credits" INTEGER,
    "durationMinutes" INTEGER,
    "priceMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "freeGameUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePass" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "productId" TEXT,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamePass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE UNIQUE INDEX "Wallet_ownerId_key" ON "Wallet"("ownerId");
CREATE INDEX "GamePass_ownerId_expiresAt_idx" ON "GamePass"("ownerId", "expiresAt");
CREATE INDEX "Order_ownerId_status_idx" ON "Order"("ownerId", "status");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GamePass" ADD CONSTRAINT "GamePass_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
