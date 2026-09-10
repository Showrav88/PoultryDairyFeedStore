import { describe, expect, it } from "vitest";
import {
  buildSellUnitOptions,
  generateFeedAllowedSellUnits,
  getKhucraMaxGrams,
  getDefaultSellUnitSize,
  getWalkInDefaultSellUnitSize,
  normalizeAllowedSellUnits,
  feedSellUnitsNeedSync,
} from "./sell-units";

describe("getKhucraMaxGrams", () => {
  it("uses fixed table for 25 and 50 kg bags", () => {
    expect(getKhucraMaxGrams(25000)).toBe(20000);
    expect(getKhucraMaxGrams(50000)).toBe(30000);
  });

  it("uses bag minus 5 kg for other sizes", () => {
    expect(getKhucraMaxGrams(20000)).toBe(15000);
    expect(getKhucraMaxGrams(10000)).toBe(5000);
  });
});

describe("generateFeedAllowedSellUnits", () => {
  it("includes small presets and 5 kg steps up to khucra max for 50 kg", () => {
    const units = generateFeedAllowedSellUnits(50000);
    expect(units).toContain(100);
    expect(units).toContain(1000);
    expect(units).toContain(5000);
    expect(units).toContain(30000);
    expect(units).not.toContain(50000);
    expect(units).not.toContain(35000);
  });

  it("caps khucra at 20 kg for 25 kg bag", () => {
    const units = generateFeedAllowedSellUnits(25000);
    expect(units).toContain(20000);
    expect(units).not.toContain(25000);
  });
});

describe("buildSellUnitOptions", () => {
  const product50 = {
    weightUnit: "BAG",
    basePackageSize: 50000,
    allowedSellUnits: generateFeedAllowedSellUnits(50000),
  };

  it("orders full bag first then descending khucra", () => {
    const options = buildSellUnitOptions(product50);
    expect(options[0]).toBe(50000);
    expect(options[1]).toBe(30000);
    expect(options).toContain(25000);
    expect(options).toContain(100);
    for (let i = 1; i < options.length - 1; i++) {
      expect(options[i]).toBeGreaterThanOrEqual(options[i + 1]);
    }
  });

  it("defaults to full bag", () => {
    expect(getDefaultSellUnitSize(product50)).toBe(50000);
  });

  it("walk-in default prefers 1 kg khucra over full bag", () => {
    expect(getWalkInDefaultSellUnitSize(product50)).toBe(1000);
  });
});

describe("normalizeAllowedSellUnits", () => {
  it("regenerates feed units from bag size", () => {
    const units = normalizeAllowedSellUnits("BAG", 25000, [100, 250]);
    expect(units).toContain(20000);
    expect(units.length).toBeGreaterThan(2);
  });

  it("detects stale feed presets", () => {
    expect(feedSellUnitsNeedSync("BAG", 50000, [100, 250, 500, 1000])).toBe(true);
    expect(
      feedSellUnitsNeedSync("BAG", 50000, generateFeedAllowedSellUnits(50000))
    ).toBe(false);
  });
});
