import { describe, it, expect } from "vitest";
import {
  deductStock,
  addStock,
  getInventorySummary,
  sellUnitLabel,
  formatSmallestUnit,
} from "./khugra";

describe("Khugra Inventory Engine", () => {
  const baseState = {
    stockInSmallestUnit: 100000, // 100kg total (2 bags of 50kg)
    closedPackages: 2,
    openPackageRemaining: 0,
    basePackageSize: 50000, // 50kg bag
  };

  it("deducts khugra from open bag when enough remaining", () => {
    const state = { ...baseState, openPackageRemaining: 1000, closedPackages: 1 };
    const result = deductStock(state, 250);
    expect(result.success).toBe(true);
    expect(result.newState.openPackageRemaining).toBe(750);
    expect(result.newState.closedPackages).toBe(1);
    expect(result.bagsOpened).toBe(0);
  });

  it("opens a new bag when open bag has insufficient stock", () => {
    const state = { ...baseState, openPackageRemaining: 100, closedPackages: 2 };
    const result = deductStock(state, 500);
    expect(result.success).toBe(true);
    expect(result.bagsOpened).toBe(1);
    expect(result.newState.closedPackages).toBe(1);
    // Opened 50kg bag, used 500g, 100 from old open + 50000 - 400 remaining
    expect(result.newState.openPackageRemaining).toBe(49600);
  });

  it("rejects sale when insufficient total stock", () => {
    const state = { ...baseState, stockInSmallestUnit: 200, closedPackages: 0, openPackageRemaining: 200 };
    const result = deductStock(state, 500);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Insufficient stock");
  });

  it("adds stock when purchasing bags", () => {
    const result = addStock(baseState, 3);
    expect(result.added).toBe(150000);
    expect(result.newState.closedPackages).toBe(5);
    expect(result.newState.stockInSmallestUnit).toBe(250000);
  });

  it("handles multiple khugra sales sequentially", () => {
    let state = { ...baseState };
    // Sell 250g
    let r1 = deductStock(state, 250);
    expect(r1.success).toBe(true);
    state = r1.newState;
    // Sell 500g
    let r2 = deductStock(state, 500);
    expect(r2.success).toBe(true);
    state = r2.newState;
    expect(state.stockInSmallestUnit).toBe(99250);
  });

  it("formats sell unit labels correctly", () => {
    expect(sellUnitLabel(250, 50000)).toBe("250g");
    expect(sellUnitLabel(1000, 50000)).toBe("1 kg");
    expect(sellUnitLabel(50000, 50000)).toBe("1 Bag");
  });

  it("provides inventory summary", () => {
    const summary = getInventorySummary({
      ...baseState,
      openPackageRemaining: 25000,
      closedPackages: 1,
    });
    expect(summary.closedBags).toBe(1);
    expect(summary.openBagPercent).toBe(50);
    expect(summary.formattedOpenBag).toBe("25 kg");
  });
});
