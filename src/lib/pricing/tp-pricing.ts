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

/** Phase 3: legacy purchases with open supplier due can get manual TP entry. */
export function canApplyLegacyTp(purchase: {
  pricingModel?: string | null;
  dueAmount: number | unknown;
}): boolean {
  return purchase.pricingModel === "LEGACY" && Number(purchase.dueAmount) > 0;
}

export type LegacyTpLineInput = {
  itemId: string;
  costPricePerUnit: number;
  quantity: number;
  tpPricePerUnit: number;
};

export function buildLegacyTpConversion(
  lines: LegacyTpLineInput[],
  paidAmount: number
): {
  totalTpAmount: number;
  lineUpdates: Array<{ itemId: string; tpPricePerUnit: number; tpPriceTotal: number }>;
  newDue: number;
  newStatus: "DUE" | "PARTIAL" | "PAID";
} {
  if (lines.length === 0) {
    throw new Error("At least one purchase line is required");
  }

  const lineUpdates: Array<{ itemId: string; tpPricePerUnit: number; tpPriceTotal: number }> = [];
  let totalTpAmount = 0;

  for (const line of lines) {
    const tpError = validatePurchaseTpLine(line.costPricePerUnit, line.tpPricePerUnit);
    if (tpError) throw new Error(tpError);
    if (line.tpPricePerUnit <= 0) {
      throw new Error("Enter TP price for every line");
    }
    const tpPriceTotal = computePurchaseLineTpTotal(line.quantity, line.tpPricePerUnit);
    totalTpAmount += tpPriceTotal;
    lineUpdates.push({
      itemId: line.itemId,
      tpPricePerUnit: line.tpPricePerUnit,
      tpPriceTotal,
    });
  }

  if (paidAmount > totalTpAmount) {
    throw new Error("Paid amount exceeds new supplier payable total");
  }

  const newDue = Math.max(0, totalTpAmount - paidAmount);
  let newStatus: "DUE" | "PARTIAL" | "PAID" = "DUE";
  if (paidAmount >= totalTpAmount) newStatus = "PAID";
  else if (paidAmount > 0) newStatus = "PARTIAL";

  return { totalTpAmount, lineUpdates, newDue, newStatus };
}
