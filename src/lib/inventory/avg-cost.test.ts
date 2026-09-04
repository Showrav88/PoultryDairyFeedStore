import { describe, expect, it } from "vitest";
import { computeLineProfit, computeWeightedAvgCost } from "./avg-cost";

describe("avg-cost", () => {
  it("sets avg from first purchase when no stock", () => {
    expect(computeWeightedAvgCost(0, 0, 500000, 10000)).toBeCloseTo(0.02);
  });

  it("blends new purchase into weighted average", () => {
    const afterFirst = computeWeightedAvgCost(0, 0, 500000, 10000);
    const afterSecond = computeWeightedAvgCost(500000, afterFirst, 500000, 11000);
    expect(afterSecond).toBeCloseTo(0.021);
  });

  it("computes line profit", () => {
    const { costTotal, profit } = computeLineProfit(5000, 425, 0.02);
    expect(costTotal).toBe(100);
    expect(profit).toBe(325);
  });
});
