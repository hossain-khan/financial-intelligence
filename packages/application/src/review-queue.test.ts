import { describe, expect, it, vi } from "vitest";
import {
  Money,
  createMerchant,
  createTransaction,
  parseAccountId,
  parseCategoryId,
  parseDateOnly,
  parseImportId,
  parseMerchantId,
  parseRuleId,
  parseTransactionId,
  parseUtcTimestamp,
  type ClassificationRule,
  type Transaction as DomainTransaction,
  type Merchant,
  type MerchantId,
  type RuleId,
} from "@financial-intelligence/domain";

import type { MerchantRepository } from "./merchants";
import type { RuleRepository } from "./rules";
import { ApplyReviewCorrectionUseCase, QueryReviewQueue } from "./review-queue";
import {
  ApplyBulkTransactionEdit,
  type BulkTransactionOperation,
  type TransactionLedgerRepository,
} from "./transaction-ledger";

class InMemoryLedgerRepository implements TransactionLedgerRepository {
  private readonly transactions = new Map<string, DomainTransaction>();

  public async list(): Promise<readonly DomainTransaction[]> {
    return Array.from(this.transactions.values());
  }

  public async save(transaction: DomainTransaction): Promise<void> {
    this.transactions.set(transaction.id, transaction);
  }

  public async listOperationsForTransaction(): Promise<readonly BulkTransactionOperation[]> {
    return [];
  }

  public async findOperation(): Promise<BulkTransactionOperation | undefined> {
    return undefined;
  }

  public async applyBulk(operation: BulkTransactionOperation): Promise<void> {
    for (const change of operation.changes) {
      this.transactions.set(change.transactionId, change.after);
    }
  }

  public async undoBulk(
    _operation: BulkTransactionOperation,
    restored: readonly DomainTransaction[],
  ): Promise<void> {
    for (const tx of restored) {
      this.transactions.set(tx.id, tx);
    }
  }
}

class InMemoryRuleRepo implements RuleRepository {
  private readonly rules = new Map<string, ClassificationRule>();

  public async list(): Promise<readonly ClassificationRule[]> {
    return Array.from(this.rules.values());
  }
  public async findById(id: RuleId): Promise<ClassificationRule | undefined> {
    return this.rules.get(id);
  }
  public async save(rule: ClassificationRule): Promise<void> {
    this.rules.set(rule.id, rule);
  }
  public async delete(id: RuleId): Promise<void> {
    this.rules.delete(id);
  }
}

class InMemoryMerchantRepo implements MerchantRepository {
  private readonly merchants = new Map<string, Merchant>();

  public async list(): Promise<readonly Merchant[]> {
    return Array.from(this.merchants.values());
  }
  public async findById(id: MerchantId): Promise<Merchant | undefined> {
    return this.merchants.get(id);
  }
  public async save(merchant: Merchant): Promise<void> {
    this.merchants.set(merchant.id, merchant);
  }
  public async saveMany(merchants: readonly Merchant[]): Promise<void> {
    for (const m of merchants) {
      this.merchants.set(m.id, m);
    }
  }
}

const mockClock = { now: () => new Date("2026-07-20T10:00:00Z") };
let counter = 1;
const mockIds = { generate: () => `018f6b80-0d62-7d2c-9a5c-7f5f59cda20${counter++}` };

const NOW = parseUtcTimestamp("2026-07-20T10:00:00Z");
const ACCOUNT_ID = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda210");
const OTHER_ACCOUNT_ID = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda211");
const IMPORT_ID = parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda220");
const CATEGORY_ID = parseCategoryId("3f791740-0a5b-52a6-9ae1-f46258c30b04");
const MERCHANT_ID = parseMerchantId("018f6b80-0d62-7d2c-9a5c-7f5f59cda230");

describe("Review Queue Application Services", () => {
  it("queries review queue and applies bulk review corrections", async () => {
    const ledgerRepo = new InMemoryLedgerRepository();
    const ruleRepo = new InMemoryRuleRepo();
    const merchantRepo = new InMemoryMerchantRepo();

    const tx = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda201"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-20"),
      money: Money.from("-25.00", "CAD"),
      description: "UNCATEGORIZED STORE",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "line:1",
        original: {},
        transformations: [],
      },
      now: NOW,
    });
    await ledgerRepo.save(tx);

    const queryQueue = new QueryReviewQueue(ledgerRepo, ruleRepo, merchantRepo);
    const result = await queryQueue.execute();

    expect(result.totalCount).toBe(1);
    expect(result.items[0]?.reason).toBe("unclassified");

    const applyBulkEdit = new ApplyBulkTransactionEdit(ledgerRepo, mockClock, mockIds);
    const applyCorrection = new ApplyReviewCorrectionUseCase(applyBulkEdit);

    const correctionResult = await applyCorrection.execute({
      transactionIds: [tx.id],
      categoryId: CATEGORY_ID,
    });

    expect(correctionResult.updatedCount).toBe(1);

    const postQuery = await queryQueue.execute();
    expect(postQuery.totalCount).toBe(0);
  });

  it("filters review queue items by accountId and reason", async () => {
    const ledgerRepo = new InMemoryLedgerRepository();
    const ruleRepo = new InMemoryRuleRepo();
    const merchantRepo = new InMemoryMerchantRepo();

    const tx1 = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda201"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-20"),
      money: Money.from("-25.00", "CAD"),
      description: "STORE 1",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "line:1",
        original: {},
        transformations: [],
      },
      now: NOW,
    });
    const tx2 = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda202"),
      accountId: OTHER_ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-21"),
      money: Money.from("-50.00", "CAD"),
      description: "STORE 2",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "line:2",
        original: {},
        transformations: [],
      },
      now: NOW,
    });
    await ledgerRepo.save(tx1);
    await ledgerRepo.save(tx2);

    const queryQueue = new QueryReviewQueue(ledgerRepo, ruleRepo, merchantRepo);

    const accountFilter = await queryQueue.execute({ accountId: ACCOUNT_ID });
    expect(accountFilter.items).toHaveLength(1);
    expect(accountFilter.items[0]?.transactionId).toBe(tx1.id);

    const reasonFilter = await queryQueue.execute({ reason: "unclassified" });
    expect(reasonFilter.items).toHaveLength(2);
    // Should be sorted by postedDate descending: tx2 (2026-07-21) before tx1 (2026-07-20)
    expect(reasonFilter.items[0]?.transactionId).toBe(tx2.id);
  });

  it("throws when empty transactionIds array is passed to correction use case", async () => {
    const ledgerRepo = new InMemoryLedgerRepository();
    const applyBulkEdit = new ApplyBulkTransactionEdit(ledgerRepo, mockClock, mockIds);
    const applyCorrection = new ApplyReviewCorrectionUseCase(applyBulkEdit);

    await expect(applyCorrection.execute({ transactionIds: [] })).rejects.toThrow(
      "At least one transaction must be selected for correction",
    );
  });

  it("creates merchant alias during correction when addMerchantAliasUseCase is provided", async () => {
    const ledgerRepo = new InMemoryLedgerRepository();
    const merchantRepo = new InMemoryMerchantRepo();

    const merchant = createMerchant({
      id: MERCHANT_ID,
      name: "Tim Hortons",
      now: NOW,
    });
    await merchantRepo.save(merchant);

    const tx = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda201"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-20"),
      money: Money.from("-5.00", "CAD"),
      description: "TIM HORTONS #1234",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "line:1",
        original: {},
        transformations: [],
      },
      now: NOW,
    });
    await ledgerRepo.save(tx);

    const applyBulkEdit = new ApplyBulkTransactionEdit(ledgerRepo, mockClock, mockIds);
    const mockAddAliasUseCase = {
      execute: vi.fn().mockResolvedValue(undefined),
    };

    const applyCorrection = new ApplyReviewCorrectionUseCase(
      applyBulkEdit,
      undefined,
      mockAddAliasUseCase as never,
    );

    const result = await applyCorrection.execute({
      transactionIds: [tx.id],
      categoryId: CATEGORY_ID,
      merchantId: MERCHANT_ID,
      createMerchantAlias: {
        merchantId: MERCHANT_ID,
        pattern: "TIM HORTONS",
        matchMode: "tokenPrefix",
      },
    });

    expect(result.updatedCount).toBe(1);
    expect(mockAddAliasUseCase.execute).toHaveBeenCalledWith({
      merchantId: MERCHANT_ID,
      pattern: "TIM HORTONS",
      matchMode: "tokenPrefix",
    });
  });

  it("creates rule during correction when createRuleUseCase is provided", async () => {
    const ledgerRepo = new InMemoryLedgerRepository();
    const tx = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda201"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-20"),
      money: Money.from("-12.00", "CAD"),
      description: "COFFEE SHOP",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "line:1",
        original: {},
        transformations: [],
      },
      now: NOW,
    });
    await ledgerRepo.save(tx);

    const applyBulkEdit = new ApplyBulkTransactionEdit(ledgerRepo, mockClock, mockIds);
    const createdRuleId = parseRuleId("018f6b80-0d62-7d2c-9a5c-7f5f59cda299");
    const mockCreateRuleUseCase = {
      execute: vi.fn().mockResolvedValue({ id: createdRuleId }),
    };

    const applyCorrection = new ApplyReviewCorrectionUseCase(
      applyBulkEdit,
      mockCreateRuleUseCase as never,
    );

    const result = await applyCorrection.execute({
      transactionIds: [tx.id],
      categoryId: CATEGORY_ID,
      createRule: {
        name: "Coffee Shop Rule",
        conditions: [
          { field: "normalizedDescription", operator: "startsWith", value: "coffee shop" },
        ],
        actions: [{ type: "setCategory", value: CATEGORY_ID }],
      },
    });

    expect(result.updatedCount).toBe(1);
    expect(result.createdRuleId).toBe(createdRuleId);
    expect(mockCreateRuleUseCase.execute).toHaveBeenCalled();
  });
});
