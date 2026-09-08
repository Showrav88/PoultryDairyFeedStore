import { describe, expect, it } from "vitest";
import {
  computeLineTpProfit,
  tpPricePerSmallestUnit,
  validateDefaultTpPrice,
} from "./tp-pricing";

describe("tpPricePerSmallestUnit", () => {
  it("converts per-bag TP to per-gram", () => {
    expect(tpPricePerSmallestUnit(2550, 50000)).toBeCloseTo(0.051, 6);
  });

  it("returns 0 when TP or package size is unset", () => {
    expect(tpPricePerSmallestUnit(0, 50000)).toBe(0);
    expect(tpPricePerSmallestUnit(2550, 0)).toBe(0);
  });
});

describe("computeLineTpProfit", () => {
  it("computes TP total and margin from line sell total", () => {
    const tpPerUnit = tpPricePerSmallestUnit(2550, 50000);
    const result = computeLineTpProfit(50000, 2800, tpPerUnit);
    expect(result).not.toBeNull();
    expect(result!.tpTotal).toBeCloseTo(2550, 2);
    expect(result!.tpProfit).toBeCloseTo(250, 2);
  });

  it("returns null when product has no TP default", () => {
    expect(computeLineTpProfit(50000, 2800, 0)).toBeNull();
  });
});

describe("validateDefaultTpPrice", () => {
  it("rejects TP below cost", () => {
    expect(validateDefaultTpPrice(2500, 2400)).toMatch(/at least/);
  });

  it("allows TP equal to or above cost", () => {
    expect(validateDefaultTpPrice(2500, 2500)).toBeNull();
    expect(validateDefaultTpPrice(2500, 2550)).toBeNull();
  });
});
