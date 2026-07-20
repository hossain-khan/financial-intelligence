import { describe, expect, it } from "vitest";

import {
  createMerchant,
  createTransaction,
  Money,
  parseAccountId,
  parseImportId,
  parseMerchantId,
  parseTransactionId,
  parseUtcTimestamp,
  parseDateOnly,
  type Category,
  type Merchant,
  type Transaction,
} from "@financial-intelligence/domain";

import type { BulkTransactionOperation, TransactionLedgerRepository } from "./transaction-ledger";
import type { CategoryRepository } from "./categories";
import type { MerchantRepository } from "./merchants";
import type { RecurringDecisionRepository } from "./recurring";
import type { RecurringDecisionRecord } from "@financial-intelligence/domain";
import { FindRecurringProposalsUseCase } from "./recurring";
import {
  QueryMerchantRankingUseCase,
  QueryMoneyFlowUseCase,
  QueryRecurringSummaryUseCase,
  QuerySavingsRateUseCase,
} from "./dashboard";

const NOW = parseUtcTimestamp("2026-07-20T10:00:00Z");
const ACCOUNT_ID = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda111");
const IMPORT_ID = parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda333");

class InMemoryLedger implements TransactionLedgerRepository {
  public constructor(private readonly items: readonly Transaction[]) {}
  public async list(): Promise<readonly Transaction[]> {
    return this.items;
  }
  public async listOperationsForTransaction(): Promise<readonly BulkTransactionOperation[]> {
    return [];
  }
  public async applyBulk(): Promise<void> {}
  public async findOperation(): Promise<BulkTransactionOperation | undefined> {
    return undefined;
  }
  public async undoBulk(): Promise<void> {}
}

class InMemoryMerchantRepo implements MerchantRepository {
  public constructor(private readonly items: readonly Merchant[]) {}
  public async list(): Promise<readonly Merchant[]> {
    return this.items;
  }
  public async save(): Promise<void> {}
  public async saveMany(): Promise<void> {}
  public async findById(): Promise<Merchant | undefined> {
    return undefined;
  }
}

class InMemoryCategoryRepo implements CategoryRepository {
  public constructor(private readonly items: readonly Category[]) {}
  public async list(): Promise<readonly Category[]> {
    return this.items;
  }
  public async save(): Promise<void> {}
  public async putMany(): Promise<void> {}
}

class InMemoryRecurringDecisionRepo implements RecurringDecisionRepository {
  public constructor(private readonly items: readonly RecurringDecisionRecord[] = []) {}
  public async list(): Promise<readonly RecurringDecisionRecord[]> {
    return this.items;
  }
  public async findBySignature(): Promise<RecurringDecisionRecord | undefined> {
    return undefined;
  }
  public async save(): Promise<void> {}
}

describe("Dashboard application use cases", () => {
  it("queries merchant ranking, savings rate, recurring summary, and money flow", async () => {
    const merchantNetflix = createMerchant({
      id: parseMerchantId("018f6b80-0d62-7d2c-9a5c-7f5f59cda001"),
      name: "Netflix",
      now: NOW,
    });

    const txIncome = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda010"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-06-01"),
      money: Money.from("3000.00", "CAD"),
      description: "PAYROLL DEPOSIT",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "1",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const txExpense = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda011"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-06-15"),
      money: Money.from("-16.99", "CAD"),
      description: "NETFLIX.COM",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "2",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const ledger = new InMemoryLedger([txIncome, txExpense]);
    const merchantRepo = new InMemoryMerchantRepo([merchantNetflix]);
    const categoryRepo = new InMemoryCategoryRepo([]);
    const recurringDecisionRepo = new InMemoryRecurringDecisionRepo();

    const queryMerchantRanking = new QueryMerchantRankingUseCase(ledger, merchantRepo);
    const querySavingsRate = new QuerySavingsRateUseCase(ledger, categoryRepo);
    const findRecurringProposals = new FindRecurringProposalsUseCase(ledger, recurringDecisionRepo);
    const queryRecurringSummary = new QueryRecurringSummaryUseCase(
      findRecurringProposals,
      recurringDecisionRepo,
    );
    const queryMoneyFlow = new QueryMoneyFlowUseCase(ledger, categoryRepo);

    const rankingReport = await queryMerchantRanking.execute();
    expect(rankingReport.currencies).toHaveLength(1);
    expect(rankingReport.currencies[0]?.rows[0]?.merchantName).toBe("Netflix");

    const savingsReport = await querySavingsRate.execute();
    expect(savingsReport.currencies).toHaveLength(1);
    expect(savingsReport.currencies[0]?.savingsRate).not.toBe("notApplicable");

    const recurringReport = await queryRecurringSummary.execute();
    expect(recurringReport).toBeDefined();

    const moneyFlowReport = await queryMoneyFlow.execute();
    expect(moneyFlowReport.currencies).toHaveLength(1);
  });
});
