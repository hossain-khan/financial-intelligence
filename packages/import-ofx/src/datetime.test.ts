import { describe, expect, it } from "vitest";

import { parseOfxDate } from "./datetime";
import { OfxImportError } from "./errors";

describe("parseOfxDate", () => {
  it("parses a date-only value", () => {
    expect(parseOfxDate("20240115")).toEqual({ date: "2024-01-15", raw: "20240115" });
  });

  it("parses a full timestamp with fraction and timezone, keeping the raw string", () => {
    const parsed = parseOfxDate("20240115123045.678[-5:EST]");
    expect(parsed.date).toBe("2024-01-15");
    expect(parsed.raw).toBe("20240115123045.678[-5:EST]");
  });

  it("parses a positive-offset timezone", () => {
    expect(parseOfxDate("20240115000000[+5.30:IST]").date).toBe("2024-01-15");
  });

  it("derives the calendar day from wall-clock fields, not the offset", () => {
    // 23:30 on the 15th with a -5 offset must stay the 15th (offset validated, not applied).
    expect(parseOfxDate("20240115233000[-5:EST]").date).toBe("2024-01-15");
  });

  it.each([
    ["20240230", "impossible February day"],
    ["20240015", "zero month"],
    ["20241315", "month 13"],
    ["2024011", "too short"],
    ["20240115240000", "hour 24"],
    ["20240115120060", "second 60"],
    ["20240115000000[+20:ZZZ]", "offset out of range"],
    ["notadate", "non-numeric"],
    ["", "empty"],
  ])("rejects %s (%s)", (value) => {
    expect(() => parseOfxDate(value)).toThrow(OfxImportError);
  });

  it("accepts every valid day of a leap year", () => {
    for (let month = 1; month <= 12; month += 1) {
      const days = new Date(Date.UTC(2024, month, 0)).getUTCDate();
      for (let day = 1; day <= days; day += 1) {
        const raw = `2024${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
        expect(parseOfxDate(raw).date).toBe(
          `2024-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        );
      }
    }
  });
});
