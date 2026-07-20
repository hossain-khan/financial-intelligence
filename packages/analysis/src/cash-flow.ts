import {
  Money,
  parseAccountId,
  parseCategoryId,
  parseDateOnly,
  type AccountId,
  type Category,
  type CategoryId,
  type DateOnly,
  type Transaction,
  type TransactionId,
} from "@financial-intelligence/domain";

export interface CashFlowFilter {
  readonly accountIds?: readonly string[];
  readonly categoryIds?: readonly string[];
  readonly currencies?: readonly string[];
  readonly fromDate?: string;
  readonly toDate?: string;
}

export interface CashFlowMonthRow {
  readonly month: string;
  readonly income: string;
  readonly spending: string;
  readonly transfers: string;
  readonly netCashFlow: string;
  readonly incomplete: boolean;
  readonly transactionIds: readonly TransactionId[];
}

export interface CashFlowCategoryRow {
  readonly categoryId?: CategoryId;
  readonly categoryName: string;
  readonly spending: string;
  readonly transactionIds: readonly TransactionId[];
}

export interface CashFlowAccountRow {
  readonly accountId: AccountId;
  readonly income: string;
  readonly spending: string;
  readonly transfers: string;
  readonly netCashFlow: string;
  readonly transactionIds: readonly TransactionId[];
}

export interface CashFlowCurrencyReport {
  readonly currency: string;
  readonly income: string;
  readonly spending: string;
  readonly transfers: string;
  readonly netCashFlow: string;
  readonly unresolvedReviewCount: number;
  readonly excludedVoidCount: number;
  readonly months: readonly CashFlowMonthRow[];
  readonly accounts: readonly CashFlowAccountRow[];
  readonly categories: readonly CashFlowCategoryRow[];
  readonly transactionIds: readonly TransactionId[];
  readonly incomeTransactionIds: readonly TransactionId[];
  readonly spendingTransactionIds: readonly TransactionId[];
  readonly transferTransactionIds: readonly TransactionId[];
  readonly cashFlowTransactionIds: readonly TransactionId[];
  readonly takeaway: string;
}

export interface CashFlowReport {
  readonly filter: CashFlowFilter;
  readonly filterSummary: string;
  readonly mixedCurrencies: boolean;
  readonly currencies: readonly CashFlowCurrencyReport[];
}

export interface AnalyzeCashFlowInput {
  readonly transactions: readonly Transaction[];
  readonly categories: readonly Category[];
  readonly filter?: CashFlowFilter;
  /** Explicit to keep incomplete-period results deterministic in tests and exports. */
  readonly asOfDate: string;
}

interface NormalizedFilter {
  readonly accountIds?: ReadonlySet<AccountId>;
  readonly categoryIds?: ReadonlySet<CategoryId>;
  readonly currencies?: ReadonlySet<string>;
  readonly fromDate?: DateOnly;
  readonly toDate?: DateOnly;
}

export function analyzeCashFlow(input: AnalyzeCashFlowInput): CashFlowReport {
  const asOfDate = parseDateOnly(input.asOfDate);
  const filter = input.filter ?? {};
  const normalized = normalizeFilter(filter);
  const filtered = filterCashFlowTransactions(input.transactions, filter);
  const categoryById = new Map(input.categories.map((category) => [category.id, category]));
  const currencies = [...new Set(filtered.map((transaction) => transaction.money.currency))].sort();
  return {
    filter,
    filterSummary: describeFilter(filter),
    mixedCurrencies: currencies.length > 1,
    currencies: currencies.map((currency) =>
      analyzeCurrency(
        currency,
        filtered.filter((transaction) => transaction.money.currency === currency),
        input.transactions,
        categoryById,
        normalized,
        asOfDate,
      ),
    ),
  };
}

export function filterCashFlowTransactions(
  transactions: readonly Transaction[],
  filter: CashFlowFilter = {},
): readonly Transaction[] {
  const normalized = normalizeFilter(filter);
  return transactions.filter((transaction) => {
    if (normalized.accountIds !== undefined && !normalized.accountIds.has(transaction.accountId))
      return false;
    if (normalized.categoryIds !== undefined) {
      if (
        transaction.categoryId === undefined ||
        !normalized.categoryIds.has(transaction.categoryId)
      )
        return false;
    }
    if (
      normalized.currencies !== undefined &&
      !normalized.currencies.has(transaction.money.currency)
    )
      return false;
    if (normalized.fromDate !== undefined && transaction.postedDate < normalized.fromDate)
      return false;
    if (normalized.toDate !== undefined && transaction.postedDate > normalized.toDate) return false;
    return true;
  });
}

function analyzeCurrency(
  currency: string,
  transactions: readonly Transaction[],
  allTransactions: readonly Transaction[],
  categoryById: ReadonlyMap<CategoryId, Category>,
  filter: NormalizedFilter,
  asOfDate: DateOnly,
): CashFlowCurrencyReport {
  const included = transactions.filter((transaction) => transaction.status !== "void");
  const excludedVoidCount = allTransactions.filter(
    (transaction) =>
      transaction.money.currency === currency &&
      transaction.status === "void" &&
      matchesNormalizedFilter(transaction, filter),
  ).length;
  const totals = accumulate(included, categoryById, currency);
  const transferTransactions = included.filter((transaction) =>
    isTransfer(transaction, categoryById),
  );
  const incomeTransactions = included.filter(
    (transaction) => !isTransfer(transaction, categoryById) && transaction.money.isInflow(),
  );
  const spendingTransactions = included.filter(
    (transaction) => !isTransfer(transaction, categoryById) && transaction.money.isOutflow(),
  );
  const monthBuckets = groupBy(included, (transaction) => transaction.postedDate.slice(0, 7));
  const months = [...monthBuckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, values]) => {
      const aggregate = accumulate(values, categoryById, currency);
      return {
        month,
        ...aggregate.amounts,
        incomplete: isIncompleteMonth(month, filter, asOfDate),
        transactionIds: values.map(({ id }) => id),
      };
    });
  const accountBuckets = groupBy(included, (transaction) => transaction.accountId);
  const accounts = [...accountBuckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([accountId, values]) => ({
      accountId,
      ...accumulate(values, categoryById, currency).amounts,
      transactionIds: values.map(({ id }) => id),
    }));
  const categoryBuckets = new Map<string, Transaction[]>();
  for (const transaction of included) {
    if (!transaction.money.isOutflow() || isTransfer(transaction, categoryById)) continue;
    const key = transaction.categoryId ?? "uncategorized";
    const values = categoryBuckets.get(key);
    if (values === undefined) categoryBuckets.set(key, [transaction]);
    else values.push(transaction);
  }
  const categories = [...categoryBuckets.entries()]
    .map(([key, values]): CashFlowCategoryRow => {
      const spending = values.reduce(
        (total, transaction) => total.add(transaction.money.negate()),
        Money.zero(currency),
      );
      const category = key === "uncategorized" ? undefined : categoryById.get(parseCategoryId(key));
      return {
        ...(category === undefined ? {} : { categoryId: category.id }),
        categoryName: category?.name ?? "Uncategorized",
        spending: spending.toJSON().amount,
        transactionIds: values.map(({ id }) => id),
      };
    })
    .sort((left, right) => compareDecimal(right.spending, left.spending));
  return {
    currency,
    ...totals.amounts,
    unresolvedReviewCount: included.filter(
      (transaction) => transaction.reviewState === "needsReview",
    ).length,
    excludedVoidCount,
    months,
    accounts,
    categories,
    transactionIds: included.map(({ id }) => id),
    incomeTransactionIds: incomeTransactions.map(({ id }) => id),
    spendingTransactionIds: spendingTransactions.map(({ id }) => id),
    transferTransactionIds: transferTransactions.map(({ id }) => id),
    cashFlowTransactionIds: [...incomeTransactions, ...spendingTransactions].map(({ id }) => id),
    takeaway: takeaway(currency, totals.amounts.netCashFlow),
  };
}

function accumulate(
  transactions: readonly Transaction[],
  categories: ReadonlyMap<CategoryId, Category>,
  currency: string,
): {
  readonly amounts: Pick<
    CashFlowCurrencyReport,
    "income" | "spending" | "transfers" | "netCashFlow"
  >;
} {
  let income = Money.zero(currency);
  let spending = Money.zero(currency);
  let transfers = Money.zero(currency);
  for (const transaction of transactions) {
    if (isTransfer(transaction, categories)) {
      transfers = transfers.add(
        transaction.money.isOutflow() ? transaction.money.negate() : transaction.money,
      );
    } else if (transaction.money.isInflow()) {
      income = income.add(transaction.money);
    } else if (transaction.money.isOutflow()) {
      spending = spending.add(transaction.money.negate());
    }
  }
  return {
    amounts: {
      income: income.toJSON().amount,
      spending: spending.toJSON().amount,
      transfers: transfers.toJSON().amount,
      netCashFlow: income.subtract(spending).toJSON().amount,
    },
  };
}

function isTransfer(
  transaction: Transaction,
  categories: ReadonlyMap<CategoryId, Category>,
): boolean {
  return (
    transaction.categoryId !== undefined &&
    categories.get(transaction.categoryId)?.kind === "transfer"
  );
}

function normalizeFilter(filter: CashFlowFilter): NormalizedFilter {
  const fromDate = filter.fromDate === undefined ? undefined : parseDateOnly(filter.fromDate);
  const toDate = filter.toDate === undefined ? undefined : parseDateOnly(filter.toDate);
  if (fromDate !== undefined && toDate !== undefined && fromDate > toDate) {
    throw new RangeError("Summary start date must not be after end date");
  }
  return {
    ...(filter.accountIds === undefined
      ? {}
      : { accountIds: new Set(filter.accountIds.map(parseAccountId)) }),
    ...(filter.categoryIds === undefined
      ? {}
      : { categoryIds: new Set(filter.categoryIds.map(parseCategoryId)) }),
    ...(filter.currencies === undefined
      ? {}
      : { currencies: new Set(filter.currencies.map(validateCurrency)) }),
    ...(fromDate === undefined ? {} : { fromDate }),
    ...(toDate === undefined ? {} : { toDate }),
  };
}

function matchesNormalizedFilter(transaction: Transaction, filter: NormalizedFilter): boolean {
  return (
    (filter.accountIds === undefined || filter.accountIds.has(transaction.accountId)) &&
    (filter.categoryIds === undefined ||
      (transaction.categoryId !== undefined && filter.categoryIds.has(transaction.categoryId))) &&
    (filter.currencies === undefined || filter.currencies.has(transaction.money.currency)) &&
    (filter.fromDate === undefined || transaction.postedDate >= filter.fromDate) &&
    (filter.toDate === undefined || transaction.postedDate <= filter.toDate)
  );
}

function isIncompleteMonth(month: string, filter: NormalizedFilter, asOfDate: DateOnly): boolean {
  const first = `${month}-01` as DateOnly;
  const [yearValue, monthValue] = month.split("-").map(Number);
  if (yearValue === undefined || monthValue === undefined) throw new TypeError("Invalid month");
  const last = new Date(Date.UTC(yearValue, monthValue, 0)).toISOString().slice(0, 10) as DateOnly;
  return (
    asOfDate < last ||
    (filter.fromDate !== undefined && filter.fromDate > first) ||
    (filter.toDate !== undefined && filter.toDate < last)
  );
}

function takeaway(currency: string, netCashFlow: string): string {
  const direction = compareDecimal(netCashFlow, "0");
  if (direction === 0) return `Income and spending are balanced at ${currency} 0.`;
  return direction > 0
    ? `Income exceeds spending by ${currency} ${netCashFlow}.`
    : `Spending exceeds income by ${currency} ${netCashFlow.slice(1)}.`;
}

function describeFilter(filter: CashFlowFilter): string {
  return [
    filter.fromDate === undefined && filter.toDate === undefined
      ? "All dates"
      : `${filter.fromDate ?? "Beginning"} to ${filter.toDate ?? "Today"}`,
    filter.accountIds === undefined ? "all accounts" : `${filter.accountIds.length} account(s)`,
    filter.currencies === undefined ? "all currencies" : filter.currencies.join(", "),
    filter.categoryIds === undefined
      ? "all categories"
      : `${filter.categoryIds.length} category(s)`,
  ].join(" · ");
}

function validateCurrency(value: string): string {
  if (!/^[A-Z]{3}$/u.test(value)) throw new TypeError(`Invalid currency filter: ${value}`);
  return value;
}

function groupBy<Key>(
  values: readonly Transaction[],
  keyOf: (value: Transaction) => Key,
): ReadonlyMap<Key, readonly Transaction[]> {
  const grouped = new Map<Key, Transaction[]>();
  for (const value of values) {
    const key = keyOf(value);
    const bucket = grouped.get(key);
    if (bucket === undefined) grouped.set(key, [value]);
    else bucket.push(value);
  }
  return grouped;
}

function compareDecimal(left: string, right: string): number {
  const difference = Money.from(left, "XXX").subtract(Money.from(right, "XXX"));
  return difference.isInflow() ? 1 : difference.isOutflow() ? -1 : 0;
}

export interface TransactionExportContext {
  readonly filterSummary: string;
  readonly accountNames: ReadonlyMap<AccountId, string>;
  readonly categoryNames: ReadonlyMap<CategoryId, string>;
}

const EXPORT_COLUMNS = [
  "transaction_id",
  "posted_date",
  "description",
  "amount",
  "currency",
  "account",
  "category",
  "review_state",
  "status",
  "source_location",
  "filter_summary",
] as const;

export function createTransactionExportCsv(
  transactions: readonly Transaction[],
  context: TransactionExportContext,
): string {
  const lines = [EXPORT_COLUMNS.join(",")];
  for (const transaction of transactions) {
    const money = transaction.money.toJSON();
    lines.push(
      [
        transaction.id,
        transaction.postedDate,
        transaction.description,
        money.amount,
        money.currency,
        context.accountNames.get(transaction.accountId) ?? "Unknown account",
        transaction.categoryId === undefined
          ? "Uncategorized"
          : (context.categoryNames.get(transaction.categoryId) ?? "Unknown category"),
        transaction.reviewState,
        transaction.status,
        transaction.provenance.sourceLocation,
        context.filterSummary,
      ]
        .map((value, index) => (index === 3 ? csvDecimalCell(value) : csvCell(value)))
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function spreadsheetSafeCell(value: string): string {
  let firstContent = 0;
  while (
    firstContent < value.length &&
    (value.charCodeAt(firstContent) <= 32 || value.charCodeAt(firstContent) === 127)
  ) {
    firstContent += 1;
  }
  return ["=", "+", "-", "@"].includes(value[firstContent] ?? "") ? `'${value}` : value;
}

function csvCell(value: string): string {
  const safe = spreadsheetSafeCell(value);
  return /[",\r\n]/u.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function csvDecimalCell(value: string): string {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) {
    throw new TypeError(`Invalid decimal export value: ${value}`);
  }
  return value;
}
