import {
  Money,
  createAccount,
  createCategory,
  createTransaction,
  parseAccountId,
  parseCategoryId,
  parseDateOnly,
  parseImportId,
  parseTransactionId,
  parseUtcTimestamp,
  parseWorkspaceId,
} from "@financial-intelligence/domain";
import { describe, expect, it } from "vitest";

import type { AccountRepository } from "./accounts";
import type { CategoryRepository } from "./categories";
import { ExportFilteredTransactions, QueryCashFlowSummary } from "./summaries";
import type { TransactionLedgerRepository } from "./transaction-ledger";

const now = parseUtcTimestamp("2026-07-19T12:00:00.000Z");
const account = createAccount({
  id: parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda201"),
  workspaceId: parseWorkspaceId("018f6b80-0d62-7d2c-9a5c-7f5f59cda200"),
  name: "Everyday",
  type: "checking",
  currency: "CAD",
  now,
});
const category = createCategory({
  id: parseCategoryId("018f6b80-0d62-7d2c-9a5c-7f5f59cda211"),
  name: "Groceries",
  kind: "expense",
  order: 1,
  now,
});
const transaction = createTransaction({
  id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda221"),
  accountId: account.id,
  importId: parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda220"),
  postedDate: parseDateOnly("2026-06-01"),
  money: Money.from("-12.34", "CAD"),
  description: "=UNSAFE",
  categoryId: category.id,
  provenance: {
    parserId: "csv",
    parserVersion: "1",
    sourceLocation: "line:2",
    original: {},
    transformations: [],
  },
  now,
});

const ledger = { list: async () => [transaction] } as unknown as TransactionLedgerRepository;
const categories = { list: async () => [category] } as unknown as CategoryRepository;
const accounts = { findById: async () => account } as unknown as AccountRepository;
const clock = { now: () => new Date("2026-07-19T12:00:00.000Z") };

describe("summary application services", () => {
  it("queries deterministic analysis through repository ports", async () => {
    const report = await new QueryCashFlowSummary(ledger, categories, clock).execute({
      currencies: ["CAD"],
    });
    expect(report.currencies[0]).toMatchObject({ currency: "CAD", spending: "12.34" });
  });

  it("exports exactly the filtered records with safe spreadsheet cells", async () => {
    const exported = await new ExportFilteredTransactions(
      ledger,
      accounts,
      categories,
      clock,
    ).execute({ currencies: ["CAD"] });
    expect(exported).toMatchObject({
      mediaType: "text/csv;charset=utf-8",
      fileName: "financial-intelligence-transactions-2026-07-19.csv",
      rowCount: 1,
    });
    expect(exported.content).toContain("'=UNSAFE");
    expect(exported.content).toContain("Everyday");
    expect(exported.content).toContain("Groceries");
  });
});
