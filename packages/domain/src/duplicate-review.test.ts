import { describe, expect, it } from "vitest";

import { Money } from "./money";
import { parseAccountId, parseImportId, parseTransactionId } from "./identifiers";
import { parseDateOnly, parseUtcTimestamp } from "./temporal";
import { createTransaction, type Transaction } from "./transaction";
import {
  DuplicateResolutionConflictError,
  activeDuplicateDecisions,
  applicableDuplicateDecisions,
  detectDuplicateCandidates,
  duplicateEvidenceSignature,
  normalizeDuplicateDescription,
  projectDuplicateResolutionEffects,
  type DuplicateResolutionEvent,
} from "./duplicate-review";

const accountId = parseAccountId("00000000-0000-4000-8000-000000000001");
const otherAccountId = parseAccountId("00000000-0000-4000-8000-000000000002");
const importId = parseImportId("10000000-0000-4000-8000-000000000001");
const now = parseUtcTimestamp("2026-07-19T12:00:00Z");

function transaction(
  id: string,
  overrides: Partial<{
    accountId: typeof accountId;
    date: string;
    amount: string;
    currency: string;
    description: string;
    sourceTransactionId: string;
  }> = {},
): Transaction {
  return createTransaction({
    id: parseTransactionId(id),
    accountId: overrides.accountId ?? accountId,
    importId,
    postedDate: parseDateOnly(overrides.date ?? "2026-07-10"),
    money: Money.from(overrides.amount ?? "-12.34", overrides.currency ?? "CAD"),
    description: overrides.description ?? "TIM HORTONS #145 OSHAWA",
    ...(overrides.sourceTransactionId === undefined
      ? {}
      : { sourceTransactionId: overrides.sourceTransactionId }),
    provenance: {
      parserId: "csv",
      parserVersion: "1",
      sourceLocation: "row:1",
      original: {},
      transformations: [],
    },
    now,
  });
}

describe("duplicate candidate detection", () => {
  it("classifies account-scoped equal source IDs as exact", () => {
    const existing = transaction("20000000-0000-4000-8000-000000000001", {
      sourceTransactionId: "bank-42",
    });
    const incoming = transaction("20000000-0000-4000-8000-000000000002", {
      sourceTransactionId: "bank-42",
      amount: "-999",
    });
    const result = detectDuplicateCandidates({ existing: [existing], incoming: [incoming] });
    expect(result).toMatchObject([
      { kind: "exact", score: 10_000, evidence: [{ code: "source-transaction-id" }] },
    ]);
  });

  it("classifies equal persisted fingerprints as exact", () => {
    const existing = transaction("20000000-0000-4000-8000-000000000001");
    const incoming = transaction("20000000-0000-4000-8000-000000000002");
    const value = "a".repeat(64);
    const result = detectDuplicateCandidates({
      existing: [existing],
      incoming: [incoming],
      fingerprints: [
        { transactionId: existing.id, value },
        { transactionId: incoming.id, value },
      ],
    });
    expect(result[0]).toMatchObject({ kind: "exact", evidence: [{ code: "fingerprint" }] });
  });

  it("ranks likely matches deterministically by evidence score then IDs", () => {
    const close = transaction("20000000-0000-4000-8000-000000000001", {
      description: "Tim Hortons Oshawa 145",
    });
    const farther = transaction("20000000-0000-4000-8000-000000000003", {
      date: "2026-07-08",
      description: "TIM HORTONS AJAX 145",
    });
    const incoming = transaction("20000000-0000-4000-8000-000000000002", {
      description: "tim-hortons #145 oshawa",
    });
    const reversed = detectDuplicateCandidates({
      existing: [farther, close],
      incoming: [incoming],
    });
    const forward = detectDuplicateCandidates({
      existing: [close, farther],
      incoming: [incoming],
    });
    expect(reversed).toEqual(forward);
    expect(forward.map((item) => item.existingTransactionId)).toEqual([close.id, farther.id]);
    expect(forward[0]).toMatchObject({ kind: "likely", score: 10_000 });
    expect(forward[1]?.score).toBeLessThan(forward[0]?.score ?? 0);
  });

  it("excludes different accounts, amounts, currencies, dates, and weak descriptions", () => {
    const incoming = transaction("20000000-0000-4000-8000-000000000009");
    const nonMatches = [
      transaction("20000000-0000-4000-8000-000000000001", { accountId: otherAccountId }),
      transaction("20000000-0000-4000-8000-000000000002", { amount: "-12.35" }),
      transaction("20000000-0000-4000-8000-000000000003", { currency: "USD" }),
      transaction("20000000-0000-4000-8000-000000000004", { date: "2026-07-01" }),
      transaction("20000000-0000-4000-8000-000000000005", { description: "GROCERY STORE" }),
    ];
    expect(detectDuplicateCandidates({ existing: nonMatches, incoming: [incoming] })).toEqual([]);
  });

  it("does not treat equal and opposite transfer-like records as duplicates", () => {
    const outgoing = transaction("20000000-0000-4000-8000-000000000001", {
      amount: "-500",
      description: "TRANSFER TO SAVINGS",
    });
    const incoming = transaction("20000000-0000-4000-8000-000000000002", {
      amount: "500",
      description: "TRANSFER FROM CHEQUING",
    });
    expect(detectDuplicateCandidates({ existing: [outgoing], incoming: [incoming] })).toEqual([]);
  });

  it("normalizes Unicode, punctuation, case, and whitespace", () => {
    expect(normalizeDuplicateDescription("  TIM—HORTONS  ＃１４５  ")).toBe("tim hortons 145");
  });

  it("validates tunable thresholds", () => {
    expect(() =>
      detectDuplicateCandidates({ existing: [], incoming: [], likelyDateWindowDays: 1.5 }),
    ).toThrow(RangeError);
    expect(() =>
      detectDuplicateCandidates({
        existing: [],
        incoming: [],
        likelyMinimumDescriptionSimilarity: 2,
      }),
    ).toThrow(RangeError);
  });

  it("bounds candidate work across a typical 50,000-record ledger", () => {
    const base = transaction("20000000-0000-4000-8000-000000000001", {
      amount: "-1",
      description: "Unrelated merchant",
    });
    const existing = Array.from({ length: 50_000 }, (_, index) => ({
      ...base,
      id: parseTransactionId(`20000000-0000-4000-8000-${String(index).padStart(12, "0")}`),
      money: Money.from(String(-(index + 1)), "CAD"),
    }));
    const incoming = transaction("30000000-0000-4000-8000-000000000001", {
      amount: "-25000",
      description: "Unrelated merchant",
    });
    const startedAt = Date.now();
    expect(detectDuplicateCandidates({ existing, incoming: [incoming] })).toHaveLength(1);
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });
});

describe("duplicate resolution journal", () => {
  const decision: DuplicateResolutionEvent = {
    type: "decision",
    id: "decision-1",
    candidateId: "candidate-1",
    evidenceSignature: "signature-1",
    action: "keep-both",
    occurredAt: now,
  };

  it("projects active decisions and supports undo followed by a replacement", () => {
    const events: DuplicateResolutionEvent[] = [
      decision,
      { type: "undo", id: "undo-1", decisionId: decision.id, occurredAt: now },
      { ...decision, id: "decision-2", action: "keep-existing" },
    ];
    expect([...activeDuplicateDecisions(events).values()]).toMatchObject([
      { id: "decision-2", action: "keep-existing" },
    ]);
  });

  it("rejects two active decisions for one candidate", () => {
    expect(() => activeDuplicateDecisions([decision, { ...decision, id: "decision-2" }])).toThrow(
      DuplicateResolutionConflictError,
    );
  });

  it("rejects unknown and repeated undo events", () => {
    expect(() =>
      activeDuplicateDecisions([
        { type: "undo", id: "undo-1", decisionId: "missing", occurredAt: now },
      ]),
    ).toThrow(/unknown decision/u);
    expect(() =>
      activeDuplicateDecisions([
        decision,
        { type: "undo", id: "undo-1", decisionId: decision.id, occurredAt: now },
        { type: "undo", id: "undo-2", decisionId: decision.id, occurredAt: now },
      ]),
    ).toThrow(/already undone/u);
  });

  it("projects keep decisions and removes their effects after undo", () => {
    const existing = transaction("20000000-0000-4000-8000-000000000001");
    const incoming = transaction("20000000-0000-4000-8000-000000000002");
    const candidate = detectDuplicateCandidates({ existing: [existing], incoming: [incoming] })[0];
    expect(candidate).toBeDefined();
    if (candidate === undefined) return;
    const keepExisting = {
      ...decision,
      candidateId: candidate.id,
      evidenceSignature: duplicateEvidenceSignature(candidate),
      action: "keep-existing" as const,
    };
    const effects = projectDuplicateResolutionEffects([candidate], [keepExisting]);
    expect([...effects.suppressedIncomingTransactionIds]).toEqual([incoming.id]);
    expect([...effects.suppressedExistingTransactionIds]).toEqual([]);
    const undone = projectDuplicateResolutionEffects(
      [candidate],
      [keepExisting, { type: "undo", id: "undo-1", decisionId: decision.id, occurredAt: now }],
    );
    expect([...undone.suppressedIncomingTransactionIds]).toEqual([]);
  });

  it("applies manual links and remembered choices only while defining evidence matches", () => {
    const existing = transaction("20000000-0000-4000-8000-000000000001");
    const incoming = transaction("20000000-0000-4000-8000-000000000002");
    const candidate = detectDuplicateCandidates({ existing: [existing], incoming: [incoming] })[0];
    expect(candidate).toBeDefined();
    if (candidate === undefined) return;
    const manualLink = {
      ...decision,
      candidateId: candidate.id,
      action: "manual-link" as const,
      evidenceSignature: duplicateEvidenceSignature(candidate),
    };
    expect(applicableDuplicateDecisions([candidate], [manualLink]).has(candidate.id)).toBe(true);
    expect(
      projectDuplicateResolutionEffects([candidate], [manualLink]).manuallyLinkedCandidateIds,
    ).toEqual(new Set([candidate.id]));
    const changedEvidence = {
      ...candidate,
      evidence: [{ code: "amount" as const, weight: 1, detail: "changed" }],
    };
    expect(applicableDuplicateDecisions([changedEvidence], [manualLink]).has(candidate.id)).toBe(
      false,
    );
  });

  it("allows a fingerprint collision or legitimate repeat to remain as two records", () => {
    const existing = transaction("20000000-0000-4000-8000-000000000001", {
      description: "LEGITIMATE FIRST PURCHASE",
    });
    const incoming = transaction("20000000-0000-4000-8000-000000000002", {
      description: "LEGITIMATE SECOND PURCHASE",
    });
    const collision = "f".repeat(64);
    const candidate = detectDuplicateCandidates({
      existing: [existing],
      incoming: [incoming],
      fingerprints: [
        { transactionId: existing.id, value: collision },
        { transactionId: incoming.id, value: collision },
      ],
    })[0]!;
    const keepBoth = {
      ...decision,
      candidateId: candidate.id,
      evidenceSignature: duplicateEvidenceSignature(candidate),
      action: "keep-both" as const,
    };
    const effects = projectDuplicateResolutionEffects([candidate], [keepBoth]);
    expect(effects.suppressedExistingTransactionIds).toEqual(new Set());
    expect(effects.suppressedIncomingTransactionIds).toEqual(new Set());
  });
});
