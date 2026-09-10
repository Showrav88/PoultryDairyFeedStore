import type { PrismaClient } from "@/generated/prisma/client";

export interface ProductPrices {
  sellPrice: number;
  defaultCostPrice: number | null;
  defaultTpPrice: number | null;
}

type DbClient = Pick<PrismaClient, "productPriceHistory">;

export function toProductPrices(product: {
  sellPrice: unknown;
  defaultCostPrice?: unknown | null;
  defaultTpPrice?: unknown | null;
}): ProductPrices {
  return {
    sellPrice: Number(product.sellPrice),
    defaultCostPrice:
      product.defaultCostPrice != null ? Number(product.defaultCostPrice) : null,
    defaultTpPrice:
      product.defaultTpPrice != null ? Number(product.defaultTpPrice) : null,
  };
}

export function productPricesChanged(
  before: ProductPrices | null,
  after: ProductPrices
): boolean {
  if (!before) return true;
  return (
    before.sellPrice !== after.sellPrice ||
    (before.defaultCostPrice ?? null) !== (after.defaultCostPrice ?? null) ||
    (before.defaultTpPrice ?? null) !== (after.defaultTpPrice ?? null)
  );
}

export async function recordProductPriceHistoryIfChanged(
  db: DbClient,
  shopId: string,
  productId: string,
  before: ProductPrices | null,
  after: ProductPrices
) {
  if (!productPricesChanged(before, after)) return;

  await db.productPriceHistory.create({
    data: {
      shopId,
      productId,
      sellPrice: after.sellPrice,
      defaultCostPrice: after.defaultCostPrice,
      defaultTpPrice: after.defaultTpPrice,
    },
  });
}

export interface ProductPriceHistoryRow {
  id: string;
  sellPrice: number;
  defaultCostPrice: number | null;
  defaultTpPrice: number | null;
  createdAt: string;
  sellDelta: number | null;
  costDelta: number | null;
  tpDelta: number | null;
}

export function withPriceDeltas(
  rows: Array<{
    id: string;
    sellPrice: unknown;
    defaultCostPrice?: unknown | null;
    defaultTpPrice?: unknown | null;
    createdAt: Date;
  }>
): ProductPriceHistoryRow[] {
  const sorted = [...rows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  return sorted.map((row, index) => {
    const sellPrice = Number(row.sellPrice);
    const defaultCostPrice =
      row.defaultCostPrice != null ? Number(row.defaultCostPrice) : null;
    const defaultTpPrice =
      row.defaultTpPrice != null ? Number(row.defaultTpPrice) : null;

    const prev = index > 0 ? sorted[index - 1] : null;
    const prevSell = prev ? Number(prev.sellPrice) : null;
    const prevCost =
      prev?.defaultCostPrice != null ? Number(prev.defaultCostPrice) : null;
    const prevTp =
      prev?.defaultTpPrice != null ? Number(prev.defaultTpPrice) : null;

    return {
      id: row.id,
      sellPrice,
      defaultCostPrice,
      defaultTpPrice,
      createdAt: row.createdAt.toISOString(),
      sellDelta: prevSell != null ? sellPrice - prevSell : null,
      costDelta:
        prevCost != null && defaultCostPrice != null
          ? defaultCostPrice - prevCost
          : null,
      tpDelta:
        prevTp != null && defaultTpPrice != null
          ? defaultTpPrice - prevTp
          : null,
    };
  });
}
