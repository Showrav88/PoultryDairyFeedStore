import { describe, expect, it } from "vitest";
import { formatOptionalAmount, parseOptionalAmountInput } from "./utils";

describe("number field helpers", () => {
  it("shows blank for zero and null", () => {
    expect(formatOptionalAmount(0)).toBe("");
    expect(formatOptionalAmount(null)).toBe("");
  });

  it("empty input becomes 0", () => {
    expect(parseOptionalAmountInput("")).toBe(0);
    expect(parseOptionalAmountInput("   ")).toBe(0);
    expect(parseOptionalAmountInput("abc")).toBe(0);
  });

  it("parses valid numbers", () => {
    expect(parseOptionalAmountInput("18")).toBe(18);
    expect(parseOptionalAmountInput("425.5")).toBe(425.5);
  });
});
