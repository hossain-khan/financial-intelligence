import { describe, expect, it } from "vitest";

import {
  parseAccountId,
  parseCategoryId,
  parseImportId,
  parseMerchantId,
  parseOperationId,
  parseTransactionId,
  parseWorkspaceId,
} from "./identifiers";

const UUID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f1";

describe("opaque identifiers", () => {
  it.each([
    parseWorkspaceId,
    parseAccountId,
    parseImportId,
    parseTransactionId,
    parseCategoryId,
    parseMerchantId,
    parseOperationId,
  ])("accepts and round-trips a UUID", (parse) => {
    expect(parse(UUID)).toBe(UUID);
  });

  it("normalizes hexadecimal case", () => {
    expect(parseWorkspaceId(UUID.toUpperCase())).toBe(UUID);
  });

  it.each(["", "workspace-1", "00000000-0000-0000-0000-000000000000", "not-a-uuid"])(
    "rejects invalid ID %j",
    (value) => {
      expect(() => parseWorkspaceId(value)).toThrow(TypeError);
    },
  );
});
