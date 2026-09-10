import {
  PRODUCT_TYPE_TEMPLATES,
  feedSellUnitsNeedSync,
  generateFeedAllowedSellUnits,
  gramsToDisplayKg,
  kgToGrams,
  normalizeAllowedSellUnits,
  type SellUnitProductInput,
} from "./sell-units";

export type ProductTypeKey = keyof typeof PRODUCT_TYPE_TEMPLATES;

export function normalizeBasePackageSizeGrams(
  weightUnit: string,
  basePackageSize: number,
  allowedSellUnits: number[] = []
): number {
  if (basePackageSize <= 0) return basePackageSize;

  const feedLikeUnit =
    weightUnit === "BAG" ||
    weightUnit === "KG" ||
    weightUnit === "GRAM" ||
    (weightUnit === "GENERIC" &&
      allowedSellUnits.some((u) => [100, 250, 500, 1000].includes(u)) &&
      allowedSellUnits.length > 1);

  if (!feedLikeUnit) return basePackageSize;
  if (basePackageSize >= 1000) return basePackageSize;
  // Legacy rows stored bag weight as kg (25, 50) instead of grams (25000, 50000).
  if (basePackageSize >= 5 && basePackageSize <= 100) return kgToGrams(basePackageSize);
  return basePackageSize;
}

export function detectProductType(
  weightUnit: string,
  basePackageSize = 1,
  allowedSellUnits: number[] = []
): ProductTypeKey {
  const normalizedSize = normalizeBasePackageSizeGrams(
    weightUnit,
    basePackageSize,
    allowedSellUnits
  );
  if (weightUnit === "BAG" || weightUnit === "KG" || weightUnit === "GRAM") return "feed_bag";
  if (weightUnit === "ML" || weightUnit === "LITER") return "liquid";
  if (weightUnit === "PIECE") return "eggs";
  if (weightUnit === "GENERIC") {
    const looksLikeFeed =
      normalizedSize >= 5000 ||
      (allowedSellUnits.some((u) => [100, 250, 500, 1000].includes(u)) &&
        allowedSellUnits.length > 1);
    if (looksLikeFeed) return "feed_bag";
    return "generic";
  }
  return "feed_bag";
}

export function defaultPackageSizeForType(key: ProductTypeKey): number {
  const template = PRODUCT_TYPE_TEMPLATES[key];
  if (template.defaultBagSizeKg) return template.defaultBagSizeKg;
  if (template.defaultBottleMl) return template.defaultBottleMl;
  if (key === "feed_bag") return gramsToDisplayKg(template.basePackageSize);
  return template.basePackageSize;
}

export function packageDisplaySize(
  weightUnit: string,
  basePackageSize: number,
  productType?: ProductTypeKey,
  allowedSellUnits: number[] = []
): number {
  const normalized = normalizeBasePackageSizeGrams(
    weightUnit,
    basePackageSize,
    allowedSellUnits
  );
  const type =
    productType ?? detectProductType(weightUnit, normalized, allowedSellUnits);
  if (type === "feed_bag") {
    return gramsToDisplayKg(normalized);
  }
  if (type === "liquid") {
    return normalized;
  }
  return normalized;
}

export function packageToBaseSize(weightUnit: string, displaySize: number): number {
  if (weightUnit === "BAG" || weightUnit === "GRAM" || weightUnit === "KG") {
    return kgToGrams(displaySize);
  }
  return Math.round(displaySize);
}

export function productTypeLabel(type: ProductTypeKey): string {
  return PRODUCT_TYPE_TEMPLATES[type]?.label ?? type;
}

/** Normalize legacy product rows so sell counter shows Full Bag + khucra like new products. */
export function resolveSellProductInput(product: SellUnitProductInput): SellUnitProductInput {
  const basePackageSize = normalizeBasePackageSizeGrams(
    product.weightUnit,
    product.basePackageSize,
    product.allowedSellUnits
  );
  const type = detectProductType(
    product.weightUnit,
    basePackageSize,
    product.allowedSellUnits
  );

  if (type === "feed_bag") {
    return {
      weightUnit: "BAG",
      basePackageSize,
      allowedSellUnits: normalizeAllowedSellUnits(
        "BAG",
        basePackageSize,
        product.allowedSellUnits
      ),
    };
  }

  return {
    ...product,
    basePackageSize,
  };
}

export function productNeedsSellConfigSync(product: {
  weightUnit: string;
  basePackageSize: number;
  allowedSellUnits: number[];
}): boolean {
  const basePackageSize = normalizeBasePackageSizeGrams(
    product.weightUnit,
    product.basePackageSize,
    product.allowedSellUnits
  );
  const type = detectProductType(
    product.weightUnit,
    basePackageSize,
    product.allowedSellUnits
  );

  if (basePackageSize !== product.basePackageSize) return true;
  if (type === "feed_bag" && product.weightUnit !== "BAG") return true;

  return feedSellUnitsNeedSync(
    type === "feed_bag" ? "BAG" : product.weightUnit,
    basePackageSize,
    product.allowedSellUnits
  );
}

export function buildSellConfigSyncData(product: {
  weightUnit: string;
  basePackageSize: number;
  allowedSellUnits: number[];
}) {
  const basePackageSize = normalizeBasePackageSizeGrams(
    product.weightUnit,
    product.basePackageSize,
    product.allowedSellUnits
  );
  const type = detectProductType(
    product.weightUnit,
    basePackageSize,
    product.allowedSellUnits
  );
  const data: {
    basePackageSize?: number;
    weightUnit?: "BAG";
    allowedSellUnits?: number[];
  } = {};

  if (basePackageSize !== product.basePackageSize) {
    data.basePackageSize = basePackageSize;
  }

  if (type === "feed_bag") {
    if (product.weightUnit !== "BAG") data.weightUnit = "BAG";
    data.allowedSellUnits = generateFeedAllowedSellUnits(basePackageSize);
  } else if (
    feedSellUnitsNeedSync(product.weightUnit, basePackageSize, product.allowedSellUnits)
  ) {
    data.allowedSellUnits = generateFeedAllowedSellUnits(basePackageSize);
  }

  return data;
}
