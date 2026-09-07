export type CustomerTier = "bronze" | "silver" | "gold" | "platinum";

export interface TierInfo {
  tier: CustomerTier;
  label: string;
  minSpend: number;
  maxSpend: number | null;
}

const TIERS: TierInfo[] = [
  { tier: "bronze", label: "Bronze", minSpend: 0, maxSpend: 19_999 },
  { tier: "silver", label: "Silver", minSpend: 20_000, maxSpend: 39_999 },
  { tier: "gold", label: "Gold", minSpend: 40_000, maxSpend: 59_999 },
  { tier: "platinum", label: "Platinum", minSpend: 60_000, maxSpend: null },
];

export function getCustomerTier(lifetimeSpend: number): TierInfo {
  const spend = Math.max(0, lifetimeSpend);
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (spend >= TIERS[i].minSpend) return TIERS[i];
  }
  return TIERS[0];
}

export function getTierProgress(lifetimeSpend: number): {
  current: TierInfo;
  next: TierInfo | null;
  amountToNext: number | null;
} {
  const current = getCustomerTier(lifetimeSpend);
  const idx = TIERS.findIndex((t) => t.tier === current.tier);
  const next = idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
  return {
    current,
    next,
    amountToNext: next ? Math.max(0, next.minSpend - lifetimeSpend) : null,
  };
}
