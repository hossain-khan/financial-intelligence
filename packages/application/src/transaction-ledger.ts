import {
  applyManualTransactionEdit,
  parseAccountId,
  parseCategoryId,
  parseDateOnly,
  parseOperationId,
  parseTransactionId,
  parseUtcTimestamp,
  type AccountId,
  type CategoryId,
  type DateOnly,
  type ManualTransactionEdit,
  type OperationId,
  type Transaction,
  type TransactionId,
  type TransactionReviewState,
  type UtcTimestamp,
} from "@financial-intelligence/domain";

import type { ApplicationClock, IdGenerator } from "./workspaces";

export type TransactionLedgerRecord = Transaction;

export type TransactionLedgerSortField = "postedDate" | "amount" | "description" | "reviewState";
export type SortDirection = "ascending" | "descending";

export interface TransactionLedgerFilter {
  readonly accountIds?: readonly string[];
  readonly fromDate?: string;
  readonly toDate?: string;
  readonly categoryIds?: readonly string[];
  readonly uncategorized?: boolean;
  readonly reviewStates?: readonly TransactionReviewState[];
  readonly statuses?: readonly ("pending" | "posted" | "void")[];
  readonly tags?: readonly string[];
  readonly search?: string;
  readonly amount?: {
    readonly currency: string;
    readonly minimum?: string;
    readonly maximum?: string;
  };
}

export interface TransactionLedgerQuery {
  readonly filter?: TransactionLedgerFilter;
  readonly sort?: {
    readonly field: TransactionLedgerSortField;
    readonly direction: SortDirection;
  };
  readonly offset?: number;
  readonly limit?: number;
}

export interface TransactionLedgerPage {
  readonly items: readonly TransactionLedgerRecord[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

export interface BulkEditPreview {
  readonly selectedCount: number;
  readonly affectedCount: number;
  readonly unchangedCount: number;
  readonly missingCount: number;
}

export interface BulkTransactionChange {
  readonly transactionId: TransactionId;
  readonly before: Transaction;
  readonly after: Transaction;
}

export interface BulkTransactionOperation {
  readonly id: OperationId;
  readonly kind: "manual-transaction-edit";
  readonly changes: readonly BulkTransactionChange[];
  readonly createdAt: UtcTimestamp;
  readonly undoneAt?: UtcTimestamp;
}

export interface TransactionLedgerRepository {
  list(): Promise<readonly TransactionLedgerRecord[]>;
  listOperationsForTransaction(
    transactionId: TransactionId,
  ): Promise<readonly BulkTransactionOperation[]>;
  applyBulk(operation: BulkTransactionOperation): Promise<void>;
  findOperation(id: OperationId): Promise<BulkTransactionOperation | undefined>;
  undoBulk(
    operation: BulkTransactionOperation,
    restored: readonly Transaction[],
    undoneAt: UtcTimestamp,
  ): Promise<void>;
}

export class BulkOperationNotFoundError extends Error {
  public constructor() {
    super("Bulk transaction operation was not found");
    this.name = "BulkOperationNotFoundError";
  }
}

export class BulkOperationAlreadyUndoneError extends Error {
  public constructor() {
    super("Bulk transaction operation has already been undone");
    this.name = "BulkOperationAlreadyUndoneError";
  }
}

export class QueryTransactionLedger {
  public constructor(private readonly repository: TransactionLedgerRepository) {}

  public async execute(query: TransactionLedgerQuery = {}): Promise<TransactionLedgerPage> {
    return queryTransactionLedger(await this.repository.list(), query);
  }
}

export class ListTransactionEditHistory {
  public constructor(private readonly repository: TransactionLedgerRepository) {}

  public async execute(transactionId: string): Promise<readonly BulkTransactionOperation[]> {
    return await this.repository.listOperationsForTransaction(parseTransactionId(transactionId));
  }
}

export class PreviewBulkTransactionEdit {
  public constructor(private readonly repository: TransactionLedgerRepository) {}

  public async execute(
    transactionIds: readonly string[],
    edit: ManualTransactionEdit,
  ): Promise<BulkEditPreview> {
    const ids = transactionIds.map(parseTransactionId);
    return previewBulkTransactionEdit(await this.repository.list(), ids, edit);
  }
}

export class ApplyBulkTransactionEdit {
  public constructor(
    private readonly repository: TransactionLedgerRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(
    transactionIds: readonly string[],
    edit: ManualTransactionEdit,
  ): Promise<BulkTransactionOperation> {
    const now = parseUtcTimestamp(this.clock.now().toISOString());
    const operation = planBulkTransactionEdit(
      await this.repository.list(),
      transactionIds.map(parseTransactionId),
      edit,
      parseOperationId(this.ids.generate()),
      now,
    );
    await this.repository.applyBulk(operation);
    return operation;
  }
}

export class UndoBulkTransactionEdit {
  public constructor(
    private readonly repository: TransactionLedgerRepository,
    private readonly clock: ApplicationClock,
  ) {}

  public async execute(operationId: string): Promise<void> {
    const operation = await this.repository.findOperation(parseOperationId(operationId));
    if (operation === undefined) throw new BulkOperationNotFoundError();
    if (operation.undoneAt !== undefined) throw new BulkOperationAlreadyUndoneError();
    const undoneAt = parseUtcTimestamp(this.clock.now().toISOString());
    await this.repository.undoBulk(
      operation,
      operation.changes.map(({ before }) => ({ ...before, updatedAt: undoneAt })),
      undoneAt,
    );
  }
}

export function queryTransactionLedger(
  records: readonly TransactionLedgerRecord[],
  query: TransactionLedgerQuery = {},
): TransactionLedgerPage {
  const filter = normalizeFilter(query.filter);
  const sort = query.sort ?? { field: "postedDate", direction: "descending" };
  const offset = nonNegativeInteger(query.offset ?? 0, "Ledger offset");
  const limit = positiveInteger(query.limit ?? 100, "Ledger limit");
  const matching = records.filter((record) => matches(record, filter));
  const sorted = [...matching].sort((left, right) => compareRecords(left, right, sort));
  return { items: sorted.slice(offset, offset + limit), total: sorted.length, offset, limit };
}

export function previewBulkTransactionEdit(
  records: readonly TransactionLedgerRecord[],
  transactionIds: readonly TransactionId[],
  edit: ManualTransactionEdit,
): BulkEditPreview {
  const uniqueIds = new Set(transactionIds);
  const selected = records.filter((transaction) => uniqueIds.has(transaction.id));
  const affectedCount = selected.filter((transaction) =>
    transactionChanged(
      transaction,
      applyManualTransactionEdit(transaction, edit, transaction.updatedAt),
    ),
  ).length;
  return {
    selectedCount: uniqueIds.size,
    affectedCount,
    unchangedCount: selected.length - affectedCount,
    missingCount: uniqueIds.size - selected.length,
  };
}

export function planBulkTransactionEdit(
  records: readonly TransactionLedgerRecord[],
  transactionIds: readonly TransactionId[],
  edit: ManualTransactionEdit,
  operationId: OperationId,
  now: UtcTimestamp,
): BulkTransactionOperation {
  const uniqueIds = new Set(transactionIds);
  const changes = records.flatMap((transaction) => {
    if (!uniqueIds.has(transaction.id)) return [];
    const after = applyManualTransactionEdit(transaction, edit, now);
    return transactionChanged(transaction, after)
      ? [{ transactionId: transaction.id, before: transaction, after }]
      : [];
  });
  return { id: operationId, kind: "manual-transaction-edit", changes, createdAt: now };
}

interface NormalizedFilter {
  readonly accountIds?: ReadonlySet<AccountId>;
  readonly fromDate?: DateOnly;
  readonly toDate?: DateOnly;
  readonly categoryIds?: ReadonlySet<CategoryId>;
  readonly uncategorized: boolean;
  readonly reviewStates?: ReadonlySet<TransactionReviewState>;
  readonly statuses?: ReadonlySet<"pending" | "posted" | "void">;
  readonly tags?: ReadonlySet<string>;
  readonly search?: string;
  readonly amount?: {
    readonly currency: string;
    readonly minimum?: string;
    readonly maximum?: string;
  };
}

function normalizeFilter(filter: TransactionLedgerFilter | undefined): NormalizedFilter {
  if (filter === undefined) return { uncategorized: false };
  return {
    ...(filter.accountIds === undefined
      ? {}
      : { accountIds: new Set(filter.accountIds.map(parseAccountId)) }),
    ...(filter.fromDate === undefined ? {} : { fromDate: parseDateOnly(filter.fromDate) }),
    ...(filter.toDate === undefined ? {} : { toDate: parseDateOnly(filter.toDate) }),
    ...(filter.categoryIds === undefined
      ? {}
      : { categoryIds: new Set(filter.categoryIds.map(parseCategoryId)) }),
    uncategorized: filter.uncategorized ?? false,
    ...(filter.reviewStates === undefined ? {} : { reviewStates: new Set(filter.reviewStates) }),
    ...(filter.statuses === undefined ? {} : { statuses: new Set(filter.statuses) }),
    ...(filter.tags === undefined ? {} : { tags: new Set(filter.tags.map(normalizeSearch)) }),
    ...(filter.search === undefined || normalizeSearch(filter.search).length === 0
      ? {}
      : { search: normalizeSearch(filter.search) }),
    ...(filter.amount === undefined ? {} : { amount: filter.amount }),
  };
}

function matches(record: TransactionLedgerRecord, filter: NormalizedFilter): boolean {
  const transaction = record;
  if (filter.accountIds !== undefined && !filter.accountIds.has(transaction.accountId))
    return false;
  if (filter.fromDate !== undefined && transaction.postedDate < filter.fromDate) return false;
  if (filter.toDate !== undefined && transaction.postedDate > filter.toDate) return false;
  if (filter.categoryIds !== undefined) {
    if (transaction.categoryId === undefined || !filter.categoryIds.has(transaction.categoryId))
      return false;
  }
  if (filter.uncategorized && transaction.categoryId !== undefined) return false;
  if (filter.reviewStates !== undefined && !filter.reviewStates.has(transaction.reviewState))
    return false;
  if (filter.statuses !== undefined && !filter.statuses.has(transaction.status)) return false;
  if (filter.tags !== undefined) {
    const tags = new Set(transaction.tags.map(normalizeSearch));
    if ([...filter.tags].some((tag) => !tags.has(tag))) return false;
  }
  if (filter.search !== undefined) {
    const searchable = normalizeSearch(
      [transaction.description, transaction.notes ?? "", ...transaction.tags].join(" "),
    );
    if (!searchable.includes(filter.search)) return false;
  }
  if (filter.amount !== undefined) {
    const money = transaction.money.toJSON();
    if (money.currency !== filter.amount.currency) return false;
    if (
      filter.amount.minimum !== undefined &&
      compareDecimalStrings(money.amount, filter.amount.minimum) < 0
    )
      return false;
    if (
      filter.amount.maximum !== undefined &&
      compareDecimalStrings(money.amount, filter.amount.maximum) > 0
    )
      return false;
  }
  return true;
}

function compareRecords(
  left: TransactionLedgerRecord,
  right: TransactionLedgerRecord,
  sort: NonNullable<TransactionLedgerQuery["sort"]>,
): number {
  let result: number;
  switch (sort.field) {
    case "amount":
      result = compareAmounts(left, right);
      break;
    case "description":
      result = left.description.localeCompare(right.description);
      break;
    case "reviewState":
      result = left.reviewState.localeCompare(right.reviewState);
      break;
    case "postedDate":
      result = left.postedDate.localeCompare(right.postedDate);
      break;
  }
  if (result === 0) result = left.id.localeCompare(right.id);
  return sort.direction === "ascending" ? result : -result;
}

function compareAmounts(left: Transaction, right: Transaction): number {
  const leftMoney = left.money.toJSON();
  const rightMoney = right.money.toJSON();
  const currency = leftMoney.currency.localeCompare(rightMoney.currency);
  return currency === 0 ? compareDecimalStrings(leftMoney.amount, rightMoney.amount) : currency;
}

function compareDecimalStrings(left: string, right: string): number {
  const leftParts = decimalParts(left);
  const rightParts = decimalParts(right);
  const scale = Math.max(leftParts.fraction.length, rightParts.fraction.length);
  const leftValue =
    BigInt(`${leftParts.whole}${leftParts.fraction.padEnd(scale, "0")}`) * leftParts.sign;
  const rightValue =
    BigInt(`${rightParts.whole}${rightParts.fraction.padEnd(scale, "0")}`) * rightParts.sign;
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

function decimalParts(value: string): {
  readonly sign: bigint;
  readonly whole: string;
  readonly fraction: string;
} {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (match === null) throw new TypeError(`Invalid decimal amount: ${value}`);
  return { sign: match[1] === "-" ? -1n : 1n, whole: match[2] ?? "0", fraction: match[3] ?? "" };
}

function transactionChanged(left: Transaction, right: Transaction): boolean {
  return (
    left.categoryId !== right.categoryId ||
    left.notes !== right.notes ||
    left.reviewState !== right.reviewState ||
    left.tags.join("\0") !== right.tags.join("\0") ||
    left.classifications.category?.locked !== right.classifications.category?.locked
  );
}

function normalizeSearch(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en").trim();
}

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} is invalid`);
  return value;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000) {
    throw new RangeError(`${label} must be between 1 and 1,000`);
  }
  return value;
}
