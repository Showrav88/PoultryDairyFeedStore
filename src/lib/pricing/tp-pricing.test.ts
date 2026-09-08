import { describe, expect, it } from "vitest";
import {
  buildLegacyTpConversion,
  canApplyLegacyTp,
  computeLineTpProfit,
  computePurchaseLineTpTotal,
  getPurchasePayableTotal,
  resolvePurchasePricingModel,
  tpPricePerSmallestUnit,
  validateDefaultTpPrice,
  validatePurchaseTpLine,
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

describe("computePurchaseLineTpTotal", () => {
  it("multiplies qty by TP per package", () => {
    expect(computePurchaseLineTpTotal(10, 2550)).toBe(25500);
  });
});

describe("validatePurchaseTpLine", () => {
  it("requires cost when TP is set", () => {
    expect(validatePurchaseTpLine(0, 2550)).toMatch(/cost price/);
  });

  it("requires TP >= cost", () => {
    expect(validatePurchaseTpLine(2500, 2400)).toMatch(/at least/);
  });
});

describe("getPurchasePayableTotal", () => {
  it("uses TP total for DUAL purchases", () => {
    expect(
      getPurchasePayableTotal({
        pricingModel: "DUAL",
        totalCost: 25000,
        totalTpAmount: 25500,
      })
    ).toBe(25500);
  });

  it("uses cost total for LEGACY purchases", () => {
    expect(
      getPurchasePayableTotal({
        pricingModel: "LEGACY",
        totalCost: 25000,
        totalTpAmount: null,
      })
    ).toBe(25000);
  });
});

describe("resolvePurchasePricingModel", () => {
  it("returns DUAL when any line has TP", () => {
    expect(resolvePurchasePricingModel([{ tpPricePerUnit: 2550 }])).toBe("DUAL");
  });

  it("returns LEGACY when no TP", () => {
    expect(resolvePurchasePricingModel([{ tpPricePerUnit: 0 }])).toBe("LEGACY");
  });
});

describe("canApplyLegacyTp", () => {
  it("allows legacy purchases with open due", () => {
    expect(canApplyLegacyTp({ pricingModel: "LEGACY", dueAmount: 5000 })).toBe(true);
  });

  it("rejects DUAL or zero due", () => {
    expect(canApplyLegacyTp({ pricingModel: "DUAL", dueAmount: 5000 })).toBe(false);
    expect(canApplyLegacyTp({ pricingModel: "LEGACY", dueAmount: 0 })).toBe(false);
  });
});

describe("buildLegacyTpConversion", () => {
  const lines = [
    { itemId: "a", costPricePerUnit: 2500, quantity: 10, tpPricePerUnit: 2550 },
    { itemId: "b", costPricePerUnit: 2400, quantity: 5, tpPricePerUnit: 2450 },
  ];

  it("computes TP total and new due from paid amount", () => {
    const result = buildLegacyTpConversion(lines, 10000);
    expect(result.totalTpAmount).toBe(37750);
    expect(result.newDue).toBe(27750);
    expect(result.newStatus).toBe("PARTIAL");
    expect(result.lineUpdates).toHaveLength(2);
  });

  it("marks PAID when paid covers TP total", () => {
    const result = buildLegacyTpConversion(lines, 37750);
    expect(result.newDue).toBe(0);
    expect(result.newStatus).toBe("PAID");
  });

  it("rejects TP below cost", () => {
    expect(() =>
      buildLegacyTpConversion(
        [{ itemId: "a", costPricePerUnit: 2500, quantity: 1, tpPricePerUnit: 2400 }],
        0
      )
    ).toThrow(/at least/);
  });

  it("rejects paid exceeding TP total", () => {
    expect(() => buildLegacyTpConversion(lines, 40000)).toThrow(/exceeds/);
  });
});
