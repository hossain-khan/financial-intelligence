import {
  importFromCanonical,
  transactionFromCanonical,
  validateCategoryHierarchy,
  type Account,
  type Category,
  type CanonicalTransactionDocument,
  type ClassificationRule,
  type DuplicateResolutionEvent,
  type Merchant,
  type RecurringDecisionRecord,
  type StatementImportDocument,
  type TransferLink,
  type Workspace,
} from "@financial-intelligence/domain";

export const WORKSPACE_BACKUP_FORMAT = "financial-intelligence.workspace-backup";
export const WORKSPACE_BACKUP_VERSION = "1.0.0";
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
export const MAX_BACKUP_TRANSACTIONS = 250_000;

export interface BackupTransactionOperationDocument {
  readonly id: string;
  readonly kind: "manual-transaction-edit";
  readonly changes: readonly {
    readonly transactionId: string;
    readonly before: CanonicalTransactionDocument;
    readonly after: CanonicalTransactionDocument;
  }[];
  readonly createdAt: string;
  readonly undoneAt?: string;
}

export type BackupDuplicateResolutionEventDocument = DuplicateResolutionEvent & {
  readonly priorStates?: Readonly<
    Record<string, Pick<CanonicalTransactionDocument, "status" | "reviewState">>
  >;
};

export interface WorkspaceBackupSnapshot {
  readonly format: typeof WORKSPACE_BACKUP_FORMAT;
  readonly version: typeof WORKSPACE_BACKUP_VERSION;
  readonly exportedAt: string;
  readonly databaseVersion: number;
  readonly workspace: Workspace;
  readonly accounts: readonly Account[];
  readonly imports: readonly StatementImportDocument[];
  readonly transactions: readonly CanonicalTransactionDocument[];
  readonly categories: readonly Category[];
  readonly merchants: readonly Merchant[];
  readonly classificationRules: readonly ClassificationRule[];
  readonly transferDecisions: readonly TransferLink[];
  readonly recurringDecisions: readonly RecurringDecisionRecord[];
  readonly learningOperations?: readonly BackupOperationDocument[];
  readonly decisionEvents?: readonly BackupOperationDocument[];
  readonly transactionOperations: readonly BackupTransactionOperationDocument[];
  readonly duplicateResolutionEvents: readonly BackupDuplicateResolutionEventDocument[];
}

export interface WorkspaceBackupPreview {
  readonly workspaceName: string;
  readonly exportedAt: string;
  readonly revision: number;
  readonly counts: {
    readonly accounts: number;
    readonly imports: number;
    readonly transactions: number;
    readonly categories: number;
    readonly merchants: number;
    readonly classificationRules: number;
    readonly transferDecisions: number;
    readonly recurringDecisions: number;
    readonly learningOperations: number;
    readonly decisionEvents: number;
    readonly transactionOperations: number;
    readonly duplicateResolutionEvents: number;
  };
}

export interface BackupOperationDocument {
  readonly id: string;
}

export function serializeSnapshot(snapshot: WorkspaceBackupSnapshot): Uint8Array {
  validateSnapshot(snapshot);
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  if (bytes.byteLength > MAX_BACKUP_BYTES) throw new BackupValidationError("RESOURCE_LIMIT");
  return bytes;
}

export function parseSnapshot(bytes: Uint8Array): WorkspaceBackupSnapshot {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BACKUP_BYTES) {
    throw new BackupValidationError("RESOURCE_LIMIT");
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new BackupValidationError("INVALID_PAYLOAD");
  }
  const normalized = normalizeLegacySnapshot(value);
  validateSnapshot(normalized);
  return normalized;
}

export function previewSnapshot(snapshot: WorkspaceBackupSnapshot): WorkspaceBackupPreview {
  return {
    workspaceName: snapshot.workspace.name,
    exportedAt: snapshot.exportedAt,
    revision: snapshot.workspace.revision,
    counts: {
      accounts: snapshot.accounts.length,
      imports: snapshot.imports.length,
      transactions: snapshot.transactions.length,
      categories: snapshot.categories.length,
      merchants: snapshot.merchants.length,
      classificationRules: snapshot.classificationRules.length,
      transferDecisions: snapshot.transferDecisions.length,
      recurringDecisions: snapshot.recurringDecisions.length,
      learningOperations: snapshot.learningOperations?.length ?? 0,
      decisionEvents: snapshot.decisionEvents?.length ?? 0,
      transactionOperations: snapshot.transactionOperations.length,
      duplicateResolutionEvents: snapshot.duplicateResolutionEvents.length,
    },
  };
}

export class BackupValidationError extends Error {
  public constructor(
    public readonly code: "INVALID_PAYLOAD" | "RESOURCE_LIMIT" | "UNSUPPORTED_VERSION",
  ) {
    super(code);
    this.name = "BackupValidationError";
  }
}

function validateSnapshot(value: unknown): asserts value is WorkspaceBackupSnapshot {
  if (!isObject(value) || value.format !== WORKSPACE_BACKUP_FORMAT) invalid();
  if (value.version !== WORKSPACE_BACKUP_VERSION) {
    throw new BackupValidationError("UNSUPPORTED_VERSION");
  }
  if (!isUtc(value.exportedAt) || !positiveInteger(value.databaseVersion)) invalid();
  if (!isWorkspace(value.workspace)) invalid();
  if (
    !Array.isArray(value.accounts) ||
    !Array.isArray(value.imports) ||
    !Array.isArray(value.transactions) ||
    !Array.isArray(value.categories) ||
    !Array.isArray(value.merchants) ||
    !Array.isArray(value.classificationRules) ||
    !Array.isArray(value.transferDecisions) ||
    !Array.isArray(value.recurringDecisions) ||
    (value.learningOperations !== undefined && !Array.isArray(value.learningOperations)) ||
    (value.decisionEvents !== undefined && !Array.isArray(value.decisionEvents)) ||
    !Array.isArray(value.transactionOperations) ||
    !Array.isArray(value.duplicateResolutionEvents)
  )
    invalid();
  if (value.transactions.length > MAX_BACKUP_TRANSACTIONS) {
    throw new BackupValidationError("RESOURCE_LIMIT");
  }

  const workspace = value.workspace;
  const accounts = value.accounts;
  const imports = value.imports;
  const transactions = value.transactions;
  const categories = value.categories;
  const merchants = value.merchants;
  const classificationRules = value.classificationRules;
  const transferDecisions = value.transferDecisions;
  const recurringDecisions = value.recurringDecisions;
  const learningOperations = value.learningOperations ?? [];
  const decisionEvents = value.decisionEvents ?? [];
  const operations = value.transactionOperations;
  const events = value.duplicateResolutionEvents;
  try {
    if (uniqueIds(accounts).size !== accounts.length) invalid();
    for (const account of accounts) {
      if (!isAccount(account) || account.workspaceId !== workspace.id) invalid();
    }
    const accountIds = uniqueIds(accounts);
    if (uniqueIds(imports).size !== imports.length) invalid();
    for (const statementImport of imports) {
      importFromCanonical(statementImport as StatementImportDocument);
      if (!accountIds.has((statementImport as StatementImportDocument).accountId)) invalid();
    }
    const importIds = uniqueIds(imports);
    if (uniqueIds(transactions).size !== transactions.length) invalid();
    for (const transaction of transactions) {
      const canonical = transaction as CanonicalTransactionDocument;
      transactionFromCanonical(canonical);
      if (!accountIds.has(canonical.accountId) || !importIds.has(canonical.importId)) invalid();
    }
    if (uniqueIds(categories).size !== categories.length) invalid();
    validateCategoryHierarchy(categories as unknown as readonly Category[]);
    const transactionIds = uniqueIds(transactions);
    if (uniqueIds(merchants).size !== merchants.length) invalid();
    if (uniqueIds(classificationRules).size !== classificationRules.length) invalid();
    if (uniqueIds(transferDecisions).size !== transferDecisions.length) invalid();
    for (const decision of transferDecisions) {
      if (
        !isObject(decision) ||
        typeof decision.outflowTransactionId !== "string" ||
        typeof decision.inflowTransactionId !== "string" ||
        !transactionIds.has(decision.outflowTransactionId) ||
        !transactionIds.has(decision.inflowTransactionId) ||
        decision.outflowTransactionId === decision.inflowTransactionId
      )
        invalid();
    }
    if (uniqueIds(recurringDecisions).size !== recurringDecisions.length) invalid();
    if (uniqueIds(learningOperations).size !== learningOperations.length) invalid();
    if (uniqueIds(decisionEvents).size !== decisionEvents.length) invalid();
    if (uniqueIds(operations).size !== operations.length) invalid();
    for (const operation of operations) {
      if (!isOperation(operation)) invalid();
      for (const change of operation.changes) {
        transactionFromCanonical(change.before);
        transactionFromCanonical(change.after);
        if (!transactionIds.has(change.transactionId)) invalid();
      }
    }
    if (uniqueIds(events).size !== events.length) invalid();
    for (const event of events) if (!isResolutionEvent(event)) invalid();
  } catch (error) {
    if (error instanceof BackupValidationError) throw error;
    invalid();
  }
}

function normalizeLegacySnapshot(value: unknown): unknown {
  if (!isObject(value)) return value;
  return {
    ...value,
    merchants: value.merchants === undefined ? [] : value.merchants,
    classificationRules: value.classificationRules === undefined ? [] : value.classificationRules,
    transferDecisions: value.transferDecisions === undefined ? [] : value.transferDecisions,
    recurringDecisions: value.recurringDecisions === undefined ? [] : value.recurringDecisions,
  };
}

function invalid(): never {
  throw new BackupValidationError("INVALID_PAYLOAD");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueIds(values: readonly unknown[]): Set<string> {
  const ids = new Set<string>();
  for (const value of values) {
    if (!isObject(value) || typeof value.id !== "string") invalid();
    ids.add(value.id);
  }
  return ids;
}

function isUtc(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isWorkspace(value: unknown): value is Workspace {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    value.name.length <= 120 &&
    value.schemaVersion === 1 &&
    positiveInteger(value.revision) &&
    isUtc(value.createdAt) &&
    isUtc(value.updatedAt)
  );
}

function isAccount(value: unknown): value is Account {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.workspaceId === "string" &&
    typeof value.name === "string" &&
    typeof value.type === "string" &&
    typeof value.currency === "string" &&
    typeof value.archived === "boolean" &&
    isUtc(value.createdAt) &&
    isUtc(value.updatedAt)
  );
}

function isOperation(value: unknown): value is BackupTransactionOperationDocument {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    value.kind === "manual-transaction-edit" &&
    Array.isArray(value.changes) &&
    isUtc(value.createdAt) &&
    (value.undoneAt === undefined || isUtc(value.undoneAt)) &&
    value.changes.every(
      (change) =>
        isObject(change) &&
        typeof change.transactionId === "string" &&
        isObject(change.before) &&
        isObject(change.after),
    )
  );
}

function isResolutionEvent(value: unknown): value is BackupDuplicateResolutionEventDocument {
  if (!isObject(value) || typeof value.id !== "string" || !isUtc(value.occurredAt)) return false;
  if (value.type === "undo") return typeof value.decisionId === "string";
  return (
    value.type === "decision" &&
    typeof value.candidateId === "string" &&
    typeof value.evidenceSignature === "string" &&
    typeof value.action === "string"
  );
}
