export type ProductUnitType = "BAG" | "GRAM" | "KG" | "LITER" | "ML" | "PIECE" | "GENERIC";

export interface SellPreset {
  label: string;
  value: number;
}

/** Small gram presets always available on feed khucra. */
export const FEED_SMALL_PRESETS = [100, 250, 500, 1000] as const;

export function isFeedWeightUnit(weightUnit: string): boolean {
  return weightUnit === "BAG" || weightUnit === "GRAM" || weightUnit === "KG";
}

/** Max khucra preset size: 25 kg bag → 20 kg, 50 kg → 30 kg, else bag − 5 kg. */
export function getKhucraMaxGrams(basePackageSizeGrams: number): number {
  const kg = basePackageSizeGrams / 1000;
  if (Math.abs(kg - 25) < 0.01) return 20000;
  if (Math.abs(kg - 50) < 0.01) return 30000;
  return Math.max(1000, basePackageSizeGrams - 5000);
}

/** Khucra-only units for feed (small grams + 5 kg steps up to khucra max). Excludes full bag. */
export function generateFeedAllowedSellUnits(basePackageSizeGrams: number): number[] {
  if (basePackageSizeGrams <= 0) return [...FEED_SMALL_PRESETS];
  const maxKhucra = getKhucraMaxGrams(basePackageSizeGrams);
  const kgSteps: number[] = [];
  for (let g = 5000; g <= maxKhucra; g += 5000) {
    kgSteps.push(g);
  }
  return [...FEED_SMALL_PRESETS, ...kgSteps];
}

export function normalizeAllowedSellUnits(
  weightUnit: string,
  basePackageSize: number,
  provided?: number[]
): number[] {
  if (isFeedWeightUnit(weightUnit)) {
    return generateFeedAllowedSellUnits(basePackageSize);
  }
  return provided && provided.length > 0 ? provided : [100, 250, 500, 1000];
}

function sellUnitsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

export function feedSellUnitsNeedSync(
  weightUnit: string,
  basePackageSize: number,
  allowedSellUnits: number[]
): boolean {
  if (!isFeedWeightUnit(weightUnit)) return false;
  const expected = generateFeedAllowedSellUnits(basePackageSize);
  return !sellUnitsEqual(allowedSellUnits, expected);
}

export interface SellUnitProductInput {
  weightUnit: string;
  basePackageSize: number;
  allowedSellUnits: number[];
}

/** Sell counter order: full bag first, then khucra largest → smallest. */
export function buildSellUnitOptions(product: SellUnitProductInput): number[] {
  const khucra = getKhucraSellUnits(product.allowedSellUnits, product.basePackageSize);
  const options: number[] = [];

  if (
    supportsFullPackageSale(product.weightUnit) &&
    product.basePackageSize > 1
  ) {
    options.push(product.basePackageSize);
  }

  const sortedKhucra = [...new Set(khucra)].sort((a, b) => b - a);
  for (const u of sortedKhucra) {
    if (!options.includes(u)) options.push(u);
  }

  if (options.length === 0 && product.allowedSellUnits.length > 0) {
    const fallback = [...new Set(product.allowedSellUnits)].sort((a, b) => b - a);
    if (
      supportsFullPackageSale(product.weightUnit) &&
      product.basePackageSize > 1 &&
      !fallback.includes(product.basePackageSize)
    ) {
      return [product.basePackageSize, ...fallback];
    }
    return fallback;
  }

  return options;
}

export function getDefaultSellUnitSize(product: SellUnitProductInput): number {
  const options = buildSellUnitOptions(product);
  return options[0] ?? product.basePackageSize;
}

/** Walk-in / khucra default: prefer 1 kg chip, else smallest khucra (not full bag). */
export function getWalkInDefaultSellUnitSize(product: SellUnitProductInput): number {
  const options = buildSellUnitOptions(product);
  const khucraOnly = options.filter((u) => u !== product.basePackageSize);
  if (khucraOnly.length === 0) return options[0] ?? product.basePackageSize;
  const oneKg = khucraOnly.find((u) => u === 1000);
  if (oneKg) return oneKg;
  return khucraOnly[khucraOnly.length - 1];
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
    allowedSellUnits: generateFeedAllowedSellUnits(50000),
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
    case "KG": {
      const khucraUnits = generateFeedAllowedSellUnits(basePackageSize);
      khucraUnits.forEach((v) => presets.push({ label: formatWeight(v), value: v }));
      if (basePackageSize > 0) {
        presets.unshift({
          label: `Full Bag (${formatWeight(basePackageSize)})`,
          value: basePackageSize,
        });
      }
      break;
    }
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
