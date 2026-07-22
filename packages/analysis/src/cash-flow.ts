import {
  Money,
  parseAccountId,
  parseCategoryId,
  parseDateOnly,
  parseMerchantId,
  parseTransactionId,
  type AccountId,
  type Category,
  type CategoryId,
  type DateOnly,
  type MerchantId,
  type Transaction,
  type TransactionId,
  type TransactionReviewState,
} from "@financial-intelligence/domain";

export interface CashFlowFilter {
  readonly transactionIds?: readonly string[];
  readonly accountIds?: readonly string[];
  readonly categoryIds?: readonly string[];
  readonly merchantIds?: readonly string[];
  readonly tags?: readonly string[];
  readonly reviewStates?: readonly TransactionReviewState[];
  /** Resolved by snapshot-aware callers because recurring state is derived knowledge. */
  readonly recurringStatuses?: readonly ("confirmed" | "proposed" | "dismissed" | "muted")[];
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
  readonly confirmedTransferTransactionIds?: ReadonlySet<string>;
  /** Explicit to keep incomplete-period results deterministic in tests and exports. */
  readonly asOfDate: string;
}

interface NormalizedFilter {
  readonly transactionIds?: ReadonlySet<TransactionId>;
  readonly accountIds?: ReadonlySet<AccountId>;
  readonly categoryIds?: ReadonlySet<CategoryId>;
  readonly merchantIds?: ReadonlySet<MerchantId>;
  readonly tags?: ReadonlySet<string>;
  readonly reviewStates?: ReadonlySet<TransactionReviewState>;
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
        input.confirmedTransferTransactionIds,
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
    if (normalized.transactionIds !== undefined && !normalized.transactionIds.has(transaction.id))
      return false;
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
    if (
      normalized.merchantIds !== undefined &&
      (transaction.merchantId === undefined || !normalized.merchantIds.has(transaction.merchantId))
    )
      return false;
    if (normalized.tags !== undefined && !transaction.tags.some((tag) => normalized.tags?.has(tag)))
      return false;
    if (
      normalized.reviewStates !== undefined &&
      !normalized.reviewStates.has(transaction.reviewState)
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
  confirmedTransferTransactionIds?: ReadonlySet<string>,
): CashFlowCurrencyReport {
  const included = transactions.filter((transaction) => transaction.status !== "void");
  const excludedVoidCount = allTransactions.filter(
    (transaction) =>
      transaction.money.currency === currency &&
      transaction.status === "void" &&
      matchesNormalizedFilter(transaction, filter),
  ).length;
  const totals = accumulate(included, categoryById, currency, confirmedTransferTransactionIds);
  const transferTransactions = included.filter((transaction) =>
    isTransfer(transaction, categoryById, confirmedTransferTransactionIds),
  );
  const incomeTransactions = included.filter(
    (transaction) =>
      !isTransfer(transaction, categoryById, confirmedTransferTransactionIds) &&
      transaction.money.isInflow(),
  );
  const spendingTransactions = included.filter(
    (transaction) =>
      !isTransfer(transaction, categoryById, confirmedTransferTransactionIds) &&
      transaction.money.isOutflow(),
  );
  const monthBuckets = groupBy(included, (transaction) => transaction.postedDate.slice(0, 7));
  const months = [...monthBuckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, values]) => {
      const aggregate = accumulate(values, categoryById, currency, confirmedTransferTransactionIds);
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
      ...accumulate(values, categoryById, currency, confirmedTransferTransactionIds).amounts,
      transactionIds: values.map(({ id }) => id),
    }));
  const categoryBuckets = new Map<string, Transaction[]>();
  for (const transaction of included) {
    if (
      !transaction.money.isOutflow() ||
      isTransfer(transaction, categoryById, confirmedTransferTransactionIds)
    )
      continue;
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
  const incomeIds = incomeTransactions.map(({ id }) => id);
  const spendingIds = spendingTransactions.map(({ id }) => id);
  const transferIds = transferTransactions.map(({ id }) => id);
  const cashFlowTransactionIds = [...incomeIds, ...spendingIds];
  return {
    currency,
    income: totals.amounts.income,
    spending: totals.amounts.spending,
    transfers: totals.amounts.transfers,
    netCashFlow: totals.amounts.netCashFlow,
    unresolvedReviewCount: included.filter(
      (transaction) => transaction.reviewState === "needsReview",
    ).length,
    excludedVoidCount,
    months,
    accounts,
    categories,
    transactionIds: included.map(({ id }) => id),
    incomeTransactionIds: incomeIds,
    spendingTransactionIds: spendingIds,
    transferTransactionIds: transferIds,
    cashFlowTransactionIds,
    takeaway: takeaway(currency, totals.amounts.netCashFlow),
  };
}

function accumulate(
  transactions: readonly Transaction[],
  categories: ReadonlyMap<CategoryId, Category>,
  currency: string,
  confirmedTransferTransactionIds?: ReadonlySet<string>,
): {
  readonly amounts: {
    readonly income: string;
    readonly spending: string;
    readonly transfers: string;
    readonly netCashFlow: string;
  };
} {
  let income = Money.zero(currency);
  let spending = Money.zero(currency);
  let transfers = Money.zero(currency);
  for (const transaction of transactions) {
    if (isTransfer(transaction, categories, confirmedTransferTransactionIds)) {
      transfers = transfers.add(transaction.money.abs());
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
  confirmedTransferTransactionIds?: ReadonlySet<string>,
): boolean {
  if (
    confirmedTransferTransactionIds !== undefined &&
    confirmedTransferTransactionIds.has(transaction.id)
  ) {
    return true;
  }
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
    ...(filter.transactionIds === undefined
      ? {}
      : { transactionIds: new Set(filter.transactionIds.map(parseTransactionId)) }),
    ...(filter.accountIds === undefined
      ? {}
      : { accountIds: new Set(filter.accountIds.map(parseAccountId)) }),
    ...(filter.categoryIds === undefined
      ? {}
      : { categoryIds: new Set(filter.categoryIds.map(parseCategoryId)) }),
    ...(filter.merchantIds === undefined
      ? {}
      : { merchantIds: new Set(filter.merchantIds.map(parseMerchantId)) }),
    ...(filter.tags === undefined ? {} : { tags: new Set(filter.tags.map(validateTag)) }),
    ...(filter.reviewStates === undefined
      ? {}
      : { reviewStates: new Set(filter.reviewStates.map(validateReviewState)) }),
    ...(filter.currencies === undefined
      ? {}
      : { currencies: new Set(filter.currencies.map(validateCurrency)) }),
    ...(fromDate === undefined ? {} : { fromDate }),
    ...(toDate === undefined ? {} : { toDate }),
  };
}

function matchesNormalizedFilter(transaction: Transaction, filter: NormalizedFilter): boolean {
  return (
    (filter.transactionIds === undefined || filter.transactionIds.has(transaction.id)) &&
    (filter.accountIds === undefined || filter.accountIds.has(transaction.accountId)) &&
    (filter.categoryIds === undefined ||
      (transaction.categoryId !== undefined && filter.categoryIds.has(transaction.categoryId))) &&
    (filter.merchantIds === undefined ||
      (transaction.merchantId !== undefined && filter.merchantIds.has(transaction.merchantId))) &&
    (filter.tags === undefined || transaction.tags.some((tag) => filter.tags?.has(tag))) &&
    (filter.reviewStates === undefined || filter.reviewStates.has(transaction.reviewState)) &&
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
    filter.transactionIds === undefined
      ? "all transactions"
      : `${filter.transactionIds.length} selected transaction(s)`,
    filter.fromDate === undefined && filter.toDate === undefined
      ? "All dates"
      : `${filter.fromDate ?? "Beginning"} to ${filter.toDate ?? "Today"}`,
    filter.accountIds === undefined ? "all accounts" : `${filter.accountIds.length} account(s)`,
    filter.currencies === undefined ? "all currencies" : filter.currencies.join(", "),
    filter.categoryIds === undefined
      ? "all categories"
      : `${filter.categoryIds.length} category(s)`,
    filter.merchantIds === undefined ? "all merchants" : `${filter.merchantIds.length} merchant(s)`,
    filter.tags === undefined ? "all tags" : `${filter.tags.length} tag(s)`,
    filter.reviewStates === undefined ? "all review states" : filter.reviewStates.join(", "),
    filter.recurringStatuses === undefined
      ? "all recurring states"
      : filter.recurringStatuses.join(", "),
  ].join(" · ");
}

function validateCurrency(value: string): string {
  if (!/^[A-Z]{3}$/u.test(value)) throw new TypeError(`Invalid currency filter: ${value}`);
  return value;
}

function validateTag(value: string): string {
  const tag = value.trim();
  if (tag.length === 0 || tag.length > 80) throw new TypeError("Invalid tag filter");
  return tag;
}

function validateReviewState(value: TransactionReviewState): TransactionReviewState {
  if (!(["unreviewed", "needsReview", "reviewed"] as const).includes(value)) {
    throw new TypeError(`Invalid review-state filter: ${value}`);
  }
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
  if (value.length === 0) return value;
  return /^[\t\r\n ]*[=+\-@\t\r]/u.test(value) ? `'${value}` : value;
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
