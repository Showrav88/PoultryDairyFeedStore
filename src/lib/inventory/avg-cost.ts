/**
 * Weighted average cost (WAC) per smallest unit (grams/ml/pieces).
 * Updated on each purchase; snapshot at sale time for profit.
 */

export function computeWeightedAvgCost(
  currentStock: number,
  currentAvgCost: number,
  addedUnits: number,
  purchaseCostTotal: number
): number {
  if (addedUnits <= 0) return currentAvgCost;
  if (purchaseCostTotal < 0) return currentAvgCost;

  const addedCostPerUnit = purchaseCostTotal / addedUnits;
  if (currentStock <= 0) return addedCostPerUnit;

  const totalValue = currentStock * currentAvgCost + purchaseCostTotal;
  const totalUnits = currentStock + addedUnits;
  return totalValue / totalUnits;
}

export function computeLineProfit(
  quantityInSmallestUnit: number,
  lineTotal: number,
  costPerSmallestUnit: number
): { costTotal: number; profit: number } {
  const costTotal = quantityInSmallestUnit * costPerSmallestUnit;
  const profit = lineTotal - costTotal;
  return { costTotal, profit };
}

export function formatAvgCostPerKg(costPerSmallestUnit: number): string {
  if (costPerSmallestUnit <= 0) return "—";
  return `৳${(costPerSmallestUnit * 1000).toFixed(2)}/kg`;
}
