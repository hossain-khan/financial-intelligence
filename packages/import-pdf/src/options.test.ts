import { describe, expect, it } from "vitest";

import { PdfImportError } from "./errors";
import { DEFAULT_PDF_LIMITS, parsePdfOptions } from "./options";

describe("parsePdfOptions", () => {
  it("returns defaults for undefined options", () => {
    expect(parsePdfOptions(undefined).limits).toEqual(DEFAULT_PDF_LIMITS);
  });

  it("overrides individual limits", () => {
    const { limits } = parsePdfOptions({ limits: { maxPages: 10 } });
    expect(limits.maxPages).toBe(10);
    expect(limits.maxFileBytes).toBe(DEFAULT_PDF_LIMITS.maxFileBytes);
  });

  it("rejects non-object options", () => {
    expect(() => parsePdfOptions(42)).toThrow(PdfImportError);
    expect(() => parsePdfOptions({ limits: 1 })).toThrow(PdfImportError);
  });

  it("rejects non-positive or non-integer limits", () => {
    expect(() => parsePdfOptions({ limits: { maxPages: 0 } })).toThrow(/positive safe integer/u);
    expect(() => parsePdfOptions({ limits: { maxPages: 1.5 } })).toThrow(PdfImportError);
    expect(() => parsePdfOptions({ limits: { maxPages: -3 } })).toThrow(PdfImportError);
  });
});
