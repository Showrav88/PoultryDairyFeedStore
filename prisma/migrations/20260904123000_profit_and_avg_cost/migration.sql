-- Weighted avg cost on products + profit fields on sales

ALTER TABLE "Product" ADD COLUMN "avgCostPerSmallestUnit" DECIMAL(12,6) NOT NULL DEFAULT 0;

ALTER TABLE "Sale" ADD COLUMN "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN "totalProfit" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "SaleItem" ADD COLUMN "costPerSmallestUnit" DECIMAL(12,6) NOT NULL DEFAULT 0;
ALTER TABLE "SaleItem" ADD COLUMN "costTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "SaleItem" ADD COLUMN "profit" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Backfill avg cost from purchase history (approximate for existing stock)
UPDATE "Product" p
SET "avgCostPerSmallestUnit" = sub.avg_cost
FROM (
  SELECT
    pi."productId",
    CASE
      WHEN SUM(pi.quantity * pr."basePackageSize") > 0
      THEN SUM(pi."costPriceTotal") / SUM(pi.quantity * pr."basePackageSize")
      ELSE 0
    END AS avg_cost
  FROM "PurchaseItem" pi
  INNER JOIN "Product" pr ON pr.id = pi."productId"
  GROUP BY pi."productId"
) sub
WHERE p.id = sub."productId";
