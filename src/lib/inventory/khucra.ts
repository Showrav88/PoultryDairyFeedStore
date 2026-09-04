/**
 * Khucra (fractional bag) inventory engine.
 *
 * Problem: Shops buy feed in big bags (e.g. 50kg) but sell in small
 * quantities (100g, 250g, 500g). We must track:
 *   - How many sealed bags remain
 *   - How much is left in the currently open bag
 *   - Total stock in smallest unit (grams/ml)
 *
 * All math uses integers in the smallest unit to avoid floating-point errors.
 */

export interface InventoryState {
  stockInSmallestUnit: number;
  closedPackages: number;
  openPackageRemaining: number;
  basePackageSize: number;
}

export interface DeductResult {
  success: boolean;
  error?: string;
  newState: InventoryState;
  bagsOpened: number;
  deducted: number;
}

export interface AddStockResult {
  newState: InventoryState;
  added: number;
}

/** Convert display unit to smallest unit */
export function toSmallestUnit(
  amount: number,
  unit: "GRAM" | "KG" | "ML" | "LITER" | "BAG",
  basePackageSize: number
): number {
  switch (unit) {
    case "GRAM":
      return Math.round(amount);
    case "KG":
      return Math.round(amount * 1000);
    case "ML":
      return Math.round(amount);
    case "LITER":
      return Math.round(amount * 1000);
    case "BAG":
      return Math.round(amount * basePackageSize);
    default:
      return Math.round(amount);
  }
}

/** Format smallest unit for display */
export function formatSmallestUnit(
  amount: number,
  weightUnit: string
): string {
  if (amount >= 1000 && (weightUnit === "GRAM" || weightUnit === "KG")) {
    const kg = amount / 1000;
    return kg % 1 === 0 ? `${kg} kg` : `${kg.toFixed(2)} kg`;
  }
  if (amount >= 1000 && (weightUnit === "ML" || weightUnit === "LITER")) {
    const liters = amount / 1000;
    return liters % 1 === 0 ? `${liters} L` : `${liters.toFixed(2)} L`;
  }
  const suffix = weightUnit === "ML" || weightUnit === "LITER" ? "ml" : "g";
  return `${amount} ${suffix}`;
}

/** Build sell unit label from smallest unit amount */
export function sellUnitLabel(amountInSmallestUnit: number, basePackageSize: number): string {
  if (amountInSmallestUnit === basePackageSize) return "1 Bag";
  if (amountInSmallestUnit >= 1000) {
    const kg = amountInSmallestUnit / 1000;
    return kg % 1 === 0 ? `${kg} kg` : `${kg.toFixed(2)} kg`;
  }
  return `${amountInSmallestUnit}g`;
}

/**
 * Deduct stock for a khucra or full-bag sale.
 * Automatically opens bags when the open bag doesn't have enough.
 */
export function deductStock(
  state: InventoryState,
  amountInSmallestUnit: number
): DeductResult {
  const { basePackageSize } = state;

  if (amountInSmallestUnit <= 0) {
    return { success: false, error: "Invalid quantity", newState: state, bagsOpened: 0, deducted: 0 };
  }

  const totalAvailable =
    state.closedPackages * basePackageSize + state.openPackageRemaining;

  if (totalAvailable < amountInSmallestUnit) {
    return {
      success: false,
      error: `Insufficient stock. Available: ${formatSmallestUnit(totalAvailable, "GRAM")}, Requested: ${formatSmallestUnit(amountInSmallestUnit, "GRAM")}`,
      newState: state,
      bagsOpened: 0,
      deducted: 0,
    };
  }

  let { closedPackages, openPackageRemaining, stockInSmallestUnit } = state;
  let bagsOpened = 0;
  let remaining = amountInSmallestUnit;

  // Use open bag first
  if (openPackageRemaining >= remaining) {
    openPackageRemaining -= remaining;
    remaining = 0;
  } else {
    remaining -= openPackageRemaining;
    openPackageRemaining = 0;

    // Open new bags as needed
    while (remaining > 0) {
      if (closedPackages <= 0) break;
      closedPackages -= 1;
      bagsOpened += 1;
      openPackageRemaining = basePackageSize;

      if (openPackageRemaining >= remaining) {
        openPackageRemaining -= remaining;
        remaining = 0;
      } else {
        remaining -= openPackageRemaining;
        openPackageRemaining = 0;
      }
    }
  }

  stockInSmallestUnit -= amountInSmallestUnit;

  return {
    success: true,
    newState: {
      stockInSmallestUnit,
      closedPackages,
      openPackageRemaining,
      basePackageSize,
    },
    bagsOpened,
    deducted: amountInSmallestUnit,
  };
}

/**
 * Add stock when purchasing from a buyer (full bags/packages).
 */
export function addStock(
  state: InventoryState,
  packages: number
): AddStockResult {
  const added = packages * state.basePackageSize;
  return {
    added,
    newState: {
      ...state,
      closedPackages: state.closedPackages + packages,
      stockInSmallestUnit: state.stockInSmallestUnit + added,
    },
  };
}

/** Restore stock when admin approves a farm return (reverse of deduct). */
export function restoreStock(
  state: InventoryState,
  amountInSmallestUnit: number
): AddStockResult {
  if (amountInSmallestUnit <= 0) {
    return { added: 0, newState: state };
  }

  let { closedPackages, openPackageRemaining, stockInSmallestUnit, basePackageSize } = state;
  stockInSmallestUnit += amountInSmallestUnit;
  let remaining = amountInSmallestUnit;

  if (openPackageRemaining > 0 && openPackageRemaining < basePackageSize) {
    const space = basePackageSize - openPackageRemaining;
    const fill = Math.min(remaining, space);
    openPackageRemaining += fill;
    remaining -= fill;
  }

  const fullBags = Math.floor(remaining / basePackageSize);
  closedPackages += fullBags;
  remaining -= fullBags * basePackageSize;

  if (remaining > 0) {
    if (openPackageRemaining === 0) {
      openPackageRemaining = remaining;
    } else {
      openPackageRemaining += remaining;
      if (openPackageRemaining > basePackageSize) {
        closedPackages += Math.floor(openPackageRemaining / basePackageSize);
        openPackageRemaining = openPackageRemaining % basePackageSize;
      }
    }
  }

  return {
    added: amountInSmallestUnit,
    newState: {
      stockInSmallestUnit,
      closedPackages,
      openPackageRemaining,
      basePackageSize,
    },
  };
}

/**
 * Get inventory summary for analytics display.
 */
export function getInventorySummary(state: InventoryState) {
  const totalInPackages =
    state.closedPackages +
    (state.openPackageRemaining > 0 ? 1 : 0);
  const openBagPercent =
    state.openPackageRemaining > 0
      ? Math.round((state.openPackageRemaining / state.basePackageSize) * 100)
      : 0;

  return {
    totalStock: state.stockInSmallestUnit,
    closedBags: state.closedPackages,
    openBagRemaining: state.openPackageRemaining,
    openBagPercent,
    totalInPackages,
    formattedTotal: formatSmallestUnit(state.stockInSmallestUnit, "GRAM"),
    formattedOpenBag: state.openPackageRemaining > 0
      ? formatSmallestUnit(state.openPackageRemaining, "GRAM")
      : null,
  };
}

/** Standard khucra presets for poultry/dairy feed shops */
export const KHUCRA_PRESETS = [
  { label: "100g", value: 100 },
  { label: "250g", value: 250 },
  { label: "500g", value: 500 },
  { label: "1 kg", value: 1000 },
  { label: "2 kg", value: 2000 },
  { label: "5 kg", value: 5000 },
] as const;
