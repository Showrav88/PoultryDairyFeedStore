/** Human-readable quantity for a farm issue line (e.g. "2 × 5 kg"). */
export function formatIssueLineQuantity(item: {
  unitCount: number;
  sellUnitLabel: string;
}): string {
  if (item.unitCount > 1) {
    return `${item.unitCount} × ${item.sellUnitLabel}`;
  }
  return item.sellUnitLabel;
}

export interface FarmIssueItemRow {
  id: string;
  sellUnitLabel: string;
  unitCount: number;
  costTotal: number | string;
  product: { id: string; name: string };
}

export interface FarmIssueRow {
  id: string;
  totalCost: number | string;
  notes?: string | null;
  createdAt: string;
  items: FarmIssueItemRow[];
  farm?: { id: string; name: string; animalType?: string };
}
