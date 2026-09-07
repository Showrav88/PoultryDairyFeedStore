import { describe, expect, it } from "vitest";
import { getCustomerTier, getTierProgress } from "./tier";

describe("getCustomerTier", () => {
  it("bronze starts at 0", () => {
    expect(getCustomerTier(0).tier).toBe("bronze");
    expect(getCustomerTier(19999).tier).toBe("bronze");
  });

  it("silver at 20k", () => {
    expect(getCustomerTier(20000).tier).toBe("silver");
  });

  it("gold at 40k", () => {
    expect(getCustomerTier(40000).tier).toBe("gold");
  });

  it("platinum at 60k+", () => {
    expect(getCustomerTier(60000).tier).toBe("platinum");
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
