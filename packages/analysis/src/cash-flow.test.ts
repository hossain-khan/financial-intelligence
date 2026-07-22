import {
  Money,
  createCategory,
  createTransaction,
  parseAccountId,
  parseCategoryId,
  parseDateOnly,
  parseImportId,
  parseMerchantId,
  parseTransactionId,
  parseUtcTimestamp,
  type Category,
  type Transaction,
} from "@financial-intelligence/domain";
import { describe, expect, it } from "vitest";

import {
  analyzeCashFlow,
  createTransactionExportCsv,
  filterCashFlowTransactions,
  spreadsheetSafeCell,
} from "./cash-flow";

const now = parseUtcTimestamp("2026-07-19T12:00:00.000Z");
const checking = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda201");
const savings = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda202");
const groceries = category("018f6b80-0d62-7d2c-9a5c-7f5f59cda211", "Groceries", "expense");
const transfers = category("018f6b80-0d62-7d2c-9a5c-7f5f59cda212", "Transfers", "transfer");

function category(
  id: string,
  name: string,
  kind: "income" | "expense" | "transfer" | "other",
): Category {
  return createCategory({ id: parseCategoryId(id), name, kind, order: 1, now });
}

function transaction(
  sequence: number,
  amount: string,
  date: string,
  override: Partial<{
    accountId: typeof checking;
    categoryId: Category["id"];
    currency: string;
    description: string;
    status: "pending" | "posted" | "void";
    reviewState: "unreviewed" | "needsReview" | "reviewed";
    merchantId: ReturnType<typeof parseMerchantId>;
    tags: readonly string[];
  }> = {},
): Transaction {
  return createTransaction({
    id: parseTransactionId(`018f6b80-0d62-7d2c-9a5c-7f5f59cd${String(sequence).padStart(4, "0")}`),
    accountId: override.accountId ?? checking,
    importId: parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda220"),
    postedDate: parseDateOnly(date),
    money: Money.from(amount, override.currency ?? "CAD"),
    description: override.description ?? `Transaction ${sequence}`,
    ...(override.categoryId === undefined ? {} : { categoryId: override.categoryId }),
    ...(override.status === undefined ? {} : { status: override.status }),
    ...(override.reviewState === undefined ? {} : { reviewState: override.reviewState }),
    ...(override.merchantId === undefined ? {} : { merchantId: override.merchantId }),
    ...(override.tags === undefined ? {} : { tags: override.tags }),
    provenance: {
      parserId: "csv",
      parserVersion: "1",
      sourceLocation: `line:${sequence}`,
      original: {},
      transformations: ["mapping:1"],
    },
    now,
  });
}

describe("cash-flow analysis", () => {
  it("reconciles an exact dashboard transaction selection", () => {
    const included = transaction(1, "-12.34", "2026-06-01", { categoryId: groceries.id });
    const excluded = transaction(2, "-99.99", "2026-06-02", { categoryId: groceries.id });
    const report = analyzeCashFlow({
      transactions: [included, excluded],
      categories: [groceries],
      filter: { transactionIds: [included.id] },
      asOfDate: "2026-07-19",
    });
    expect(report.currencies[0]?.spending).toBe("12.34");
    expect(report.currencies[0]?.transactionIds).toEqual([included.id]);
  });

  it("uses decimal-safe arithmetic and keeps transfers out of cash-flow totals", () => {
    const report = analyzeCashFlow({
      transactions: [
        transaction(1, "1000.10", "2026-06-01"),
        transaction(2, "-0.10", "2026-06-02", { categoryId: groceries.id }),
        transaction(3, "-100", "2026-06-03", { categoryId: transfers.id }),
        transaction(4, "100", "2026-06-03", {
          accountId: savings,
          categoryId: transfers.id,
        }),
        transaction(5, "0", "2026-06-04"),
      ],
      categories: [groceries, transfers],
      asOfDate: "2026-07-19",
    });
    expect(report.currencies[0]).toMatchObject({
      currency: "CAD",
      income: "1000.1",
      spending: "0.1",
      transfers: "200",
      netCashFlow: "1000",
      takeaway: "Income exceeds spending by CAD 1000.",
    });
    expect(report.currencies[0]?.accounts).toMatchObject([
      { accountId: checking, income: "1000.1", spending: "0.1", transfers: "100" },
      { accountId: savings, income: "0", spending: "0", transfers: "100" },
    ]);
  });

  it("separates currencies and discloses unresolved and void duplicate effects", () => {
    const report = analyzeCashFlow({
      transactions: [
        transaction(1, "10", "2026-07-01", { reviewState: "needsReview" }),
        transaction(2, "10", "2026-07-01", { status: "void" }),
        transaction(3, "5", "2026-07-01", { currency: "USD" }),
      ],
      categories: [],
      asOfDate: "2026-07-19",
    });
    expect(report.mixedCurrencies).toBe(true);
    expect(report.currencies).toMatchObject([
      { currency: "CAD", income: "10", unresolvedReviewCount: 1, excludedVoidCount: 1 },
      { currency: "USD", income: "5", unresolvedReviewCount: 0, excludedVoidCount: 0 },
    ]);
  });

  it("marks current and range-clipped months incomplete", () => {
    const report = analyzeCashFlow({
      transactions: [transaction(1, "10", "2026-06-15"), transaction(2, "20", "2026-07-10")],
      categories: [],
      filter: { fromDate: "2026-06-15", toDate: "2026-07-19" },
      asOfDate: "2026-07-19",
    });
    expect(
      report.currencies[0]?.months.map(({ month, incomplete }) => [month, incomplete]),
    ).toEqual([
      ["2026-06", true],
      ["2026-07", true],
    ]);
  });

  it("keeps summary and drill-down filters reproducible", () => {
    const records = [
      transaction(1, "-10", "2026-05-01", { categoryId: groceries.id }),
      transaction(2, "-20", "2026-06-01", { accountId: savings }),
      transaction(3, "-30", "2026-06-02", { currency: "USD" }),
    ];
    const filter = {
      accountIds: [checking],
      categoryIds: [groceries.id],
      currencies: ["CAD"],
      fromDate: "2026-05-01",
      toDate: "2026-05-31",
    };
    const filtered = filterCashFlowTransactions(records, filter);
    const report = analyzeCashFlow({
      transactions: records,
      categories: [groceries],
      filter,
      asOfDate: "2026-07-19",
    });
    expect(filtered.map(({ id }) => id)).toEqual(report.currencies[0]?.transactionIds);
    expect(report.currencies[0]?.categories[0]?.transactionIds).toEqual([records[0]?.id]);
  });

  it("applies merchant, tag, and review filters through the shared contract", () => {
    const merchantId = parseMerchantId("018f6b80-0d62-7d2c-9a5c-7f5f59cda299");
    const included = transaction(11, "-10", "2026-06-01", {
      merchantId,
      tags: ["family"],
      reviewState: "reviewed",
    });
    const records = [
      included,
      transaction(12, "-20", "2026-06-02", { merchantId, tags: ["work"] }),
      transaction(13, "-30", "2026-06-03", { tags: ["family"], reviewState: "reviewed" }),
    ];
    const filter = {
      merchantIds: [merchantId],
      tags: ["family"],
      reviewStates: ["reviewed"] as const,
    };
    expect(filterCashFlowTransactions(records, filter).map(({ id }) => id)).toEqual([included.id]);
    expect(
      analyzeCashFlow({ transactions: records, categories: [], filter, asOfDate: "2026-07-19" })
        .currencies[0]?.transactionIds,
    ).toEqual([included.id]);
  });

  it("rejects invalid ranges instead of silently changing them", () => {
    expect(() =>
      analyzeCashFlow({
        transactions: [],
        categories: [],
        filter: { fromDate: "2026-07-02", toDate: "2026-07-01" },
        asOfDate: "2026-07-19",
      }),
    ).toThrow(/start date/u);
  });

  it.each([10_000, 50_000])(
    "keeps a typical %i-record aggregation under the dashboard target",
    (recordCount) => {
      const base = transaction(1, "-0.01", "2026-06-01", { categoryId: groceries.id });
      const records = Array.from({ length: recordCount }, (_, index) => ({
        ...base,
        id: parseTransactionId(`018f6b80-0d62-7d2c-9a5c-${String(index).padStart(12, "0")}`),
      }));
      const startedAt = Date.now();
      const report = analyzeCashFlow({
        transactions: records,
        categories: [groceries],
        asOfDate: "2026-07-19",
      });
      expect(report.currencies[0]?.spending).toBe(String(recordCount / 100));
      expect(Date.now() - startedAt).toBeLessThan(5_000);
    },
  );
});

describe("filtered transaction CSV export", () => {
  it("escapes CSV and neutralizes spreadsheet formulas in every text cell", () => {
    const record = transaction(1, "-10", "2026-06-01", {
      categoryId: groceries.id,
      description: '=HYPERLINK("https://example.invalid","click")',
    });
    const csv = createTransactionExportCsv([record], {
      filterSummary: "+unsafe filter",
      accountNames: new Map([[checking, "Everyday, account"]]),
      categoryNames: new Map([[groceries.id, "Groceries"]]),
    });
    expect(csv).toContain('"\'=HYPERLINK(""https://example.invalid"",""click"")"');
    expect(csv).toContain('"Everyday, account"');
    expect(csv).toContain(",-10,CAD,");
    expect(csv).toContain("'+unsafe filter");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it.each([
    "=1+1",
    "+cmd",
    "-2+3",
    "@SUM(A:A)",
    "\t=1",
    "\tcmd",
    "\r123",
    "   +123",
    "   -456",
    "   =SUM(A:A)",
    "   @SUM",
    "   \tcmd",
  ])("makes formula trigger %j spreadsheet-safe by prefixing single quote", (value) =>
    expect(spreadsheetSafeCell(value)).toBe(`'${value}`),
  );

  it.each(["Store Name", "100.00", "Coffee & Tea", ""])(
    "leaves safe text value %j unchanged",
    (value) => expect(spreadsheetSafeCell(value)).toBe(value),
  );
});
