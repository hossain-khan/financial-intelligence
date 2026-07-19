import type {
  AtomicImportCommitPlan,
  CancellationSignal,
  ImportCommitRepository,
  TransactionFingerprint,
  AccountRepository,
  WorkspaceRepository,
  BulkTransactionOperation,
  DuplicateCandidateRepository,
  DuplicateResolutionJournal,
  DuplicateResolutionRepository,
  TransactionLedgerRepository,
  CategoryRepository,
} from "@financial-intelligence/application";
import {
  importFromCanonical,
  importToCanonical,
  transactionFromCanonical,
  transactionToCanonical,
  parseOperationId,
  parseTransactionId,
  parseUtcTimestamp,
  type Account,
  type AccountId,
  type Category,
  type CanonicalTransactionDocument,
  type DuplicateResolutionEvent,
  type ImportId,
  type StatementImport,
  type StatementImportDocument,
  type Transaction as DomainTransaction,
  type Workspace,
  type WorkspaceId,
} from "@financial-intelligence/domain";
import Dexie, { type EntityTable } from "dexie";

import { normalizeStorageError, StorageError } from "./errors";
import type { MigrationJournalRecord } from "./migration-journal";
import {
  DATABASE_MIGRATIONS,
  registerDatabaseMigrations,
  type DatabaseMigration,
} from "./migrations";

type WorkspaceRecord = Workspace;
type AccountRecord = Account;
type ImportRecord = StatementImportDocument;
type TransactionRecord = CanonicalTransactionDocument;
type TransactionFingerprintRecord = TransactionFingerprint;
type CategoryRecord = Category;
interface TransactionOperationRecord {
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
type DuplicateResolutionEventRecord = DuplicateResolutionEvent & {
  readonly priorStates?: Readonly<
    Record<string, Pick<CanonicalTransactionDocument, "status" | "reviewState">>
  >;
};
// Dexie stores public schema versions at ten times their declared value in native IndexedDB.
const DEXIE_NATIVE_VERSION_SCALE = 10;

export class FinancialDatabase extends Dexie {
  public workspaces!: EntityTable<WorkspaceRecord, "id">;
  public accounts!: EntityTable<AccountRecord, "id">;
  public imports!: EntityTable<ImportRecord, "id">;
  public transactions!: EntityTable<TransactionRecord, "id">;
  public transactionFingerprints!: EntityTable<TransactionFingerprintRecord, "transactionId">;
  public categories!: EntityTable<CategoryRecord, "id">;
  public transactionOperations!: EntityTable<TransactionOperationRecord, "id">;
  public duplicateResolutionEvents!: EntityTable<DuplicateResolutionEventRecord, "id">;
  public migrationJournal!: EntityTable<MigrationJournalRecord, "id">;
  public readonly declaredVersion: number;

  public constructor(
    name = "financial-intelligence",
    migrations: readonly DatabaseMigration[] = DATABASE_MIGRATIONS,
    onStaleConnection?: () => void,
  ) {
    super(name);
    this.declaredVersion = migrations[migrations.length - 1]?.version ?? 0;
    registerDatabaseMigrations(this, migrations);
    this.on("versionchange", () => {
      this.close();
      onStaleConnection?.();
    });
  }
}

export class IndexedDbAccountRepository implements AccountRepository {
  public constructor(private readonly database: FinancialDatabase) {}

  public async listByWorkspace(workspaceId: WorkspaceId): Promise<readonly Account[]> {
    try {
      await openFinancialDatabase(this.database);
      return await this.database.accounts
        .where("workspaceId")
        .equals(workspaceId)
        .sortBy("createdAt");
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async findById(id: AccountId): Promise<Account | undefined> {
    try {
      await openFinancialDatabase(this.database);
      return await this.database.accounts.get(id);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async save(account: Account): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.transaction("rw", this.database.accounts, async () => {
        await this.database.accounts.put(account);
      });
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async hasReferences(_id: AccountId): Promise<boolean> {
    try {
      await openFinancialDatabase(this.database);
      return (await this.database.transactions.where("accountId").equals(_id).count()) > 0;
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async deleteIfUnreferenced(id: AccountId): Promise<boolean> {
    try {
      await openFinancialDatabase(this.database);
      let deleted = false;
      await this.database.transaction(
        "rw",
        this.database.accounts,
        this.database.transactions,
        async () => {
          if ((await this.database.transactions.where("accountId").equals(id).count()) > 0) return;
          await this.database.accounts.delete(id);
          deleted = true;
        },
      );
      return deleted;
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }
}

export interface OpenDatabaseOptions {
  readonly blockedTimeoutMs?: number;
  readonly onBlocked?: () => void;
}

export async function openFinancialDatabase(
  database: FinancialDatabase,
  options: OpenDatabaseOptions = {},
): Promise<FinancialDatabase> {
  const blockedTimeoutMs = options.blockedTimeoutMs ?? 5_000;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let rejectBlocked: ((error: StorageError) => void) | undefined;
  const handleBlocked = (): void => {
    if (timeout !== undefined) {
      return;
    }

    options.onBlocked?.();
    timeout = setTimeout(() => {
      database.close();
      rejectBlocked?.(new StorageError("UPGRADE_BLOCKED"));
    }, blockedTimeoutMs);
  };

  const blocked = new Promise<never>((_resolve, reject) => {
    rejectBlocked = reject;
  });
  database.on("blocked", handleBlocked);

  try {
    await Promise.race([database.open(), blocked]);

    if (database.backendDB().version > database.declaredVersion * DEXIE_NATIVE_VERSION_SCALE) {
      database.close();
      throw new StorageError("VERSION_INCOMPATIBLE");
    }

    return database;
  } catch (error) {
    throw normalizeStorageError(error);
  } finally {
    database.on.blocked.unsubscribe(handleBlocked);
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

export class IndexedDbWorkspaceRepository implements WorkspaceRepository {
  public constructor(private readonly database: FinancialDatabase) {}

  public async list(): Promise<readonly Workspace[]> {
    try {
      await openFinancialDatabase(this.database);
      return await this.database.workspaces.orderBy("createdAt").toArray();
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async save(workspace: Workspace): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.transaction("rw", this.database.workspaces, async () => {
        await this.database.workspaces.put(workspace);
      });
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async findById(id: WorkspaceId): Promise<Workspace | undefined> {
    try {
      await openFinancialDatabase(this.database);
      return await this.database.workspaces.get(id);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }
}

export type ImportCommitStage =
  | "before-write"
  | "after-imports"
  | "after-transactions"
  | "after-fingerprints"
  | "before-revision";

export interface IndexedDbImportCommitHooks {
  readonly atStage?: (stage: ImportCommitStage) => Promise<void> | void;
}

export class IndexedDbImportCommitRepository implements ImportCommitRepository {
  public constructor(
    private readonly database: FinancialDatabase,
    private readonly hooks: IndexedDbImportCommitHooks = {},
  ) {}

  public async commit(plan: AtomicImportCommitPlan, signal?: CancellationSignal): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.transaction(
        "rw",
        this.database.workspaces,
        this.database.accounts,
        this.database.imports,
        this.database.transactions,
        this.database.transactionFingerprints,
        async () => {
          throwIfCancelled(signal);
          await this.hooks.atStage?.("before-write");
          const workspace = await this.database.workspaces.get(plan.workspace.id);
          if (
            workspace === undefined ||
            workspace.revision !== plan.expectedWorkspaceRevision ||
            plan.workspace.revision !== plan.expectedWorkspaceRevision + 1
          ) {
            throw new StorageError("CONCURRENT_MODIFICATION");
          }
          const firstImport = plan.imports[0];
          if (firstImport === undefined) throw new StorageError("STORAGE_FAILURE");
          const account = await this.database.accounts.get(firstImport.accountId);
          if (account === undefined || account.workspaceId !== workspace.id) {
            throw new StorageError("STORAGE_FAILURE");
          }
          assertPlanRelationships(plan, account.id);
          await this.database.imports.bulkAdd(plan.imports.map(importToCanonical));
          await this.hooks.atStage?.("after-imports");
          throwIfCancelled(signal);
          await this.database.transactions.bulkAdd(plan.transactions.map(transactionToCanonical));
          await this.hooks.atStage?.("after-transactions");
          throwIfCancelled(signal);
          await this.database.transactionFingerprints.bulkAdd([...plan.fingerprints]);
          await this.hooks.atStage?.("after-fingerprints");
          throwIfCancelled(signal);
          await this.hooks.atStage?.("before-revision");
          await this.database.workspaces.put(plan.workspace);
        },
      );
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async listImportsByAccount(accountId: AccountId): Promise<readonly StatementImport[]> {
    try {
      await openFinancialDatabase(this.database);
      const records = await this.database.imports
        .where("accountId")
        .equals(accountId)
        .sortBy("createdAt");
      return records.map(importFromCanonical);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async listTransactionsByAccount(
    accountId: AccountId,
  ): Promise<readonly DomainTransaction[]> {
    try {
      await openFinancialDatabase(this.database);
      const records = await this.database.transactions
        .where("accountId")
        .equals(accountId)
        .toArray();
      return records.map(transactionFromCanonical);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async listAllTransactions(): Promise<readonly DomainTransaction[]> {
    try {
      await openFinancialDatabase(this.database);
      return (await this.database.transactions.toArray()).map(transactionFromCanonical);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async replaceAllFingerprints(
    fingerprints: readonly TransactionFingerprint[],
  ): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.transaction("rw", this.database.transactionFingerprints, async () => {
        await this.database.transactionFingerprints.clear();
        await this.database.transactionFingerprints.bulkAdd([...fingerprints]);
      });
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async deleteFingerprintsByImport(importId: ImportId): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.transactionFingerprints.where("importId").equals(importId).delete();
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }
}

export class IndexedDbCategoryRepository implements CategoryRepository {
  public constructor(private readonly database: FinancialDatabase) {}

  public async list(): Promise<readonly Category[]> {
    try {
      await openFinancialDatabase(this.database);
      return await this.database.categories.orderBy("order").toArray();
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async putMany(categories: readonly Category[]): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.categories.bulkPut([...categories]);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async save(category: Category): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.categories.put(category);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }
}

export class IndexedDbTransactionLedgerRepository
  implements TransactionLedgerRepository, DuplicateCandidateRepository
{
  public constructor(private readonly database: FinancialDatabase) {}

  public async list(): Promise<readonly DomainTransaction[]> {
    try {
      await openFinancialDatabase(this.database);
      return (await this.database.transactions.toArray()).map(transactionFromCanonical);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async listOperationsForTransaction(
    transactionId: DomainTransaction["id"],
  ): Promise<readonly BulkTransactionOperation[]> {
    try {
      await openFinancialDatabase(this.database);
      const records = await this.database.transactionOperations
        .filter((record) => record.changes.some((change) => change.transactionId === transactionId))
        .toArray();
      return records
        .map(operationFromRecord)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async listTransactionsByAccount(
    accountId: AccountId,
  ): Promise<readonly DomainTransaction[]> {
    try {
      await openFinancialDatabase(this.database);
      return (
        await this.database.transactions.where("accountId").equals(accountId).sortBy("createdAt")
      ).map(transactionFromCanonical);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async listFingerprintsByAccount(
    accountId: AccountId,
  ): Promise<
    readonly { readonly transactionId: DomainTransaction["id"]; readonly value: string }[]
  > {
    try {
      await openFinancialDatabase(this.database);
      return (
        await this.database.transactionFingerprints.where("accountId").equals(accountId).toArray()
      ).map(({ transactionId, fingerprint }) => ({ transactionId, value: fingerprint }));
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async applyBulk(operation: BulkTransactionOperation): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.transaction(
        "rw",
        this.database.transactions,
        this.database.transactionOperations,
        async () => {
          if ((await this.database.transactionOperations.get(operation.id)) !== undefined) {
            throw new StorageError("CONCURRENT_MODIFICATION");
          }
          for (const change of operation.changes) {
            const current = await this.database.transactions.get(change.transactionId);
            if (
              current === undefined ||
              !sameDocument(current, transactionToCanonical(change.before))
            ) {
              throw new StorageError("CONCURRENT_MODIFICATION");
            }
          }
          await this.database.transactions.bulkPut(
            operation.changes.map(({ after }) => transactionToCanonical(after)),
          );
          await this.database.transactionOperations.add(operationToRecord(operation));
        },
      );
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async findOperation(
    id: BulkTransactionOperation["id"],
  ): Promise<BulkTransactionOperation | undefined> {
    try {
      await openFinancialDatabase(this.database);
      const record = await this.database.transactionOperations.get(id);
      return record === undefined ? undefined : operationFromRecord(record);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async undoBulk(
    operation: BulkTransactionOperation,
    restored: readonly DomainTransaction[],
    undoneAt: DomainTransaction["updatedAt"],
  ): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.transaction(
        "rw",
        this.database.transactions,
        this.database.transactionOperations,
        async () => {
          const stored = await this.database.transactionOperations.get(operation.id);
          if (stored === undefined || stored.undoneAt !== undefined) {
            throw new StorageError("CONCURRENT_MODIFICATION");
          }
          for (const change of operation.changes) {
            const current = await this.database.transactions.get(change.transactionId);
            if (
              current === undefined ||
              !sameDocument(current, transactionToCanonical(change.after))
            ) {
              throw new StorageError("CONCURRENT_MODIFICATION");
            }
          }
          await this.database.transactions.bulkPut(restored.map(transactionToCanonical));
          await this.database.transactionOperations.put({ ...stored, undoneAt });
        },
      );
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }
}

export class IndexedDbDuplicateResolutionRepository implements DuplicateResolutionRepository {
  public constructor(private readonly database: FinancialDatabase) {}

  public async load(): Promise<DuplicateResolutionJournal> {
    try {
      await openFinancialDatabase(this.database);
      const records = await this.database.duplicateResolutionEvents.orderBy("occurredAt").toArray();
      return { version: records.length, events: records.map(stripResolutionStorageFields) };
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async append(
    expectedVersion: number,
    event: DuplicateResolutionEvent,
  ): Promise<DuplicateResolutionJournal> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.transaction(
        "rw",
        this.database.duplicateResolutionEvents,
        this.database.transactions,
        async () => {
          if ((await this.database.duplicateResolutionEvents.count()) !== expectedVersion) {
            throw new StorageError("CONCURRENT_MODIFICATION");
          }
          if (event.type === "decision") {
            const ids = candidateTransactionIds(event.candidateId);
            const records = await this.database.transactions.bulkGet([...ids]);
            if (records.some((record) => record === undefined)) {
              throw new StorageError("STORAGE_FAILURE");
            }
            const present = records as CanonicalTransactionDocument[];
            const priorStates = Object.fromEntries(
              present.map((record) => [
                record.id,
                { status: record.status, reviewState: record.reviewState },
              ]),
            ) as NonNullable<DuplicateResolutionEventRecord["priorStates"]>;
            const [existing, incoming] = present;
            if (existing === undefined || incoming === undefined)
              throw new StorageError("STORAGE_FAILURE");
            const updated = resolutionDocuments(existing, incoming, event.action);
            if (updated.length > 0) await this.database.transactions.bulkPut(updated);
            await this.database.duplicateResolutionEvents.add({ ...event, priorStates });
          } else {
            const decision = await this.database.duplicateResolutionEvents.get(event.decisionId);
            if (decision?.type !== "decision" || decision.priorStates === undefined) {
              throw new StorageError("STORAGE_FAILURE");
            }
            const records = await this.database.transactions.bulkGet(
              Object.keys(decision.priorStates),
            );
            const restored = records.flatMap((record) => {
              if (record === undefined) throw new StorageError("STORAGE_FAILURE");
              const state = decision.priorStates?.[record.id];
              return state === undefined ? [] : [{ ...record, ...state }];
            });
            await this.database.transactions.bulkPut(restored);
            await this.database.duplicateResolutionEvents.add(event);
          }
        },
      );
      return await this.load();
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }
}

function assertPlanRelationships(plan: AtomicImportCommitPlan, accountId: AccountId): void {
  if (
    plan.imports.length === 0 ||
    plan.transactions.length === 0 ||
    plan.transactions.length !== plan.fingerprints.length
  ) {
    throw new StorageError("STORAGE_FAILURE");
  }
  const imports = new Set(plan.imports.map((statementImport) => statementImport.id));
  const transactions = new Map(
    plan.transactions.map((transaction) => [transaction.id, transaction]),
  );
  if (plan.imports.some((statementImport) => statementImport.accountId !== accountId)) {
    throw new StorageError("STORAGE_FAILURE");
  }
  for (const transaction of plan.transactions) {
    if (transaction.accountId !== accountId || !imports.has(transaction.importId)) {
      throw new StorageError("STORAGE_FAILURE");
    }
  }
  for (const fingerprint of plan.fingerprints) {
    const transaction = transactions.get(fingerprint.transactionId);
    if (
      transaction === undefined ||
      fingerprint.accountId !== transaction.accountId ||
      fingerprint.importId !== transaction.importId
    ) {
      throw new StorageError("STORAGE_FAILURE");
    }
  }
}

function operationToRecord(operation: BulkTransactionOperation): TransactionOperationRecord {
  return {
    id: operation.id,
    kind: operation.kind,
    changes: operation.changes.map((change) => ({
      transactionId: change.transactionId,
      before: transactionToCanonical(change.before),
      after: transactionToCanonical(change.after),
    })),
    createdAt: operation.createdAt,
    ...(operation.undoneAt === undefined ? {} : { undoneAt: operation.undoneAt }),
  };
}

function operationFromRecord(record: TransactionOperationRecord): BulkTransactionOperation {
  return {
    id: parseOperationId(record.id),
    kind: record.kind,
    changes: record.changes.map((change) => ({
      transactionId: parseTransactionId(change.transactionId),
      before: transactionFromCanonical(change.before),
      after: transactionFromCanonical(change.after),
    })),
    createdAt: parseUtcTimestamp(record.createdAt),
    ...(record.undoneAt === undefined ? {} : { undoneAt: parseUtcTimestamp(record.undoneAt) }),
  };
}

function sameDocument(
  left: CanonicalTransactionDocument,
  right: CanonicalTransactionDocument,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function stripResolutionStorageFields(
  record: DuplicateResolutionEventRecord,
): DuplicateResolutionEvent {
  const { priorStates: _priorStates, ...event } = record;
  return event;
}

function candidateTransactionIds(
  candidateId: string,
): readonly [DomainTransaction["id"], DomainTransaction["id"]] {
  const parts = candidateId.split(":");
  if (parts.length !== 2 || parts[0] === undefined || parts[1] === undefined) {
    throw new StorageError("STORAGE_FAILURE");
  }
  return [parseTransactionId(parts[0]), parseTransactionId(parts[1])];
}

function resolutionDocuments(
  existing: CanonicalTransactionDocument,
  incoming: CanonicalTransactionDocument,
  action: "keep-existing" | "keep-new" | "keep-both" | "manual-link",
): readonly CanonicalTransactionDocument[] {
  if (action === "keep-existing") {
    return [
      { ...existing, reviewState: "reviewed" },
      { ...incoming, status: "void", reviewState: "reviewed" },
    ];
  }
  if (action === "keep-new") {
    return [
      { ...existing, status: "void", reviewState: "reviewed" },
      { ...incoming, reviewState: "reviewed" },
    ];
  }
  return [
    { ...existing, reviewState: "reviewed" },
    { ...incoming, reviewState: "reviewed" },
  ];
}

function throwIfCancelled(signal: CancellationSignal | undefined): void {
  if (signal?.aborted === true) throw new StorageError("STORAGE_FAILURE");
}
