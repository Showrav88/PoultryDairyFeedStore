-- CreateTable
CREATE TABLE "FarmerPayment" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "saleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmerPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FarmerPaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "saleId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "FarmerPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FarmerPayment_shopId_idx" ON "FarmerPayment"("shopId");
CREATE INDEX "FarmerPayment_farmerId_idx" ON "FarmerPayment"("farmerId");
CREATE INDEX "FarmerPayment_farmerId_createdAt_idx" ON "FarmerPayment"("farmerId", "createdAt");
CREATE INDEX "FarmerPaymentAllocation_paymentId_idx" ON "FarmerPaymentAllocation"("paymentId");
CREATE INDEX "FarmerPaymentAllocation_saleId_idx" ON "FarmerPaymentAllocation"("saleId");

-- AddForeignKey
ALTER TABLE "FarmerPayment" ADD CONSTRAINT "FarmerPayment_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FarmerPaymentAllocation" ADD CONSTRAINT "FarmerPaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "FarmerPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FarmerPaymentAllocation" ADD CONSTRAINT "FarmerPaymentAllocation_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
