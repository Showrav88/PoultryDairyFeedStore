import { describe, expect, it } from "vitest";
import { calcUnitPriceFromReference } from "./unit-price";

describe("calcUnitPriceFromReference", () => {
  it("scales reference bag price by unit ratio", () => {
    // 50kg bag at 2500 -> 1kg (1000g) = 50
    expect(calcUnitPriceFromReference(2500, 1000, 50000)).toBe(50);
    // 250g khucra
    expect(calcUnitPriceFromReference(2500, 250, 50000)).toBe(12.5);
  });

  it("returns 0 for invalid inputs", () => {
    expect(calcUnitPriceFromReference(0, 250, 50000)).toBe(0);
  });
});
