import type {
  AtomicImportCommitPlan,
  CancellationSignal,
  ImportCommitRepository,
  TransactionFingerprint,
  AccountRepository,
  WorkspaceRepository,
} from "@financial-intelligence/application";
import {
  importFromCanonical,
  importToCanonical,
  transactionFromCanonical,
  transactionToCanonical,
  type Account,
  type AccountId,
  type CanonicalTransactionDocument,
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
// Dexie stores public schema versions at ten times their declared value in native IndexedDB.
const DEXIE_NATIVE_VERSION_SCALE = 10;

export class FinancialDatabase extends Dexie {
  public workspaces!: EntityTable<WorkspaceRecord, "id">;
  public accounts!: EntityTable<AccountRecord, "id">;
  public imports!: EntityTable<ImportRecord, "id">;
  public transactions!: EntityTable<TransactionRecord, "id">;
  public transactionFingerprints!: EntityTable<TransactionFingerprintRecord, "transactionId">;
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
          await assertNoExistingSourceIds(this.database, plan);

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

async function assertNoExistingSourceIds(
  database: FinancialDatabase,
  plan: AtomicImportCommitPlan,
): Promise<void> {
  for (const transaction of plan.transactions) {
    if (transaction.sourceTransactionId === undefined) continue;
    const existing = await database.transactions
      .where("[accountId+sourceTransactionId]")
      .equals([transaction.accountId, transaction.sourceTransactionId])
      .first();
    if (existing !== undefined) throw new StorageError("DUPLICATE_SOURCE_ID");
  }
}

function throwIfCancelled(signal: CancellationSignal | undefined): void {
  if (signal?.aborted === true) throw new StorageError("STORAGE_FAILURE");
}
