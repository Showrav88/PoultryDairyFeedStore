import { describe, expect, it } from "vitest";
import {
  getAvailableStock,
  getCartReservedStock,
  validateStockForLine,
} from "./cart-stock";

describe("cart-stock", () => {
  const cart = [
    { productId: "p1", quantityInSmallestUnit: 1000, unitCount: 2 },
    { productId: "p1", quantityInSmallestUnit: 500, unitCount: 1 },
  ];

  it("sums reserved stock per product", () => {
    expect(getCartReservedStock(cart, "p1")).toBe(2500);
    expect(getCartReservedStock(cart, "p2")).toBe(0);
  });

  it("calculates available stock after cart", () => {
    expect(getAvailableStock(10000, cart, "p1")).toBe(7500);
  });

  it("rejects lines above available stock", () => {
    const result = validateStockForLine(10000, cart, "p1", 5000, 2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.available).toBe(7500);
    }
  });

  it("accepts valid lines", () => {
    const result = validateStockForLine(10000, cart, "p1", 1000, 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.availableAfter).toBe(6500);
    }
  });
});
