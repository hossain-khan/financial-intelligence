import { describe, expect, it } from "vitest";

import { parseCategoryId, parseTransactionId } from "./identifiers";
import { Money } from "./money";
import { parseAccountId, parseImportId } from "./identifiers";
import { parseDateOnly, parseUtcTimestamp } from "./temporal";
import { createTransaction, transactionFromCanonical, transactionToCanonical } from "./transaction";
import { applyAutomaticCategoryEdit, applyManualTransactionEdit } from "./transaction-editing";

const categoryId = parseCategoryId("018f6b80-0d62-7d2c-9a5c-7f5f59cda202");
const otherCategoryId = parseCategoryId("018f6b80-0d62-7d2c-9a5c-7f5f59cda203");
const now = parseUtcTimestamp("2026-07-19T16:00:00.000Z");
const later = parseUtcTimestamp("2026-07-19T17:00:00.000Z");

function transaction() {
  return createTransaction({
    id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda201"),
    accountId: parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda204"),
    importId: parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda205"),
    postedDate: parseDateOnly("2026-07-19"),
    money: Money.from("-12.50", "CAD"),
    description: "Market",
    provenance: {
      parserId: "csv",
      parserVersion: "1",
      sourceLocation: "row:2",
      original: {},
      transformations: [],
    },
    now,
  });
}

describe("transaction editing", () => {
  it("records localAi provenance when an edit carries it", () => {
    const edited = applyManualTransactionEdit(
      transaction(),
      {
        category: categoryId,
        provenance: {
          method: "localAi",
          classifierId: "ai-local",
          classifierVersion: "1.0.0",
          evidence: ["model_category_candidate"],
        },
      },
      now,
    );
    expect(edited.classifications.category?.method).toBe("localAi");
    expect(edited.classifications.category?.locked).toBe(false);
  });

  it("still records a user-locked decision with no provenance", () => {
    const edited = applyManualTransactionEdit(transaction(), { category: categoryId }, now);
    expect(edited.classifications.category?.method).toBe("user");
    expect(edited.classifications.category?.locked).toBe(true);
  });

  it("edits category, notes, tags, and review state on the canonical transaction", () => {
    const edited = applyManualTransactionEdit(
      transaction(),
      {
        category: categoryId,
        notes: "  family budget  ",
        tags: ["household"],
        reviewState: "reviewed",
      },
      later,
    );
    expect(edited).toMatchObject({
      categoryId,
      notes: "family budget",
      tags: ["household"],
      reviewState: "reviewed",
      classifications: { category: { method: "user", locked: true } },
    });
  });

  it("does not let automatic classification overwrite a locked user category", () => {
    const locked = applyManualTransactionEdit(transaction(), { category: categoryId }, later);
    const automatic = applyAutomaticCategoryEdit(
      locked,
      {
        category: otherCategoryId,
        classification: {
          method: "rule",
          classifierId: "rule:1",
          classifierVersion: "1",
          evidence: ["merchant-match"],
          decidedAt: later,
        },
      },
      later,
    );
    expect(automatic).toBe(locked);
  });

  it("allows automatic classification after an explicit unlock", () => {
    const locked = applyManualTransactionEdit(transaction(), { category: categoryId }, later);
    const unlocked = applyManualTransactionEdit(locked, { unlockCategory: true }, later);
    const automatic = applyAutomaticCategoryEdit(
      unlocked,
      {
        category: otherCategoryId,
        classification: {
          method: "rule",
          classifierId: "rule:1",
          classifierVersion: "1",
          evidence: [],
          decidedAt: later,
        },
      },
      later,
    );
    expect(automatic.categoryId).toBe(otherCategoryId);
  });

  it("round-trips manual ledger fields through the canonical document", () => {
    const edited = applyManualTransactionEdit(
      transaction(),
      { category: categoryId, notes: "Receipt checked", tags: ["tax"], reviewState: "reviewed" },
      later,
    );
    expect(transactionFromCanonical(transactionToCanonical(edited))).toEqual(edited);
  });
});
