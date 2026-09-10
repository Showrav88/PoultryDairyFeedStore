import { describe, expect, it } from "vitest";
import {
  detectProductType,
  packageDisplaySize,
} from "./product-type";

describe("detectProductType", () => {
  it("maps feed weight units to feed_bag", () => {
    expect(detectProductType("BAG", 50000)).toBe("feed_bag");
    expect(detectProductType("KG", 1000)).toBe("feed_bag");
  });

  it("detects legacy GENERIC feed rows by package size", () => {
    expect(detectProductType("GENERIC", 50000, [100, 250, 500, 1000])).toBe("feed_bag");
  });

  it("keeps small GENERIC rows as generic", () => {
    expect(detectProductType("GENERIC", 1, [1])).toBe("generic");
  });
});

describe("packageDisplaySize", () => {
  it("shows kg for legacy GENERIC feed stored in grams", () => {
    expect(packageDisplaySize("GENERIC", 50000, "feed_bag")).toBe(50);
  });
});
