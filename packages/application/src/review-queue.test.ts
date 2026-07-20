import { describe, expect, it } from "vitest";
import {
  Money,
  createTransaction,
  parseAccountId,
  parseCategoryId,
  parseDateOnly,
  parseImportId,
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
    operation: BulkTransactionOperation,
    restored: readonly DomainTransaction[],
  ): Promise<void> {
    for (const tx of restored) {
      this.transactions.set(tx.id, tx);
    }
  }
}

class InMemoryRuleRepo implements RuleRepository {
  public async list(): Promise<readonly ClassificationRule[]> {
    return [];
  }
  public async findById(_id: RuleId): Promise<ClassificationRule | undefined> {
    return undefined;
  }
  public async save(_rule: ClassificationRule): Promise<void> {}
  public async delete(_id: RuleId): Promise<void> {}
}

class InMemoryMerchantRepo implements MerchantRepository {
  public async list(): Promise<readonly Merchant[]> {
    return [];
  }
  public async findById(_id: MerchantId): Promise<Merchant | undefined> {
    return undefined;
  }
  public async save(_merchant: Merchant): Promise<void> {}
  public async saveMany(_merchants: readonly Merchant[]): Promise<void> {}
}

const mockClock = { now: () => new Date("2026-07-20T10:00:00Z") };
let counter = 1;
const mockIds = { generate: () => `018f6b80-0d62-7d2c-9a5c-7f5f59cda20${counter++}` };

const NOW = parseUtcTimestamp("2026-07-20T10:00:00Z");
const ACCOUNT_ID = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda210");
const IMPORT_ID = parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda220");
const CATEGORY_ID = parseCategoryId("3f791740-0a5b-52a6-9ae1-f46258c30b04");

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
});
