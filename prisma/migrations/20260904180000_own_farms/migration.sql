-- CreateEnum
CREATE TYPE "FarmAnimalType" AS ENUM ('POULTRY', 'COW', 'FISH', 'DUCK', 'GOAT', 'SHEEP', 'RABBIT', 'OTHER');
CREATE TYPE "FarmReturnStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "FarmExpenseType" AS ENUM ('SALARY', 'BILL', 'UTILITY', 'OTHER');
CREATE TYPE "FarmLivestockTxType" AS ENUM ('BUY', 'SELL');

-- AlterEnum
ALTER TYPE "WalletTxType" ADD VALUE 'FARM_ISSUE';
ALTER TYPE "WalletTxType" ADD VALUE 'FARM_RETURN';
ALTER TYPE "WalletTxType" ADD VALUE 'FARM_EXPENSE';
ALTER TYPE "WalletTxType" ADD VALUE 'FARM_LIVESTOCK_BUY';
ALTER TYPE "WalletTxType" ADD VALUE 'FARM_LIVESTOCK_SELL';

-- AlterEnum
ALTER TYPE "AuditEntity" ADD VALUE 'FARM';

-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "animalType" "FarmAnimalType" NOT NULL DEFAULT 'OTHER',
    "location" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FarmIssue" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FarmIssueItem" (
    "id" TEXT NOT NULL,
    "farmIssueId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityInSmallestUnit" INTEGER NOT NULL,
    "sellUnitLabel" TEXT NOT NULL,
    "unitCount" INTEGER NOT NULL DEFAULT 1,
    "costPerSmallestUnit" DECIMAL(12,6) NOT NULL,
    "costTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "FarmIssueItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FarmReturn" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "farmIssueId" TEXT,
    "status" "FarmReturnStatus" NOT NULL DEFAULT 'PENDING',
    "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmReturn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FarmReturnItem" (
    "id" TEXT NOT NULL,
    "farmReturnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityInSmallestUnit" INTEGER NOT NULL,
    "sellUnitLabel" TEXT NOT NULL,
    "unitCount" INTEGER NOT NULL DEFAULT 1,
    "costPerSmallestUnit" DECIMAL(12,6) NOT NULL,
    "costTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "FarmReturnItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FarmExpense" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "type" "FarmExpenseType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmExpense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FarmLivestockTransaction" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "type" "FarmLivestockTxType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmLivestockTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Farm_shopId_idx" ON "Farm"("shopId");
CREATE INDEX "Farm_shopId_name_idx" ON "Farm"("shopId", "name");
CREATE INDEX "FarmIssue_shopId_idx" ON "FarmIssue"("shopId");
CREATE INDEX "FarmIssue_farmId_idx" ON "FarmIssue"("farmId");
CREATE INDEX "FarmIssue_farmId_createdAt_idx" ON "FarmIssue"("farmId", "createdAt");
CREATE INDEX "FarmIssueItem_farmIssueId_idx" ON "FarmIssueItem"("farmIssueId");
CREATE INDEX "FarmReturn_shopId_idx" ON "FarmReturn"("shopId");
CREATE INDEX "FarmReturn_farmId_idx" ON "FarmReturn"("farmId");
CREATE INDEX "FarmReturn_farmId_status_idx" ON "FarmReturn"("farmId", "status");
CREATE INDEX "FarmReturnItem_farmReturnId_idx" ON "FarmReturnItem"("farmReturnId");
CREATE INDEX "FarmExpense_shopId_idx" ON "FarmExpense"("shopId");
CREATE INDEX "FarmExpense_farmId_idx" ON "FarmExpense"("farmId");
CREATE INDEX "FarmExpense_farmId_createdAt_idx" ON "FarmExpense"("farmId", "createdAt");
CREATE INDEX "FarmLivestockTransaction_shopId_idx" ON "FarmLivestockTransaction"("shopId");
CREATE INDEX "FarmLivestockTransaction_farmId_idx" ON "FarmLivestockTransaction"("farmId");
CREATE INDEX "FarmLivestockTransaction_farmId_createdAt_idx" ON "FarmLivestockTransaction"("farmId", "createdAt");

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FarmIssue" ADD CONSTRAINT "FarmIssue_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FarmIssueItem" ADD CONSTRAINT "FarmIssueItem_farmIssueId_fkey" FOREIGN KEY ("farmIssueId") REFERENCES "FarmIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FarmIssueItem" ADD CONSTRAINT "FarmIssueItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FarmReturn" ADD CONSTRAINT "FarmReturn_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FarmReturnItem" ADD CONSTRAINT "FarmReturnItem_farmReturnId_fkey" FOREIGN KEY ("farmReturnId") REFERENCES "FarmReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FarmReturnItem" ADD CONSTRAINT "FarmReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FarmExpense" ADD CONSTRAINT "FarmExpense_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FarmLivestockTransaction" ADD CONSTRAINT "FarmLivestockTransaction_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
