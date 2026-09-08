/**
 * TP (supplier payout) pricing — per-package defaults converted to per-smallest-unit
 * snapshots at sale time. Phase 1: product defaults only; purchase TP in Phase 2.
 */

export function tpPricePerSmallestUnit(
  defaultTpPricePerPackage: number,
  basePackageSize: number
): number {
  if (defaultTpPricePerPackage <= 0 || basePackageSize <= 0) return 0;
  return defaultTpPricePerPackage / basePackageSize;
}

export function computeLineTpProfit(
  quantityInSmallestUnit: number,
  lineTotal: number,
  tpPerSmallestUnit: number
): { tpPerSmallestUnit: number; tpTotal: number; tpProfit: number } | null {
  if (tpPerSmallestUnit <= 0 || quantityInSmallestUnit <= 0) return null;

  const tpTotal = quantityInSmallestUnit * tpPerSmallestUnit;
  const tpProfit = lineTotal - tpTotal;
  return { tpPerSmallestUnit, tpTotal, tpProfit };
}

export function validateDefaultTpPrice(
  defaultCostPrice: number | null | undefined,
  defaultTpPrice: number | null | undefined
): string | null {
  const cost = defaultCostPrice ?? 0;
  const tp = defaultTpPrice ?? 0;
  if (tp > 0 && cost > 0 && tp < cost) {
    return "TP price must be at least the default cost price";
  }
  if (tp > 0 && cost <= 0) {
    return "Set default cost price when TP price is set";
  }
  return null;
}
