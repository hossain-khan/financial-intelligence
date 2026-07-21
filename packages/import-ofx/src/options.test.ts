import { describe, expect, it } from "vitest";

import { OfxImportError } from "./errors";
import { DEFAULT_OFX_LIMITS, parseOfxOptions, type OfxEncoding } from "./options";

describe("parseOfxOptions", () => {
  it("returns defaults for undefined", () => {
    const options = parseOfxOptions(undefined);
    expect(options.encoding).toBe("auto");
    expect(options.limits).toEqual(DEFAULT_OFX_LIMITS);
  });

  it("returns defaults for empty object", () => {
    const options = parseOfxOptions({});
    expect(options.encoding).toBe("auto");
    expect(options.limits).toEqual(DEFAULT_OFX_LIMITS);
  });

  it("accepts each supported encoding", () => {
    const encodings: OfxEncoding[] = ["auto", "utf-8", "utf-16le", "utf-16be", "windows-1252"];
    for (const encoding of encodings) {
      expect(parseOfxOptions({ encoding }).encoding).toBe(encoding);
    }
  });

  it("applies custom limits", () => {
    const options = parseOfxOptions({ limits: { maxFileBytes: 1024, maxStatements: 5 } });
    expect(options.limits.maxFileBytes).toBe(1024);
    expect(options.limits.maxStatements).toBe(5);
    expect(options.limits.maxTransactions).toBe(DEFAULT_OFX_LIMITS.maxTransactions);
  });

  it("rejects non-object options", () => {
    expect(() => parseOfxOptions("bad")).toThrow(OfxImportError);
    expect(() => parseOfxOptions(123)).toThrow(OfxImportError);
  });

  it("rejects unsupported encoding", () => {
    expect(() => parseOfxOptions({ encoding: "latin1" })).toThrow(OfxImportError);
  });

  it("rejects non-object limits", () => {
    expect(() => parseOfxOptions({ limits: "bad" })).toThrow(OfxImportError);
  });

  it("rejects invalid limit values", () => {
    expect(() => parseOfxOptions({ limits: { maxFileBytes: 0 } })).toThrow(OfxImportError);
    expect(() => parseOfxOptions({ limits: { maxFileBytes: 1.5 } })).toThrow(OfxImportError);
    expect(() => parseOfxOptions({ limits: { maxFileBytes: -1 } })).toThrow(OfxImportError);
    expect(() => parseOfxOptions({ limits: { maxFileBytes: Number.NaN } })).toThrow(OfxImportError);
  });
});
