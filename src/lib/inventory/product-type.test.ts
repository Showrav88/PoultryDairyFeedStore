import { describe, expect, it } from "vitest";
import { buildSellUnitOptions } from "./sell-units";
import {
  buildSellConfigSyncData,
  detectProductType,
  normalizeBasePackageSizeGrams,
  packageDisplaySize,
  resolveSellProductInput,
} from "./product-type";

describe("detectProductType", () => {
  it("maps feed weight units to feed_bag", () => {
    expect(detectProductType("BAG", 50000)).toBe("feed_bag");
    expect(detectProductType("KG", 1000)).toBe("feed_bag");
  });

  it("detects legacy GENERIC feed rows by package size", () => {
    expect(detectProductType("GENERIC", 50000, [100, 250, 500, 1000])).toBe("feed_bag");
  });

  it("detects legacy GENERIC feed stored as kg integer", () => {
    expect(detectProductType("GENERIC", 25, [100, 250, 500, 1000])).toBe("feed_bag");
  });

  it("keeps small GENERIC rows as generic", () => {
    expect(detectProductType("GENERIC", 1, [1])).toBe("generic");
  });
});

describe("normalizeBasePackageSizeGrams", () => {
  it("converts legacy 25 kg bag stored as 25 into grams", () => {
    expect(normalizeBasePackageSizeGrams("BAG", 25)).toBe(25000);
    expect(normalizeBasePackageSizeGrams("GENERIC", 25, [100, 250, 500, 1000])).toBe(25000);
  });

  it("leaves gram values unchanged", () => {
    expect(normalizeBasePackageSizeGrams("BAG", 25000)).toBe(25000);
  });
});

describe("packageDisplaySize", () => {
  it("shows kg for legacy GENERIC feed stored in grams", () => {
    expect(packageDisplaySize("GENERIC", 50000, "feed_bag")).toBe(50);
  });

  it("shows kg for legacy feed stored as kg integer", () => {
    expect(
      packageDisplaySize("GENERIC", 25, "feed_bag", [100, 250, 500, 1000])
    ).toBe(25);
  });
});

describe("resolveSellProductInput", () => {
  it("adds Full Bag (25 kg) option for legacy old product rows", () => {
    const resolved = resolveSellProductInput({
      weightUnit: "GENERIC",
      basePackageSize: 25,
      allowedSellUnits: [100, 250, 500, 1000],
    });
    const options = buildSellUnitOptions(resolved);
    expect(options[0]).toBe(25000);
    expect(options).toContain(20000);
    expect(options).toContain(1000);
  });
});

describe("buildSellConfigSyncData", () => {
  it("builds migration patch for legacy feed product", () => {
    const data = buildSellConfigSyncData({
      weightUnit: "GENERIC",
      basePackageSize: 25,
      allowedSellUnits: [100, 250, 500, 1000],
    });
    expect(data.basePackageSize).toBe(25000);
    expect(data.weightUnit).toBe("BAG");
    expect(data.allowedSellUnits).toContain(20000);
    expect(data.allowedSellUnits).not.toContain(25000);
  });
});
