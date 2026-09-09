import { describe, expect, it } from "vitest";
import {
  cartHasFullBagLine,
  hasTrackedBuyer,
  validateSaleCheckout,
} from "./sale-validation";
import { isBelowCost, isBelowSuggested, resolveUnitSellPrice } from "./last-price";

describe("hasTrackedBuyer", () => {
  it("accepts farmer or customer id", () => {
    expect(hasTrackedBuyer({ farmerId: "f1" })).toBe(true);
    expect(hasTrackedBuyer({ customerId: "c1" })).toBe(true);
  });

  it("accepts name and phone", () => {
    expect(hasTrackedBuyer({ customerName: "Ali", customerPhone: "01712345678" })).toBe(true);
  });

  it("rejects anonymous", () => {
    expect(hasTrackedBuyer({})).toBe(false);
  });
});

describe("validateSaleCheckout", () => {
  const product = { id: "p1", basePackageSize: 50000 };

  it("blocks due without identity", () => {
    const err = validateSaleCheckout({
      lines: [{ productId: "p1", quantityInSmallestUnit: 5000, pricePerUnit: 500 }],
      products: [product],
      paidAmount: 0,
      totalAmount: 500,
    });
    expect(err).toMatch(/Due sales require/);
  });

  it("blocks full bag without tracked buyer", () => {
    const err = validateSaleCheckout({
      lines: [{ productId: "p1", quantityInSmallestUnit: 50000, pricePerUnit: 2800 }],
      products: [product],
      paidAmount: 2800,
      totalAmount: 2800,
    });
    expect(err).toMatch(/Full bag/);
  });

  it("allows khucra walk-in full pay", () => {
    const err = validateSaleCheckout({
      lines: [{ productId: "p1", quantityInSmallestUnit: 5000, pricePerUnit: 500 }],
      products: [product],
      paidAmount: 500,
      totalAmount: 500,
    });
    expect(err).toBeNull();
  });
});

describe("resolveUnitSellPrice", () => {
  it("prefers last price over suggested", () => {
    const r = resolveUnitSellPrice({
      referenceSellPrice: 2800,
      unitSize: 25000,
      basePackageSize: 50000,
      lastPricePerUnit: 1300,
    });
    expect(r.pricePerUnit).toBe(1300);
    expect(r.usedLastPrice).toBe(true);
    expect(r.suggestedPricePerUnit).toBe(1400);
  });
});

describe("warnings", () => {
  it("detects below suggested and below cost", () => {
    expect(isBelowSuggested(2400, 2500)).toBe(true);
    expect(isBelowCost(2400, 0.05, 50000)).toBe(true);
  });
});

describe("cartHasFullBagLine", () => {
  it("detects full bag line", () => {
    const map = new Map([["p1", { id: "p1", basePackageSize: 50000 }]]);
    expect(
      cartHasFullBagLine([{ productId: "p1", quantityInSmallestUnit: 50000, pricePerUnit: 2800 }], map)
    ).toBe(true);
    expect(
      cartHasFullBagLine([{ productId: "p1", quantityInSmallestUnit: 5000, pricePerUnit: 500 }], map)
    ).toBe(false);
  });
});
