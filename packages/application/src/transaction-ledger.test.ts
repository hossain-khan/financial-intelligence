import { describe, expect, it } from "vitest";

import {
  Money,
  applyManualTransactionEdit,
  createTransaction,
  parseAccountId,
  parseCategoryId,
  parseDateOnly,
  parseImportId,
  parseOperationId,
  parseTransactionId,
  parseUtcTimestamp,
  type Transaction,
} from "@financial-intelligence/domain";

import {
  UndoBulkTransactionEdit,
  planBulkTransactionEdit,
  previewBulkTransactionEdit,
  queryTransactionLedger,
  type BulkTransactionOperation,
  type TransactionLedgerRepository,
} from "./transaction-ledger";

const now = parseUtcTimestamp("2026-07-19T16:00:00.000Z");
const later = parseUtcTimestamp("2026-07-19T17:00:00.000Z");
const accountId = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda301");
const categoryId = parseCategoryId("018f6b80-0d62-7d2c-9a5c-7f5f59cda302");

function transaction(sequence: number, amount: string, description: string): Transaction {
  return createTransaction({
    id: parseTransactionId(
      `018f6b80-0d62-7d2c-9a5c-7f5f59cda3${String(sequence).padStart(2, "0")}`,
    ),
    accountId,
    importId: parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda303"),
    postedDate: parseDateOnly(`2026-07-${String(10 + sequence).padStart(2, "0")}`),
    money: Money.from(amount, "CAD"),
    description,
    provenance: {
      parserId: "csv",
      parserVersion: "1",
      sourceLocation: `row:${sequence}`,
      original: {},
      transformations: [],
    },
    now,
  });
}

describe("transaction ledger query", () => {
  it("combines search, account, date, category, tag, review, status, and amount filters", () => {
    const groceries = applyManualTransactionEdit(
      transaction(1, "-25.50", "Neighbourhood Market"),
      { category: categoryId, notes: "Weekly food", tags: ["family"], reviewState: "reviewed" },
      later,
    );
    const other = transaction(2, "-125.00", "Power company");

    const page = queryTransactionLedger([other, groceries], {
      filter: {
        accountIds: [accountId],
        fromDate: "2026-07-01",
        toDate: "2026-07-31",
        categoryIds: [categoryId],
        reviewStates: ["reviewed"],
        statuses: ["posted"],
        tags: ["FAMILY"],
        search: "weekly FOOD",
        amount: { currency: "CAD", minimum: "-30", maximum: "-20" },
      },
    });

    expect(page.total).toBe(1);
    expect(page.items[0]?.id).toBe(groceries.id);
  });

  it("sorts exact decimal amounts without floating-point conversion and paginates", () => {
    const records = [
      transaction(1, "9007199254740993.01", "Large"),
      transaction(2, "9007199254740993.001", "Smaller"),
      transaction(3, "-1", "Outflow"),
    ];
    const page = queryTransactionLedger(records, {
      sort: { field: "amount", direction: "ascending" },
      offset: 1,
      limit: 1,
    });
    expect(page.total).toBe(3);
    expect(page.items[0]?.description).toBe("Smaller");
  });

  it("supports an explicit uncategorized filter", () => {
    const categorized = applyManualTransactionEdit(
      transaction(1, "-1", "Categorized"),
      { category: categoryId },
      later,
    );
    expect(
      queryTransactionLedger([categorized, transaction(2, "-2", "Uncategorized")], {
        filter: { uncategorized: true },
      }).items.map(({ description }) => description),
    ).toEqual(["Uncategorized"]);
  });

  it("filters currency and signed direction without coupling the two", () => {
    const records = [
      transaction(1, "10", "CAD income"),
      transaction(2, "-2", "CAD spending"),
      { ...transaction(3, "5", "USD income"), money: Money.from("5", "USD") },
    ];
    expect(
      queryTransactionLedger(records, {
        filter: { currencies: ["CAD"], directions: ["inflow"] },
      }).items.map(({ description }) => description),
    ).toEqual(["CAD income"]);
  });

  it("limits dashboard drilldown to the exact contributing transaction IDs", () => {
    const included = transaction(1, "-2", "Included");
    const excluded = transaction(2, "-3", "Excluded");
    const page = queryTransactionLedger([included, excluded], {
      filter: { transactionIds: [included.id] },
    });
    expect(page.items.map(({ id }) => id)).toEqual([included.id]);
  });

  it("keeps a typical 50,000-record query bounded before UI pagination", () => {
    const base = transaction(1, "-1", "Merchant");
    const records = Array.from({ length: 50_000 }, (_, index) => ({
      ...base,
      id: `${base.id.slice(0, -12)}${String(index).padStart(12, "0")}` as Transaction["id"],
      description: index % 100 === 0 ? `Target ${index}` : `Merchant ${index}`,
    }));
    const startedAt = Date.now();
    const page = queryTransactionLedger(records, {
      filter: { search: "target" },
      sort: { field: "description", direction: "ascending" },
      limit: 50,
    });
    expect(page.total).toBe(500);
    expect(page.items).toHaveLength(50);
    expect(Date.now() - startedAt).toBeLessThan(200);
  });
});

describe("bulk transaction editing", () => {
  it("previews affected, unchanged, duplicate selection, and missing counts", () => {
    const first = transaction(1, "-1", "First");
    const alreadyReviewed = applyManualTransactionEdit(
      transaction(2, "-2", "Second"),
      { reviewState: "reviewed" },
      later,
    );
    const missing = parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda399");

    expect(
      previewBulkTransactionEdit(
        [first, alreadyReviewed],
        [first.id, first.id, alreadyReviewed.id, missing],
        { reviewState: "reviewed" },
      ),
    ).toEqual({ selectedCount: 3, affectedCount: 1, unchangedCount: 1, missingCount: 1 });
  });

  it("records complete before/after snapshots for atomic apply and undo", async () => {
    const original = transaction(1, "-1", "First");
    const operation = planBulkTransactionEdit(
      [original],
      [original.id],
      { category: categoryId, tags: ["reviewed"], reviewState: "reviewed" },
      parseOperationId("018f6b80-0d62-7d2c-9a5c-7f5f59cda398"),
      later,
    );
    expect(operation.changes[0]?.before).toBe(original);
    expect(operation.changes[0]?.after).toMatchObject({
      categoryId,
      tags: ["reviewed"],
      reviewState: "reviewed",
    });

    const repository = new MemoryLedgerRepository(
      [operation.changes[0]?.after ?? original],
      operation,
    );
    await new UndoBulkTransactionEdit(repository, {
      now: () => new Date("2026-07-19T18:00:00.000Z"),
    }).execute(operation.id);
    expect(repository.records[0]).toMatchObject({
      id: original.id,
      tags: [],
      reviewState: "unreviewed",
    });
    expect(repository.records[0]?.categoryId).toBeUndefined();
    expect(repository.operation?.undoneAt).toBe("2026-07-19T18:00:00.000Z");
  });
});

class MemoryLedgerRepository implements TransactionLedgerRepository {
  public operation: BulkTransactionOperation | undefined;

  public constructor(
    public records: Transaction[],
    operation?: BulkTransactionOperation,
  ) {
    this.operation = operation;
  }

  public async list(): Promise<readonly Transaction[]> {
    return this.records;
  }

  public async listOperationsForTransaction(): Promise<readonly BulkTransactionOperation[]> {
    return this.operation === undefined ? [] : [this.operation];
  }

  public async applyBulk(operation: BulkTransactionOperation): Promise<void> {
    this.operation = operation;
    const replacements = new Map(
      operation.changes.map((change) => [change.transactionId, change.after]),
    );
    this.records = this.records.map((record) => replacements.get(record.id) ?? record);
  }

  public async findOperation(): Promise<BulkTransactionOperation | undefined> {
    return this.operation;
  }

  public async undoBulk(
    operation: BulkTransactionOperation,
    restored: readonly Transaction[],
    undoneAt: ReturnType<typeof parseUtcTimestamp>,
  ): Promise<void> {
    const replacements = new Map(restored.map((record) => [record.id, record]));
    this.records = this.records.map((record) => replacements.get(record.id) ?? record);
    this.operation = { ...operation, undoneAt };
  }
}
