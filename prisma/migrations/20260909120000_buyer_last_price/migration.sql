-- CreateEnum
CREATE TYPE "BuyerType" AS ENUM ('FARMER', 'CUSTOMER');

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN "sellUnitSize" INTEGER;
ALTER TABLE "SaleItem" ADD COLUMN "suggestedPricePerUnit" DECIMAL(12,2);
ALTER TABLE "SaleItem" ADD COLUMN "belowSuggested" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BuyerProductLastPrice" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "buyerType" "BuyerType" NOT NULL,
    "buyerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitSizeInSmallestUnit" INTEGER NOT NULL,
    "sellUnitLabel" TEXT NOT NULL,
    "pricePerUnit" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerProductLastPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuyerProductLastPrice_shopId_buyerType_buyerId_idx" ON "BuyerProductLastPrice"("shopId", "buyerType", "buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerProductLastPrice_shopId_buyerType_buyerId_productId_unitSizeInSmallestUnit_key" ON "BuyerProductLastPrice"("shopId", "buyerType", "buyerId", "productId", "unitSizeInSmallestUnit");

-- AddForeignKey
ALTER TABLE "BuyerProductLastPrice" ADD CONSTRAINT "BuyerProductLastPrice_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerProductLastPrice" ADD CONSTRAINT "BuyerProductLastPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
