-- AlterTable
ALTER TABLE "Farmer" ADD COLUMN "lifetimeSpend" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Backfill from existing farmer sales
UPDATE "Farmer" f
SET "lifetimeSpend" = COALESCE(
  (SELECT SUM(s."totalAmount") FROM "Sale" s WHERE s."farmerId" = f.id),
  0
);
