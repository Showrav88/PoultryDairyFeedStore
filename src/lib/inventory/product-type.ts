import {
  PRODUCT_TYPE_TEMPLATES,
  gramsToDisplayKg,
  kgToGrams,
} from "./sell-units";

export type ProductTypeKey = keyof typeof PRODUCT_TYPE_TEMPLATES;

export function detectProductType(
  weightUnit: string,
  basePackageSize = 1,
  allowedSellUnits: number[] = []
): ProductTypeKey {
  if (weightUnit === "BAG" || weightUnit === "KG" || weightUnit === "GRAM") return "feed_bag";
  if (weightUnit === "ML" || weightUnit === "LITER") return "liquid";
  if (weightUnit === "PIECE") return "eggs";
  if (weightUnit === "GENERIC") {
    const looksLikeFeed =
      basePackageSize >= 5000 ||
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
  productType?: ProductTypeKey
): number {
  const type = productType ?? detectProductType(weightUnit, basePackageSize);
  if (type === "feed_bag") {
    return gramsToDisplayKg(basePackageSize);
  }
  if (type === "liquid") {
    return basePackageSize;
  }
  return basePackageSize;
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
