import { describe, expect, it } from "vitest";
import {
  productPricesChanged,
  toProductPrices,
  withPriceDeltas,
} from "./product-price-history";

describe("productPricesChanged", () => {
  it("detects any of the three prices changing", () => {
    const before = toProductPrices({
      sellPrice: 1100,
      defaultCostPrice: 900,
      defaultTpPrice: 950,
    });
    expect(
      productPricesChanged(before, {
        ...before,
        sellPrice: 1150,
      })
    ).toBe(true);
    expect(
      productPricesChanged(before, {
        ...before,
        defaultCostPrice: 920,
      })
    ).toBe(true);
    expect(
      productPricesChanged(before, {
        ...before,
        defaultTpPrice: 980,
      })
    ).toBe(true);
    expect(productPricesChanged(before, before)).toBe(false);
  });
});

describe("withPriceDeltas", () => {
  it("computes deltas between history rows", () => {
    const rows = withPriceDeltas([
      {
        id: "1",
        sellPrice: 1000,
        defaultCostPrice: 800,
        defaultTpPrice: 850,
        createdAt: new Date("2026-01-01"),
      },
      {
        id: "2",
        sellPrice: 1100,
        defaultCostPrice: 820,
        defaultTpPrice: 870,
        createdAt: new Date("2026-02-01"),
      },
    ]);

    expect(rows[0].sellDelta).toBeNull();
    expect(rows[1].sellDelta).toBe(100);
    expect(rows[1].costDelta).toBe(20);
    expect(rows[1].tpDelta).toBe(20);
  });
});
