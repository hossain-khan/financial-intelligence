import { describe, expect, it } from "vitest";

import { minorToDecimal, parseOfxAmount } from "./amount";

describe("parseOfxAmount", () => {
  it("parses positive decimal amounts", () => {
    expect(parseOfxAmount("4.25")).toEqual({ minor: 425n, original: "4.25" });
  });

  it("parses negative decimal amounts", () => {
    expect(parseOfxAmount("-4.25")).toEqual({ minor: -425n, original: "-4.25" });
  });

  it("parses parenthesized negative amounts", () => {
    expect(parseOfxAmount("(4.25)")).toEqual({ minor: -425n, original: "(4.25)" });
  });

  it("rejects non-numeric values", () => {
    expect(parseOfxAmount("not money")).toBeUndefined();
  });

  it("rejects empty values", () => {
    expect(parseOfxAmount("")).toBeUndefined();
  });

  it("rejects multiple decimal separators", () => {
    expect(parseOfxAmount("1.2.3")).toBeUndefined();
  });
});

describe("minorToDecimal", () => {
  it("formats minor units as decimal", () => {
    expect(minorToDecimal(425n)).toBe("4.25");
    expect(minorToDecimal(-425n)).toBe("-4.25");
    expect(minorToDecimal(0n)).toBe("0.00");
  });
});
