-- CreateTable
CREATE TABLE "Farmer" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "openingDue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farmer_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "farmerId" TEXT;

-- CreateIndex
CREATE INDEX "Farmer_shopId_idx" ON "Farmer"("shopId");
CREATE INDEX "Farmer_shopId_name_idx" ON "Farmer"("shopId", "name");
CREATE INDEX "Farmer_shopId_phone_idx" ON "Farmer"("shopId", "phone");
CREATE INDEX "Sale_shopId_farmerId_idx" ON "Sale"("shopId", "farmerId");

-- AddForeignKey
ALTER TABLE "Farmer" ADD CONSTRAINT "Farmer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
