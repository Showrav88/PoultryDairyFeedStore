/**
 * Auto-fill sell price per unit from reference bag price.
 * pricePerUnit = sellPrice × (unitSize / basePackageSize)
 */
export function calcUnitPriceFromReference(
  referenceSellPrice: number,
  unitSizeInSmallestUnit: number,
  basePackageSize: number
): number {
  if (referenceSellPrice <= 0 || basePackageSize <= 0 || unitSizeInSmallestUnit <= 0) {
    return 0;
  }
  const price = referenceSellPrice * (unitSizeInSmallestUnit / basePackageSize);
  return Math.round(price * 100) / 100;
}
