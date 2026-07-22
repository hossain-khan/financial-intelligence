import {
  Money,
  createTransaction,
  parseAccountId,
  parseDateOnly,
  parseImportId,
  parseTransactionId,
  parseUtcTimestamp,
  type ClassificationRule,
  type Merchant,
  type Transaction,
} from "@financial-intelligence/domain";
import { describe, expect, it, vi } from "vitest";

import {
  AcceptSuggestion,
  RejectSuggestion,
  SuggestionStaleError,
  type AiSuggestionRepository,
  type PersistedSuggestion,
} from "./ai-suggestions";
import type { ApplyReviewCorrectionUseCase } from "./review-queue";
import type { TransactionLedgerRepository } from "./transaction-ledger";

const NOW = parseUtcTimestamp("2026-07-20T00:00:00.000Z");
const ACCOUNT_ID = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda202");
const IMPORT_ID = parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda203");
const TXN_ID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda301";

function txn(over: Partial<Parameters<typeof createTransaction>[0]> = {}): Transaction {
  return createTransaction({
    id: parseTransactionId(TXN_ID),
    accountId: ACCOUNT_ID,
    importId: IMPORT_ID,
    postedDate: parseDateOnly("2026-07-20"),
    money: Money.from("-12.50", "CAD"),
    description: "UNKNOWN COFFEE SHOP",
    provenance: { parserId: "csv", parserVersion: "1.0.0", sourceLocation: "l", original: {}, transformations: [] },
    now: NOW,
    ...over,
  });
}

function suggestion(over: Partial<PersistedSuggestion> = {}): PersistedSuggestion {
  return {
    id: "sug-1",
    targetTransactionId: TXN_ID,
    targetUpdatedAt: NOW,
    normalizedDigest: "unknown coffee shop",
    task: "category.classify.v1",
    taskVersion: "1.0.0",
    schemaVersion: "1.0.0",
    promptVersion: "1.0.0",
    minimizerVersion: "1.0.0",
    classifierVersion: "1.0.0",
    proposal: { kind: "category", categoryId: "018f6b80-0d62-7d2c-9a5c-7f5f59cda401" },
    confidence: 0.9,
    evidenceCodes: ["model_category_candidate"],
    rationale: "",
    provider: { profileId: "p", adapterId: "ai-local", reportedModel: "m", executionLocation: "local" },
    requestAuditId: "audit-1",
    status: "pending",
    createdAt: NOW,
    expiresAt: "2026-07-21T00:00:00.000Z",
    ...over,
  };
}

class MemoryRepo implements AiSuggestionRepository {
  public constructor(public items: PersistedSuggestion[]) {}
  public save(s: PersistedSuggestion) {
    this.items.push(s);
    return Promise.resolve();
  }
  public listPending() {
    return Promise.resolve(this.items.filter((s) => s.status === "pending"));
  }
  public findById(id: string) {
    return Promise.resolve(this.items.find((s) => s.id === id));
  }
  public setStatus(id: string, status: PersistedSuggestion["status"]) {
    const found = this.items.find((s) => s.id === id);
    if (found !== undefined) this.items[this.items.indexOf(found)] = { ...found, status };
    return Promise.resolve();
  }
  public listRejectedKeys() {
    return Promise.resolve([]);
  }
}

function ledger(transactions: readonly Transaction[]): TransactionLedgerRepository {
  return { list: () => Promise.resolve(transactions) } as unknown as TransactionLedgerRepository;
}

function deps(repo: MemoryRepo, transactions: readonly Transaction[], apply: { execute: ReturnType<typeof vi.fn> }) {
  return {
    repository: repo,
    applyReviewCorrection: apply as unknown as ApplyReviewCorrectionUseCase,
    ledgerRepository: ledger(transactions),
    rules: () => Promise.resolve([] as ClassificationRule[]),
    merchants: () => Promise.resolve([] as Merchant[]),
  };
}

describe("AcceptSuggestion", () => {
  it("applies a category suggestion with localAi provenance", async () => {
    const repo = new MemoryRepo([suggestion()]);
    const apply = { execute: vi.fn().mockResolvedValue({ operationId: "op-1", updatedCount: 1 }) };
    const result = await new AcceptSuggestion(deps(repo, [txn()], apply)).execute({ suggestionId: "sug-1" });
    expect(result.applied).toBe(true);
    const call = apply.execute.mock.calls[0]![0];
    expect(call.provenance.method).toBe("localAi");
    expect(call.categoryId).toBeDefined();
    expect(repo.items[0]!.status).toBe("accepted");
  });

  it("refuses (stale) when the transaction updatedAt changed", async () => {
    const repo = new MemoryRepo([suggestion({ targetUpdatedAt: "2020-01-01T00:00:00.000Z" })]);
    const apply = { execute: vi.fn() };
    await expect(
      new AcceptSuggestion(deps(repo, [txn()], apply)).execute({ suggestionId: "sug-1" }),
    ).rejects.toBeInstanceOf(SuggestionStaleError);
    expect(apply.execute).not.toHaveBeenCalled();
    expect(repo.items[0]!.status).toBe("stale");
  });

  it("refuses (stale) when the transaction no longer exists", async () => {
    const repo = new MemoryRepo([suggestion()]);
    const apply = { execute: vi.fn() };
    await expect(
      new AcceptSuggestion(deps(repo, [], apply)).execute({ suggestionId: "sug-1" }),
    ).rejects.toBeInstanceOf(SuggestionStaleError);
    expect(apply.execute).not.toHaveBeenCalled();
  });

  it("refuses a merchant suggestion without a resolved merchant id", async () => {
    const repo = new MemoryRepo([suggestion({ proposal: { kind: "merchant", merchantLabel: "coffee co" } })]);
    const apply = { execute: vi.fn() };
    await expect(
      new AcceptSuggestion(deps(repo, [txn()], apply)).execute({ suggestionId: "sug-1" }),
    ).rejects.toBeInstanceOf(SuggestionStaleError);
    expect(apply.execute).not.toHaveBeenCalled();
  });
});

describe("RejectSuggestion", () => {
  it("marks a suggestion rejected", async () => {
    const repo = new MemoryRepo([suggestion()]);
    await new RejectSuggestion({ repository: repo }).execute({ suggestionId: "sug-1" });
    expect(repo.items[0]!.status).toBe("rejected");
  });
});
