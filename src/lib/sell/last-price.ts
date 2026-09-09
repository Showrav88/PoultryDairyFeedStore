import { calcUnitPriceFromReference } from "../inventory/unit-price";

export type BuyerTypeKey = "FARMER" | "CUSTOMER";

export function lastPriceKey(productId: string, unitSize: number): string {
  return `${productId}:${unitSize}`;
}

export function buildLastPriceMap(
  rows: {
    productId: string;
    unitSizeInSmallestUnit: number;
    pricePerUnit: unknown;
  }[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(
      lastPriceKey(row.productId, row.unitSizeInSmallestUnit),
      Number(row.pricePerUnit)
    );
  }
  return map;
}

export function resolveUnitSellPrice(params: {
  referenceSellPrice: number;
  unitSize: number;
  basePackageSize: number;
  lastPricePerUnit?: number | null;
}): {
  pricePerUnit: number;
  suggestedPricePerUnit: number;
  usedLastPrice: boolean;
} {
  const suggestedPricePerUnit = calcUnitPriceFromReference(
    params.referenceSellPrice,
    params.unitSize,
    params.basePackageSize
  );
  const last = params.lastPricePerUnit ?? 0;
  if (last > 0) {
    return { pricePerUnit: last, suggestedPricePerUnit, usedLastPrice: true };
  }
  return { pricePerUnit: suggestedPricePerUnit, suggestedPricePerUnit, usedLastPrice: false };
}

export function isBelowSuggested(pricePerUnit: number, suggestedPricePerUnit: number): boolean {
  if (suggestedPricePerUnit <= 0 || pricePerUnit <= 0) return false;
  return pricePerUnit < suggestedPricePerUnit - 0.001;
}

/** Cost for one sell unit at given unit size (avg cost × unit size). */
export function costPerSellUnit(
  avgCostPerSmallestUnit: number | null | undefined,
  unitSize: number
): number {
  if (!avgCostPerSmallestUnit || avgCostPerSmallestUnit <= 0 || unitSize <= 0) return 0;
  return avgCostPerSmallestUnit * unitSize;
}

export function isBelowCost(
  pricePerUnit: number,
  avgCostPerSmallestUnit: number | null | undefined,
  unitSize: number
): boolean {
  const cost = costPerSellUnit(avgCostPerSmallestUnit, unitSize);
  if (cost <= 0 || pricePerUnit <= 0) return false;
  return pricePerUnit < cost - 0.001;
}
