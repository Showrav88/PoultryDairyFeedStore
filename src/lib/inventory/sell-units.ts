export type ProductUnitType = "BAG" | "GRAM" | "KG" | "LITER" | "ML" | "PIECE" | "GENERIC";

export interface SellPreset {
  label: string;
  value: number;
}

export const PRODUCT_TYPE_TEMPLATES: Record<
  string,
  {
    weightUnit: ProductUnitType;
    basePackageSize: number;
    allowedSellUnits: number[];
    label: string;
    description: string;
    defaultBagSizeKg?: number;
    defaultBottleMl?: number;
  }
> = {
  feed_bag: {
    label: "Feed / Bag Product",
    description: "Buy full bags in Purchases. Sell khucra (small qty) or full bag on counter.",
    weightUnit: "BAG",
    basePackageSize: 50000,
    defaultBagSizeKg: 50,
    allowedSellUnits: [100, 250, 500, 1000, 2000, 5000, 50000],
  },
  eggs: {
    label: "Eggs / Pieces",
    description: "Sold by piece or dozen. Stock counted in pieces.",
    weightUnit: "PIECE",
    basePackageSize: 1,
    allowedSellUnits: [1, 6, 12, 30],
  },
  medicine: {
    label: "Medicine / Small Item",
    description: "Sold per piece or bottle. One unit = one item.",
    weightUnit: "PIECE",
    basePackageSize: 1,
    allowedSellUnits: [1],
  },
  liquid: {
    label: "Liquid (Medicine/Oil)",
    description: "Buy bottles in Purchases. Sell by ml or full bottle.",
    weightUnit: "ML",
    basePackageSize: 1000,
    defaultBottleMl: 1000,
    allowedSellUnits: [100, 250, 500, 1000],
  },
  generic: {
    label: "Other / Generic",
    description: "Simple count-based product.",
    weightUnit: "GENERIC",
    basePackageSize: 1,
    allowedSellUnits: [1],
  },
};

export function gramsToDisplayKg(grams: number): number {
  return grams / 1000;
}

export function kgToGrams(kg: number): number {
  return Math.round(kg * 1000);
}

export function getPackageSizeLabel(weightUnit: string): string {
  switch (weightUnit) {
    case "BAG":
    case "GRAM":
    case "KG":
      return "Bag size (kg)";
    case "ML":
    case "LITER":
      return "Bottle size (ml)";
    case "PIECE":
    case "GENERIC":
      return "Units per pack";
    default:
      return "Package size";
  }
}

export function getSellPresets(weightUnit: string, basePackageSize: number): SellPreset[] {
  const presets: SellPreset[] = [];

  switch (weightUnit) {
    case "BAG":
    case "GRAM":
    case "KG":
      [100, 250, 500, 1000, 2000, 5000].forEach((v) => presets.push({ label: formatWeight(v), value: v }));
      if (basePackageSize > 0 && !presets.some((p) => p.value === basePackageSize)) {
        presets.push({ label: `Full Bag (${formatWeight(basePackageSize)})`, value: basePackageSize });
      }
      break;
    case "PIECE":
    case "GENERIC":
      [1, 2, 6, 12, 30].forEach((v) => {
        if (v <= basePackageSize || basePackageSize === 1) {
          presets.push({ label: v === 1 ? "1 Piece" : `${v} Pieces`, value: v });
        }
      });
      if (basePackageSize > 1) {
        presets.push({ label: `Full Pack (${basePackageSize} pcs)`, value: basePackageSize });
      }
      break;
    case "ML":
    case "LITER":
      [50, 100, 250, 500, 1000].forEach((v) => presets.push({ label: formatVolume(v), value: v }));
      if (basePackageSize > 0) {
        presets.push({ label: `Full Bottle (${formatVolume(basePackageSize)})`, value: basePackageSize });
      }
      break;
    default:
      presets.push({ label: "1 Unit", value: 1 });
  }

  const seen = new Set<number>();
  return presets.filter((p) => {
    if (seen.has(p.value)) return false;
    seen.add(p.value);
    return true;
  });
}

function formatWeight(grams: number) {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return kg % 1 === 0 ? `${kg} kg` : `${kg.toFixed(2)} kg`;
  }
  return `${grams}g`;
}

function formatVolume(ml: number) {
  if (ml >= 1000) return `${ml / 1000} L`;
  return `${ml} ml`;
}

export function formatStockDisplay(amount: number, weightUnit: string, basePackageSize: number) {
  if (weightUnit === "PIECE" || weightUnit === "GENERIC") {
    return `${amount} pcs`;
  }
  if (weightUnit === "ML" || weightUnit === "LITER") {
    return amount >= 1000 ? `${(amount / 1000).toFixed(2)} L` : `${amount} ml`;
  }
  if (amount >= 1000) return `${(amount / 1000).toFixed(2)} kg`;
  return `${amount} g`;
}

export function formatSellUnitLabel(amount: number, weightUnit: string, basePackageSize: number) {
  if (amount === basePackageSize && basePackageSize > 1) {
    return formatFullPackageLabel(basePackageSize, weightUnit);
  }
  if (weightUnit === "PIECE" || weightUnit === "GENERIC") {
    return amount === 1 ? "1 Piece" : `${amount} Pieces`;
  }
  if (weightUnit === "ML" || weightUnit === "LITER") {
    return amount >= 1000 ? `${amount / 1000} L` : `${amount} ml`;
  }
  if (amount >= 1000) {
    const kg = amount / 1000;
    return kg % 1 === 0 ? `${kg} kg` : `${kg.toFixed(2)} kg`;
  }
  return `${amount}g`;
}

export type CustomSellUnit = "GRAM" | "KG" | "PIECE" | "ML" | "LITER";

export function getCustomUnitOptions(weightUnit: string): { value: CustomSellUnit; label: string }[] {
  if (weightUnit === "PIECE" || weightUnit === "GENERIC") {
    return [{ value: "PIECE", label: "Pieces" }];
  }
  if (weightUnit === "ML" || weightUnit === "LITER") {
    return [
      { value: "ML", label: "ml" },
      { value: "LITER", label: "Liter" },
    ];
  }
  return [
    { value: "GRAM", label: "Gram (g)" },
    { value: "KG", label: "Kilogram (kg)" },
  ];
}

/** Convert user-entered custom amount to smallest unit (grams/ml/pieces) */
export function parseCustomSellAmount(
  amount: number,
  unit: CustomSellUnit
): number {
  if (amount <= 0) return 0;
  switch (unit) {
    case "KG":
      return Math.round(amount * 1000);
    case "LITER":
      return Math.round(amount * 1000);
    case "GRAM":
    case "ML":
    case "PIECE":
      return Math.round(amount);
    default:
      return Math.round(amount);
  }
}

export function supportsFullPackageSale(weightUnit: string): boolean {
  return ["BAG", "GRAM", "KG", "ML", "LITER", "PIECE", "GENERIC"].includes(weightUnit);
}

export function formatFullPackageLabel(basePackageSize: number, weightUnit: string): string {
  if (weightUnit === "PIECE" || weightUnit === "GENERIC") {
    return `Full Pack (${basePackageSize} pcs)`;
  }
  if (weightUnit === "ML" || weightUnit === "LITER") {
    return `Full Bottle (${formatVolume(basePackageSize)})`;
  }
  return `Full Bag (${formatWeight(basePackageSize)})`;
}

/** Khucra presets only — excludes full bag/pack size */
export function getKhucraSellUnits(allowedSellUnits: number[], basePackageSize: number): number[] {
  const units = allowedSellUnits.filter((u) => u !== basePackageSize);
  return [...new Set(units)].sort((a, b) => a - b);
}

export function isFullPackageUnit(amount: number, basePackageSize: number): boolean {
  return basePackageSize > 1 && amount === basePackageSize;
}
