import { describe, expect, it } from "vitest";

import { parseAccountId, parseImportId } from "./identifiers";
import { createCommittedImport, importFromCanonical, importToCanonical } from "./statement-import";
import { parseUtcTimestamp } from "./temporal";

describe("statement import", () => {
  it("round-trips committed metadata without retaining source bytes", () => {
    const statementImport = createCommittedImport({
      id: parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f3"),
      accountId: parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2"),
      source: {
        fileName: "statement.csv",
        mediaType: "text/csv",
        byteSize: 123,
        sha256: "a".repeat(64),
      },
      parser: { id: "financial-intelligence/csv", version: "1.0.0" },
      mapping: { dateFormat: "YYYY-MM-DD", amountDirection: "positive-inflow" },
      counts: {
        sourceRows: 2,
        valid: 2,
        errors: 0,
        warnings: 1,
        exactDuplicates: 0,
        likelyDuplicates: 0,
        committed: 2,
      },
      issues: [{ code: "NORMALIZED_TEXT", severity: "warning", message: "Whitespace normalized" }],
      committedRevision: 2,
      now: parseUtcTimestamp("2026-07-19T20:00:00.000Z"),
    });
    const document = importToCanonical(statementImport);
    expect(document.source.retained).toBe(false);
    expect(document).not.toHaveProperty("source.bytes");
    expect(importToCanonical(importFromCanonical(document))).toEqual(document);
  });

  it("rejects error-level or partially committed import records", () => {
    const base = {
      id: parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f3"),
      accountId: parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2"),
      source: {
        fileName: "statement.csv",
        mediaType: "text/csv",
        byteSize: 1,
        sha256: "a".repeat(64),
      },
      parser: { id: "csv", version: "1" },
      mapping: {},
      counts: {
        sourceRows: 1,
        valid: 1,
        errors: 0,
        warnings: 0,
        exactDuplicates: 0,
        likelyDuplicates: 0,
        committed: 1,
      },
      issues: [],
      committedRevision: 2,
      now: parseUtcTimestamp("2026-07-19T20:00:00.000Z"),
    };
    expect(() =>
      createCommittedImport({ ...base, counts: { ...base.counts, committed: 0 } }),
    ).toThrow(/all valid rows/i);
    expect(() =>
      createCommittedImport({
        ...base,
        issues: [{ code: "BAD_ROW", severity: "error", message: "Bad" }],
      }),
    ).toThrow(/error-level/i);
  });
});
