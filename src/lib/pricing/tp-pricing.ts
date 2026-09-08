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

/** Per-package purchase line TP total (qty × tp per bag/package). */
export function computePurchaseLineTpTotal(
  quantity: number,
  tpPricePerUnit: number
): number {
  if (quantity <= 0 || tpPricePerUnit <= 0) return 0;
  return quantity * tpPricePerUnit;
}

export function validatePurchaseTpLine(
  costPricePerUnit: number,
  tpPricePerUnit: number | null | undefined
): string | null {
  const tp = tpPricePerUnit ?? 0;
  if (tp <= 0) return null;
  if (costPricePerUnit <= 0) {
    return "Set cost price when TP price is set";
  }
  if (tp < costPricePerUnit) {
    return "TP price must be at least the cost price";
  }
  return null;
}

/** Amount owed to supplier — TP total for DUAL purchases, cost total for LEGACY. */
export function getPurchasePayableTotal(purchase: {
  pricingModel?: string | null;
  totalCost: number | unknown;
  totalTpAmount?: number | unknown | null;
}): number {
  if (purchase.pricingModel === "DUAL" && purchase.totalTpAmount != null) {
    return Number(purchase.totalTpAmount);
  }
  return Number(purchase.totalCost);
}

export function resolvePurchasePricingModel(
  items: { tpPricePerUnit?: number | null; tpPriceTotal?: number | null }[]
): "LEGACY" | "DUAL" {
  const hasTp = items.some(
    (i) => (i.tpPricePerUnit ?? 0) > 0 || (i.tpPriceTotal ?? 0) > 0
  );
  return hasTp ? "DUAL" : "LEGACY";
}
