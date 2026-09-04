import { formatSmallestUnit } from "./khucra";

export interface CartLine {
  productId: string;
  quantityInSmallestUnit: number;
  unitCount: number;
}

/** Total grams/ml/pieces reserved in cart for one product */
export function getCartReservedStock(cart: CartLine[], productId: string): number {
  return cart
    .filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + item.quantityInSmallestUnit * item.unitCount, 0);
}

export function getLineStockAmount(
  quantityInSmallestUnit: number,
  unitCount: number
): number {
  return quantityInSmallestUnit * unitCount;
}

export function getAvailableStock(
  totalStock: number,
  cart: CartLine[],
  productId: string
): number {
  return Math.max(0, totalStock - getCartReservedStock(cart, productId));
}

export function validateStockForLine(
  totalStock: number,
  cart: CartLine[],
  productId: string,
  quantityInSmallestUnit: number,
  unitCount: number
): { ok: true; availableAfter: number } | { ok: false; message: string; available: number } {
  const available = getAvailableStock(totalStock, cart, productId);
  const needed = getLineStockAmount(quantityInSmallestUnit, unitCount);

  if (needed <= 0) {
    return { ok: false, message: "Enter a valid quantity", available };
  }

  if (needed > available) {
    return {
      ok: false,
      message: `Not enough stock. Available: ${formatSmallestUnit(available, "GRAM")}, you need: ${formatSmallestUnit(needed, "GRAM")}`,
      available,
    };
  }

  return { ok: true, availableAfter: available - needed };
}

export function formatStockAmount(amount: number, weightUnit: string): string {
  if (weightUnit === "PIECE" || weightUnit === "GENERIC") {
    return `${amount} pcs`;
  }
  return formatSmallestUnit(amount, weightUnit === "ML" || weightUnit === "LITER" ? "ML" : "GRAM");
}
