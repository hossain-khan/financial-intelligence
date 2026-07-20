import {
  analyzeCashFlow,
  createTransactionExportCsv,
  filterCashFlowTransactions,
  type CashFlowFilter,
  type CashFlowReport,
} from "@financial-intelligence/analysis";
import type { AccountId, CategoryId } from "@financial-intelligence/domain";

import type { AccountRepository } from "./accounts";
import type { CategoryRepository } from "./categories";
import type { TransactionLedgerRepository } from "./transaction-ledger";
import type { ApplicationClock } from "./workspaces";

export class QueryCashFlowSummary {
  public constructor(
    private readonly transactions: TransactionLedgerRepository,
    private readonly categories: CategoryRepository,
    private readonly clock: ApplicationClock,
  ) {}

  public async execute(filter: CashFlowFilter = {}): Promise<CashFlowReport> {
    const [transactions, categories] = await Promise.all([
      this.transactions.list(),
      this.categories.list(),
    ]);
    return analyzeCashFlow({
      transactions,
      categories,
      filter,
      asOfDate: this.clock.now().toISOString().slice(0, 10),
    });
  }
}

export interface TransactionCsvExport {
  readonly mediaType: "text/csv;charset=utf-8";
  readonly fileName: string;
  readonly content: string;
  readonly rowCount: number;
  readonly filterSummary: string;
}

export class ExportFilteredTransactions {
  public constructor(
    private readonly transactions: TransactionLedgerRepository,
    private readonly accounts: AccountRepository,
    private readonly categories: CategoryRepository,
    private readonly clock: ApplicationClock,
  ) {}

  public async execute(filter: CashFlowFilter = {}): Promise<TransactionCsvExport> {
    const exportDate = this.clock.now().toISOString().slice(0, 10);
    const [allTransactions, categories] = await Promise.all([
      this.transactions.list(),
      this.categories.list(),
    ]);
    const filtered = filterCashFlowTransactions(allTransactions, filter);
    const accountIds = [...new Set(filtered.map(({ accountId }) => accountId))];
    const accounts = await Promise.all(accountIds.map((id) => this.accounts.findById(id)));
    const report = analyzeCashFlow({
      transactions: allTransactions,
      categories,
      filter,
      asOfDate: exportDate,
    });
    const accountNames = new Map<AccountId, string>();
    for (const account of accounts) {
      if (account !== undefined) accountNames.set(account.id, account.name);
    }
    const categoryNames = new Map<CategoryId, string>();
    for (const category of categories) categoryNames.set(category.id, category.name);
    return {
      mediaType: "text/csv;charset=utf-8",
      fileName: `financial-intelligence-transactions-${exportDate}.csv`,
      content: createTransactionExportCsv(filtered, {
        filterSummary: report.filterSummary,
        accountNames,
        categoryNames,
      }),
      rowCount: filtered.length,
      filterSummary: report.filterSummary,
    };
  }
}

export type { CashFlowFilter, CashFlowReport } from "@financial-intelligence/analysis";
