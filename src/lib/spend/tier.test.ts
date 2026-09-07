import { describe, expect, it } from "vitest";
import { getSpendTier, getTierProgress } from "./tier";

describe("getSpendTier", () => {
  it("bronze starts at 0", () => {
    expect(getSpendTier(0).tier).toBe("bronze");
    expect(getSpendTier(19999).tier).toBe("bronze");
  });

  it("silver at 20k", () => {
    expect(getSpendTier(20000).tier).toBe("silver");
  });

  it("gold at 40k", () => {
    expect(getSpendTier(40000).tier).toBe("gold");
  });

  it("platinum at 60k+", () => {
    expect(getSpendTier(60000).tier).toBe("platinum");
  });
});

describe("getTierProgress", () => {
  it("shows amount to next tier", () => {
    const p = getTierProgress(15000);
    expect(p.current.tier).toBe("bronze");
    expect(p.next?.tier).toBe("silver");
    expect(p.amountToNext).toBe(5000);
  });
});
