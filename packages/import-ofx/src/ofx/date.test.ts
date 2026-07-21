import { describe, expect, it } from "vitest";

import { parseOfxDate } from "./date";

describe("parseOfxDate", () => {
  it("parses full timestamps", () => {
    const result = parseOfxDate("20260718123045");
    expect(result).toEqual({
      raw: "20260718123045",
      dateOnly: "2026-07-18",
      hasOffset: false,
      hasTime: true,
    });
  });

  it("parses timestamps with fractional seconds", () => {
    const result = parseOfxDate("20260718123045.123");
    expect(result?.dateOnly).toBe("2026-07-18");
    expect(result?.hasTime).toBe(true);
  });

  it("parses timestamps with an offset", () => {
    const result = parseOfxDate("20260718123045[0:GMT]");
    expect(result?.dateOnly).toBe("2026-07-18");
    expect(result?.hasOffset).toBe(true);
  });

  it("parses date-only values", () => {
    const result = parseOfxDate("20260718");
    expect(result).toEqual({
      raw: "20260718",
      dateOnly: "2026-07-18",
      hasOffset: false,
      hasTime: false,
    });
  });

  it("rejects invalid calendar dates", () => {
    expect(parseOfxDate("20260230")).toBeUndefined();
  });

  it("rejects invalid time components", () => {
    expect(parseOfxDate("20260718250000")).toBeUndefined();
  });

  it("rejects malformed values", () => {
    expect(parseOfxDate("not-a-date")).toBeUndefined();
    expect(parseOfxDate("")).toBeUndefined();
  });
});
