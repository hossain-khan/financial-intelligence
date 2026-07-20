import type {
  AtomicImportCommitPlan,
  CancellationSignal,
  ImportCommitRepository,
  TransactionFingerprint,
  AccountRepository,
  AtomicLearningRepository,
  WorkspaceRepository,
  BulkTransactionOperation,
  DuplicateCandidateRepository,
  DuplicateResolutionJournal,
  DuplicateResolutionRepository,
  TransactionLedgerRepository,
  CategoryRepository,
  DashboardSnapshotRepository,
  MerchantRepository,
  RuleRepository,
  WorkspaceBackupRepository,
  LearningOperation,
  LearningOperationChange,
} from "@financial-intelligence/application";
import {
  WORKSPACE_BACKUP_FORMAT,
  WORKSPACE_BACKUP_VERSION,
  type WorkspaceBackupSnapshot,
} from "@financial-intelligence/backup";
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
  type ClassificationRule,
  type CanonicalTransactionDocument,
  type DuplicateResolutionEvent,
  type ImportId,
  type Merchant,
  type MerchantId,
  type RecurringDecisionRecord,
  type RuleId,
  type StatementImport,
  type StatementImportDocument,
  type Transaction as DomainTransaction,
  type TransferLink,
  type TransferProposal,
  type Workspace,
  type WorkspaceId,
} from "@financial-intelligence/domain";
import Dexie, { type EntityTable, type Table } from "dexie";

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
type MerchantRecord = Merchant;
type ClassificationRuleRecord = ClassificationRule;
export type TransferDecisionRecord = TransferLink;
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
export type LearningOperationRecord = LearningOperation;
export type LearningOperationChangeRecord = LearningOperationChange;

export interface DecisionEventRecord {
  readonly id: string;
  readonly aggregateType: "transfer" | "recurring";
  readonly aggregateId: string;
  readonly action: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly occurredAt: string;
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
  public merchants!: EntityTable<MerchantRecord, "id">;
  public classificationRules!: EntityTable<ClassificationRuleRecord, "id">;
  public transferDecisions!: EntityTable<TransferDecisionRecord, "id">;
  public recurringDecisions!: EntityTable<RecurringDecisionRecord, "id">;
  public learningOperations!: EntityTable<LearningOperationRecord, "id">;
  public decisionEvents!: EntityTable<DecisionEventRecord, "id">;
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

export class IndexedDbWorkspaceBackupRepository implements WorkspaceBackupRepository {
  public constructor(private readonly database: FinancialDatabase) {}

  public async readSnapshot(
    workspaceId: WorkspaceId,
    exportedAt: string,
  ): Promise<WorkspaceBackupSnapshot> {
    try {
      await openFinancialDatabase(this.database);
      return await this.database.transaction(
        "r",
        [
          this.database.workspaces,
          this.database.accounts,
          this.database.imports,
          this.database.transactions,
          this.database.categories,
          this.database.merchants,
          this.database.classificationRules,
          this.database.transferDecisions,
          this.database.recurringDecisions,
          this.database.learningOperations,
          this.database.decisionEvents,
          this.database.transactionOperations,
          this.database.duplicateResolutionEvents,
        ],
        async () => {
          const workspace = await this.database.workspaces.get(workspaceId);
          if (workspace === undefined) throw new StorageError("STORAGE_FAILURE");
          const accounts = await this.database.accounts
            .where("workspaceId")
            .equals(workspaceId)
            .sortBy("createdAt");
          const accountIds = new Set(accounts.map((account) => account.id as string));
          const imports = (await this.database.imports.toArray()).filter((item) =>
            accountIds.has(item.accountId),
          );
          const transactions = (await this.database.transactions.toArray()).filter((item) =>
            accountIds.has(item.accountId),
          );
          const transactionIds = new Set(transactions.map((item) => item.id));
          const transferDecisions = (await this.database.transferDecisions.toArray()).filter(
            (item) =>
              transactionIds.has(item.outflowTransactionId) &&
              transactionIds.has(item.inflowTransactionId),
          );
          const transactionOperations = (await this.database.transactionOperations.toArray())
            .filter((item) =>
              item.changes.some((change) => transactionIds.has(change.transactionId)),
            )
            .map((item) => ({ ...item, changes: item.changes.map((change) => ({ ...change })) }));
          const allEvents = await this.database.duplicateResolutionEvents.toArray();
          const decisions = allEvents.filter(
            (event) =>
              event.type === "decision" && candidateIdBelongsTo(event.candidateId, transactionIds),
          );
          const decisionIds = new Set(decisions.map((event) => event.id));
          const duplicateResolutionEvents = allEvents.filter((event) =>
            event.type === "decision"
              ? decisionIds.has(event.id)
              : decisionIds.has(event.decisionId),
          );
          return {
            format: WORKSPACE_BACKUP_FORMAT,
            version: WORKSPACE_BACKUP_VERSION,
            exportedAt,
            databaseVersion: this.database.declaredVersion,
            workspace,
            accounts,
            imports,
            transactions,
            categories: await this.database.categories.orderBy("order").toArray(),
            merchants: await this.database.merchants.orderBy("name").toArray(),
            classificationRules: await this.database.classificationRules
              .orderBy("priority")
              .reverse()
              .toArray(),
            transferDecisions,
            recurringDecisions: await this.database.recurringDecisions.toArray(),
            learningOperations: await this.database.learningOperations.toArray(),
            decisionEvents: await this.database.decisionEvents.toArray(),
            transactionOperations,
            duplicateResolutionEvents,
          };
        },
      );
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
        this.database.transferDecisions,
        this.database.recurringDecisions,
        this.database.decisionEvents,
        async () => {
          await makeJournalRoom(this.database.decisionEvents, "occurredAt");
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
            const voidedIds = new Set(
              updated.filter(({ status }) => status === "void").map(({ id }) => id),
            );
            if (voidedIds.size > 0) {
              const transferLinks = await this.database.transferDecisions
                .where("status")
                .equals("confirmed")
                .toArray();
              for (const link of transferLinks) {
                if (
                  !voidedIds.has(link.outflowTransactionId) &&
                  !voidedIds.has(link.inflowTransactionId)
                )
                  continue;
                const after = { ...link, status: "unlinked" as const, updatedAt: event.occurredAt };
                await this.database.transferDecisions.put(after);
                await makeJournalRoom(this.database.decisionEvents, "occurredAt");
                await this.database.decisionEvents.add({
                  id: `${event.id}:transfer:${link.id}`,
                  aggregateType: "transfer",
                  aggregateId: link.signature,
                  action: "invalidate-source",
                  before: link,
                  after,
                  occurredAt: event.occurredAt,
                });
              }
              const recurring = await this.database.recurringDecisions
                .where("status")
                .equals("confirmed")
                .toArray();
              for (const decision of recurring) {
                if (!(decision.memberTransactionIds ?? []).some((id) => voidedIds.has(id)))
                  continue;
                const after = {
                  ...decision,
                  status: "invalidated" as const,
                  updatedAt: event.occurredAt,
                };
                await this.database.recurringDecisions.put(after);
                await makeJournalRoom(this.database.decisionEvents, "occurredAt");
                await this.database.decisionEvents.add({
                  id: `${event.id}:recurring:${decision.id}`,
                  aggregateType: "recurring",
                  aggregateId: decision.id,
                  action: "invalidate-source",
                  before: decision,
                  after,
                  occurredAt: event.occurredAt,
                });
              }
            }
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

function candidateIdBelongsTo(candidateId: string, transactionIds: ReadonlySet<string>): boolean {
  const separator = candidateId.indexOf(":");
  if (separator < 1) return false;
  return (
    transactionIds.has(candidateId.slice(0, separator)) &&
    transactionIds.has(candidateId.slice(separator + 1))
  );
}

export class IndexedDbMerchantRepository implements MerchantRepository {
  public constructor(private readonly database: FinancialDatabase) {}

  public async list(): Promise<readonly Merchant[]> {
    try {
      await openFinancialDatabase(this.database);
      return await this.database.merchants.orderBy("name").toArray();
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async findById(id: MerchantId): Promise<Merchant | undefined> {
    try {
      await openFinancialDatabase(this.database);
      return await this.database.merchants.get(id);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async save(merchant: Merchant): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.merchants.put(merchant);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async saveMany(merchants: readonly Merchant[]): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.merchants.bulkPut([...merchants]);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }
}

export class IndexedDbRuleRepository implements RuleRepository {
  public constructor(private readonly database: FinancialDatabase) {}

  public async list(): Promise<readonly ClassificationRule[]> {
    try {
      await openFinancialDatabase(this.database);
      return await this.database.classificationRules.orderBy("priority").reverse().toArray();
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async findById(id: RuleId): Promise<ClassificationRule | undefined> {
    try {
      await openFinancialDatabase(this.database);
      return await this.database.classificationRules.get(id);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async save(rule: ClassificationRule): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.classificationRules.put(rule);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async delete(id: RuleId): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.classificationRules.delete(id);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }
}

export class IndexedDbTransferDecisionRepository {
  public constructor(private readonly database: FinancialDatabase) {}

  public async list(): Promise<readonly TransferDecisionRecord[]> {
    try {
      await openFinancialDatabase(this.database);
      return await this.database.transferDecisions.toArray();
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async findBySignature(signature: string): Promise<TransferDecisionRecord | undefined> {
    try {
      await openFinancialDatabase(this.database);
      return await this.database.transferDecisions.where("signature").equals(signature).first();
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async save(record: TransferDecisionRecord): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.transferDecisions.put(record);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async confirmAtomically(
    proposal: TransferProposal,
    record: TransferDecisionRecord,
    eventId: string,
  ): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.transaction(
        "rw",
        this.database.transactions,
        this.database.transferDecisions,
        this.database.decisionEvents,
        async () => {
          await makeJournalRoom(this.database.decisionEvents, "occurredAt");
          const [outflow, inflow] = await this.database.transactions.bulkGet([
            proposal.outflowTransaction.id,
            proposal.inflowTransaction.id,
          ]);
          if (
            outflow === undefined ||
            inflow === undefined ||
            !sameDocument(outflow, transactionToCanonical(proposal.outflowTransaction)) ||
            !sameDocument(inflow, transactionToCanonical(proposal.inflowTransaction))
          ) {
            throw new StorageError("CONCURRENT_MODIFICATION");
          }
          const active = await this.database.transferDecisions
            .where("status")
            .equals("confirmed")
            .toArray();
          if (
            active.some(
              (link) =>
                link.signature !== record.signature &&
                (link.outflowTransactionId === record.outflowTransactionId ||
                  link.inflowTransactionId === record.outflowTransactionId ||
                  link.outflowTransactionId === record.inflowTransactionId ||
                  link.inflowTransactionId === record.inflowTransactionId),
            )
          ) {
            throw new StorageError("CONCURRENT_MODIFICATION");
          }
          const before = await this.database.transferDecisions
            .where("signature")
            .equals(record.signature)
            .first();
          await this.database.transferDecisions.put(record);
          await this.database.decisionEvents.add({
            id: eventId,
            aggregateType: "transfer",
            aggregateId: record.signature,
            action: "confirm",
            ...(before === undefined ? {} : { before }),
            after: record,
            occurredAt: record.updatedAt,
          });
        },
      );
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async saveWithEvent(
    record: TransferDecisionRecord,
    eventId: string,
    action: string,
  ): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.transaction(
        "rw",
        this.database.transferDecisions,
        this.database.decisionEvents,
        async () => {
          await makeJournalRoom(this.database.decisionEvents, "occurredAt");
          const before = await this.database.transferDecisions
            .where("signature")
            .equals(record.signature)
            .first();
          await this.database.transferDecisions.put(record);
          await this.database.decisionEvents.add({
            id: eventId,
            aggregateType: "transfer",
            aggregateId: record.signature,
            action,
            ...(before === undefined ? {} : { before }),
            after: record,
            occurredAt: record.updatedAt,
          });
        },
      );
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async undoLast(signature: string, eventId: string, occurredAt: string): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.transaction(
        "rw",
        this.database.transferDecisions,
        this.database.decisionEvents,
        async () => {
          await makeJournalRoom(this.database.decisionEvents, "occurredAt");
          const events = await this.database.decisionEvents
            .where("aggregateId")
            .equals(signature)
            .filter((event) => event.aggregateType === "transfer" && event.undoneAt === undefined)
            .toArray();
          const latest = events.sort((left, right) =>
            right.occurredAt.localeCompare(left.occurredAt),
          )[0];
          if (latest === undefined || latest.after === undefined) {
            throw new StorageError("CONCURRENT_MODIFICATION");
          }
          const current = await this.database.transferDecisions
            .where("signature")
            .equals(signature)
            .first();
          if (!sameUnknown(current, latest.after))
            throw new StorageError("CONCURRENT_MODIFICATION");
          if (latest.before === undefined) {
            if (current !== undefined) await this.database.transferDecisions.delete(current.id);
          } else {
            await this.database.transferDecisions.put(latest.before as TransferDecisionRecord);
          }
          await this.database.decisionEvents.put({ ...latest, undoneAt: occurredAt });
          await this.database.decisionEvents.add({
            id: eventId,
            aggregateType: "transfer",
            aggregateId: signature,
            action: "undo",
            before: latest.after,
            after: latest.before,
            occurredAt,
          });
        },
      );
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }
}

export class IndexedDbRecurringDecisionRepository {
  public constructor(private readonly database: FinancialDatabase) {}

  public async list(): Promise<readonly RecurringDecisionRecord[]> {
    try {
      await openFinancialDatabase(this.database);
      return await this.database.recurringDecisions.toArray();
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async findBySignature(signature: string): Promise<RecurringDecisionRecord | undefined> {
    try {
      await openFinancialDatabase(this.database);
      return await this.database.recurringDecisions.where("signature").equals(signature).first();
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async save(record: RecurringDecisionRecord): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.recurringDecisions.put(record);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async saveWithEvent(
    record: RecurringDecisionRecord,
    eventId: string,
    action: string,
  ): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.transaction(
        "rw",
        this.database.recurringDecisions,
        this.database.decisionEvents,
        async () => {
          await makeJournalRoom(this.database.decisionEvents, "occurredAt");
          const before = await this.database.recurringDecisions.get(record.id);
          await this.database.recurringDecisions.put(record);
          await this.database.decisionEvents.add({
            id: eventId,
            aggregateType: "recurring",
            aggregateId: record.id,
            action,
            ...(before === undefined ? {} : { before }),
            after: record,
            occurredAt: record.updatedAt,
          });
        },
      );
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async saveManyWithEvent(
    records: readonly RecurringDecisionRecord[],
    aggregateId: string,
    eventId: string,
    action: string,
  ): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.transaction(
        "rw",
        this.database.recurringDecisions,
        this.database.decisionEvents,
        async () => {
          await makeJournalRoom(this.database.decisionEvents, "occurredAt");
          if (
            records.length === 0 ||
            new Set(records.map(({ id }) => id)).size !== records.length
          ) {
            throw new StorageError("CONCURRENT_MODIFICATION");
          }
          const before = await this.database.recurringDecisions.bulkGet(
            records.map(({ id }) => id),
          );
          await this.database.recurringDecisions.bulkPut([...records]);
          await this.database.decisionEvents.add({
            id: eventId,
            aggregateType: "recurring",
            aggregateId,
            action,
            before,
            after: records,
            occurredAt: records[0]!.updatedAt,
          });
        },
      );
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async undoLast(id: string, eventId: string, occurredAt: string): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.transaction(
        "rw",
        this.database.recurringDecisions,
        this.database.decisionEvents,
        async () => {
          await makeJournalRoom(this.database.decisionEvents, "occurredAt");
          const events = await this.database.decisionEvents
            .where("aggregateId")
            .equals(id)
            .filter((event) => event.aggregateType === "recurring" && event.undoneAt === undefined)
            .toArray();
          const latest = events.sort((left, right) =>
            right.occurredAt.localeCompare(left.occurredAt),
          )[0];
          if (latest === undefined || latest.after === undefined)
            throw new StorageError("CONCURRENT_MODIFICATION");
          if (Array.isArray(latest.after)) {
            const after = latest.after as RecurringDecisionRecord[];
            const before = latest.before as (RecurringDecisionRecord | undefined)[];
            const current = await this.database.recurringDecisions.bulkGet(
              after.map(({ id: recordId }) => recordId),
            );
            if (!sameUnknown(current, after)) throw new StorageError("CONCURRENT_MODIFICATION");
            for (let index = 0; index < after.length; index++) {
              const prior = before[index];
              if (prior === undefined)
                await this.database.recurringDecisions.delete(after[index]!.id);
              else await this.database.recurringDecisions.put(prior);
            }
          } else {
            const current = await this.database.recurringDecisions.get(id);
            if (!sameUnknown(current, latest.after))
              throw new StorageError("CONCURRENT_MODIFICATION");
            if (latest.before === undefined) await this.database.recurringDecisions.delete(id);
            else
              await this.database.recurringDecisions.put(latest.before as RecurringDecisionRecord);
          }
          await this.database.decisionEvents.put({ ...latest, undoneAt: occurredAt });
          await this.database.decisionEvents.add({
            id: eventId,
            aggregateType: "recurring",
            aggregateId: id,
            action: "undo",
            before: latest.after,
            after: latest.before,
            occurredAt,
          });
        },
      );
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }
}

export class IndexedDbDashboardSnapshotRepository implements DashboardSnapshotRepository {
  public constructor(private readonly database: FinancialDatabase) {}

  public async read() {
    try {
      await openFinancialDatabase(this.database);
      return await this.database.transaction(
        "r",
        this.database.transactions,
        this.database.categories,
        this.database.merchants,
        this.database.transferDecisions,
        this.database.recurringDecisions,
        async () => {
          const [
            transactionDocuments,
            categories,
            merchants,
            transferDecisions,
            recurringDecisions,
          ] = await Promise.all([
            this.database.transactions.toArray(),
            this.database.categories.toArray(),
            this.database.merchants.toArray(),
            this.database.transferDecisions.toArray(),
            this.database.recurringDecisions.toArray(),
          ]);
          const revisionBasis = [
            ...transactionDocuments.map((item) => `t:${item.id}:${item.updatedAt}`),
            ...categories.map((item) => `c:${item.id}:${item.updatedAt}`),
            ...merchants.map((item) => `m:${item.id}:${item.updatedAt}`),
            ...transferDecisions.map((item) => `x:${item.id}:${item.updatedAt}:${item.status}`),
            ...recurringDecisions.map((item) => `r:${item.id}:${item.updatedAt}:${item.status}`),
          ].sort();
          return {
            sourceRevision: stableRevision(revisionBasis),
            transactions: transactionDocuments.map(transactionFromCanonical),
            categories,
            merchants,
            transferDecisions,
            recurringDecisions,
          };
        },
      );
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }
}

export class IndexedDbAtomicLearningRepository implements AtomicLearningRepository {
  public constructor(
    private readonly database: FinancialDatabase,
    private readonly hooks: {
      readonly afterWrite?: (
        store: LearningOperationChange["store"] | "journal",
        index: number,
      ) => void;
    } = {},
  ) {}

  public async revision(): Promise<string> {
    try {
      await openFinancialDatabase(this.database);
      return await this.database.transaction(
        "r",
        this.database.transactions,
        this.database.categories,
        this.database.merchants,
        this.database.classificationRules,
        this.database.recurringDecisions,
        () => learningRevision(this.database),
      );
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async apply(operation: LearningOperation): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.transaction(
        "rw",
        [
          this.database.transactions,
          this.database.categories,
          this.database.merchants,
          this.database.classificationRules,
          this.database.recurringDecisions,
          this.database.learningOperations,
        ],
        async () => {
          await makeJournalRoom(this.database.learningOperations, "createdAt");
          if ((await learningRevision(this.database)) !== operation.expectedRevision) {
            throw new StorageError("CONCURRENT_MODIFICATION");
          }
          if ((await this.database.learningOperations.get(operation.id)) !== undefined) {
            throw new StorageError("CONCURRENT_MODIFICATION");
          }
          for (const change of operation.changes) {
            const table = learningTable(this.database, change.store);
            const current = await table.get(change.id);
            if (
              (change.before === undefined && current !== undefined) ||
              (change.before !== undefined && !sameUnknown(current, change.before))
            ) {
              throw new StorageError("CONCURRENT_MODIFICATION");
            }
          }
          for (const [index, change] of operation.changes.entries()) {
            await learningTable(this.database, change.store).put(change.after, change.id);
            this.hooks.afterWrite?.(change.store, index);
          }
          await this.database.learningOperations.add(operation);
          this.hooks.afterWrite?.("journal", operation.changes.length);
        },
      );
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async undo(operationId: string, undoneAt: DomainTransaction["updatedAt"]): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.transaction(
        "rw",
        [
          this.database.transactions,
          this.database.categories,
          this.database.merchants,
          this.database.classificationRules,
          this.database.recurringDecisions,
          this.database.learningOperations,
        ],
        async () => {
          const operation = await this.database.learningOperations.get(operationId);
          if (operation === undefined || operation.undoneAt !== undefined) {
            throw new StorageError("CONCURRENT_MODIFICATION");
          }
          for (const change of operation.changes) {
            const current = await learningTable(this.database, change.store).get(change.id);
            if (!sameUnknown(current, change.after)) {
              throw new StorageError("CONCURRENT_MODIFICATION");
            }
          }
          for (const change of [...operation.changes].reverse()) {
            const table = learningTable(this.database, change.store);
            if (change.before === undefined) await table.delete(change.id);
            else await table.put(change.before, change.id);
          }
          await this.database.learningOperations.put({ ...operation, undoneAt });
        },
      );
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async list(): Promise<readonly LearningOperation[]> {
    try {
      await openFinancialDatabase(this.database);
      return await this.database.learningOperations.orderBy("createdAt").reverse().toArray();
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }
}

function learningTable(
  database: FinancialDatabase,
  store: LearningOperationChange["store"],
): Table<unknown, string> {
  return database[store] as Table<unknown, string>;
}

async function learningRevision(database: FinancialDatabase): Promise<string> {
  const values: string[] = [];
  for (const [store, table] of [
    ["transactions", database.transactions],
    ["categories", database.categories],
    ["merchants", database.merchants],
    ["classificationRules", database.classificationRules],
    ["recurringDecisions", database.recurringDecisions],
  ] as const) {
    for (const value of await table.toArray()) {
      const record = value as { readonly id: string; readonly updatedAt?: string };
      values.push(`${store}:${record.id}:${record.updatedAt ?? ""}:${JSON.stringify(value)}`);
    }
  }
  return stableRevision(values.sort());
}

function sameUnknown(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function stableRevision(values: readonly string[]): string {
  let hash = 2_166_136_261;
  for (const value of values) {
    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16_777_619);
    }
  }
  return `dashboard-v1-${values.length}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

const MAX_OPERATION_JOURNAL_RECORDS = 1_000;

async function makeJournalRoom(table: Table<unknown, string>, chronologicalIndex: string) {
  const excess = (await table.count()) - MAX_OPERATION_JOURNAL_RECORDS + 1;
  if (excess <= 0) return;
  const oldest = (await table.orderBy(chronologicalIndex).limit(excess).primaryKeys()) as string[];
  await table.bulkDelete(oldest);
}
