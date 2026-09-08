-- TP pricing Phase 1: schema only — no backfill of TP values on existing records

-- CreateEnum
CREATE TYPE "PurchasePricingModel" AS ENUM ('LEGACY', 'DUAL');

-- AlterTable Product
ALTER TABLE "Product" ADD COLUMN "defaultCostPrice" DECIMAL(12,2),
ADD COLUMN "defaultTpPrice" DECIMAL(12,2);

-- AlterTable Purchase
ALTER TABLE "Purchase" ADD COLUMN "totalTpAmount" DECIMAL(12,2),
ADD COLUMN "pricingModel" "PurchasePricingModel" NOT NULL DEFAULT 'LEGACY';

-- AlterTable PurchaseItem
ALTER TABLE "PurchaseItem" ADD COLUMN "tpPricePerUnit" DECIMAL(12,2),
ADD COLUMN "tpPriceTotal" DECIMAL(12,2);

-- AlterTable Sale
ALTER TABLE "Sale" ADD COLUMN "totalTpProfit" DECIMAL(12,2);

-- AlterTable SaleItem
ALTER TABLE "SaleItem" ADD COLUMN "tpPerSmallestUnit" DECIMAL(12,6),
ADD COLUMN "tpTotal" DECIMAL(12,2),
ADD COLUMN "tpProfit" DECIMAL(12,2);
