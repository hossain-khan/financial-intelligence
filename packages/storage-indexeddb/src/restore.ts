import type {
  RestoreConflict,
  RestoreMode,
  RestoreRepository,
  RestoreResult,
} from "@financial-intelligence/application";
import type { WorkspaceBackupSnapshot } from "@financial-intelligence/backup";

import type { Table } from "dexie";

import { FinancialDatabase, openFinancialDatabase } from "./database";
import { normalizeStorageError, StorageError } from "./errors";

/** Prefix for temporary staging databases so cleanup can recognize and remove abandoned ones. */
const STAGING_PREFIX = "financial-intelligence-restore-";
/** Abandoned staging databases older than this are removed at startup. */
const STAGING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * The canonical stores a restore writes, paired with the snapshot section that feeds each. Order
 * matters for the final write (parents before children) and is the single source of truth for both
 * conflict detection and the atomic apply, so a section can never be silently skipped.
 */
const RESTORE_TABLES = [
  { table: "accounts", section: "accounts" },
  { table: "imports", section: "imports" },
  { table: "transactions", section: "transactions" },
  { table: "categories", section: "categories" },
  { table: "merchants", section: "merchants" },
  { table: "classificationRules", section: "classificationRules" },
  { table: "transferDecisions", section: "transferDecisions" },
  { table: "recurringDecisions", section: "recurringDecisions" },
  { table: "learningOperations", section: "learningOperations" },
  { table: "decisionEvents", section: "decisionEvents" },
  { table: "transactionOperations", section: "transactionOperations" },
  { table: "duplicateResolutionEvents", section: "duplicateResolutionEvents" },
] as const;

type RestoreTable = (typeof RESTORE_TABLES)[number]["table"];

interface RestoreRecord {
  readonly id: string;
}

export interface RestoreStagingOptions {
  /** Injectable clock so staging names/cleanup are deterministic in tests. */
  readonly now?: () => number;
  /** Injectable random suffix so staging DB names are unique and test-controllable. */
  readonly randomSuffix?: () => string;
  /** Injectable storage estimator; defaults to navigator.storage.estimate when available. */
  readonly estimate?: () => Promise<{ usage?: number; quota?: number } | undefined>;
}

/**
 * Restore repository: validates a decrypted snapshot in a uniquely-named temporary IndexedDB
 * database, reports merge conflicts and a storage estimate, and applies the chosen mode as a single
 * atomic transaction over the primary database. A transaction abort leaves the original workspace
 * intact; a merge only writes conflict-free records.
 */
export class IndexedDbRestoreRepository implements RestoreRepository {
  private readonly now: () => number;
  private readonly randomSuffix: () => string;
  private readonly estimate: () => Promise<{ usage?: number; quota?: number } | undefined>;

  public constructor(
    private readonly database: FinancialDatabase,
    options: RestoreStagingOptions = {},
  ) {
    this.now = options.now ?? (() => Date.now());
    this.randomSuffix =
      options.randomSuffix ?? (() => crypto.randomUUID().replaceAll("-", "").slice(0, 16));
    this.estimate =
      options.estimate ??
      (async () => {
        if (typeof navigator === "undefined" || navigator.storage?.estimate === undefined) {
          return undefined;
        }
        return navigator.storage.estimate();
      });
  }

  public async workspaceExists(workspaceId: string): Promise<boolean> {
    try {
      await openFinancialDatabase(this.database);
      return (await this.database.workspaces.get(workspaceId as never)) !== undefined;
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async stage(snapshot: WorkspaceBackupSnapshot): Promise<{
    readonly mergeConflicts: readonly RestoreConflict[];
    readonly estimatedBytes: number;
  }> {
    const stagingName = `${STAGING_PREFIX}${this.now()}-${this.randomSuffix()}`;
    const staging = new FinancialDatabase(stagingName);
    try {
      await openFinancialDatabase(staging);
      // Write every section into the staging database inside one transaction: this proves the
      // snapshot is internally consistent and writable before we compute conflicts or touch primary.
      await staging.transaction("rw", restoreTablesOf(staging), async () => {
        await staging.workspaces.put(snapshot.workspace);
        for (const { table, section } of RESTORE_TABLES) {
          const rows = sectionRows(snapshot, section);
          if (rows.length > 0) await bulkPutRows(staging, table, rows);
        }
      });

      const mergeConflicts = await this.computeMergeConflicts(snapshot);
      const estimatedBytes = await this.estimateBytes(snapshot);
      return { mergeConflicts, estimatedBytes };
    } catch (error) {
      throw normalizeStorageError(error);
    } finally {
      staging.close();
      await deleteDatabase(stagingName);
    }
  }

  public async apply(snapshot: WorkspaceBackupSnapshot, mode: RestoreMode): Promise<RestoreResult> {
    try {
      await openFinancialDatabase(this.database);
      const workspaceId = snapshot.workspace.id;
      let recordsWritten = 0;

      await this.database.transaction("rw", restoreTablesOf(this.database), async () => {
        const existing = await this.database.workspaces.get(workspaceId);
        if (mode === "restore-as-new" && existing !== undefined) {
          throw new StorageError("STORAGE_FAILURE");
        }
        if (mode === "replace" && existing !== undefined) {
          await this.clearWorkspace(workspaceId);
        }

        for (const { table, section } of RESTORE_TABLES) {
          const rows = sectionRows(snapshot, section);
          const toWrite = mode === "merge" ? await this.mergeableRows(table, rows) : rows;
          if (toWrite.length > 0) {
            await bulkPutRows(this.database, table, toWrite);
            recordsWritten += toWrite.length;
          }
        }
        await this.database.workspaces.put(snapshot.workspace);
      });

      return {
        mode,
        workspaceId,
        committedRevision: snapshot.workspace.revision,
        recordsWritten,
      };
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  /** Remove abandoned staging databases older than the bounded age; never touches other databases. */
  public async cleanupAbandonedStaging(): Promise<number> {
    if (typeof indexedDB === "undefined" || indexedDB.databases === undefined) return 0;
    const cutoff = this.now() - STAGING_MAX_AGE_MS;
    let removed = 0;
    for (const info of await indexedDB.databases()) {
      const name = info.name ?? "";
      if (!name.startsWith(STAGING_PREFIX)) continue;
      const createdAt = Number(name.slice(STAGING_PREFIX.length).split("-")[0]);
      if (Number.isFinite(createdAt) && createdAt < cutoff) {
        await deleteDatabase(name);
        removed += 1;
      }
    }
    return removed;
  }

  private async computeMergeConflicts(
    snapshot: WorkspaceBackupSnapshot,
  ): Promise<readonly RestoreConflict[]> {
    const conflicts: RestoreConflict[] = [];
    for (const { table, section } of RESTORE_TABLES) {
      const rows = sectionRows(snapshot, section);
      for (const row of rows) {
        const existing = (await this.database.table(table).get(row.id)) as
          RestoreRecord | undefined;
        if (existing === undefined) continue;
        // A same-id record is only conflict-free when it is byte-identical; otherwise merging would
        // have to overwrite or pick a winner, which we never do silently.
        if (!identical(existing, row)) {
          conflicts.push({ section, id: row.id, reason: "divergent-record" });
        }
      }
    }
    return conflicts;
  }

  private async mergeableRows(
    table: RestoreTable,
    rows: readonly RestoreRecord[],
  ): Promise<RestoreRecord[]> {
    const result: RestoreRecord[] = [];
    for (const row of rows) {
      const existing = (await this.database.table(table).get(row.id)) as RestoreRecord | undefined;
      if (existing === undefined) result.push(row);
      // Byte-identical same-id records need no write; divergent ones were rejected before apply.
    }
    return result;
  }

  private async clearWorkspace(workspaceId: string): Promise<void> {
    const accounts = await this.database.accounts
      .where("workspaceId")
      .equals(workspaceId)
      .toArray();
    const accountIds = new Set(accounts.map((account) => account.id as string));
    const transactions = (await this.database.transactions.toArray()).filter((row) =>
      accountIds.has(row.accountId),
    );
    const transactionIds = new Set(transactions.map((row) => row.id));
    const importIds = new Set(
      (await this.database.imports.toArray())
        .filter((row) => accountIds.has(row.accountId))
        .map((row) => row.id),
    );

    await this.database.accounts.bulkDelete([...accountIds] as never[]);
    await this.database.transactions.bulkDelete([...transactionIds]);
    await this.database.imports.bulkDelete([...importIds]);
    await this.database.transactionFingerprints
      .where("transactionId")
      .anyOf([...transactionIds])
      .delete();
    // Workspace-scoped shared stores (categories, merchants, rules, decisions, history) are replaced
    // wholesale because they are not account-partitioned; the backup carries the authoritative set.
    await this.database.categories.clear();
    await this.database.merchants.clear();
    await this.database.classificationRules.clear();
    await this.database.transferDecisions.clear();
    await this.database.recurringDecisions.clear();
    await this.database.learningOperations.clear();
    await this.database.decisionEvents.clear();
    await this.database.transactionOperations.clear();
    await this.database.duplicateResolutionEvents.clear();
  }

  private async estimateBytes(snapshot: WorkspaceBackupSnapshot): Promise<number> {
    // A rough serialized size, doubled to leave staging + rollback headroom. The estimate is only
    // advisory; it is never treated as permission to partially write.
    const serialized = new TextEncoder().encode(JSON.stringify(snapshot)).byteLength;
    const estimate = await this.estimate();
    if (estimate?.quota !== undefined && estimate.usage !== undefined) {
      const remaining = estimate.quota - estimate.usage;
      if (serialized * 2 > remaining) throw new StorageError("QUOTA_EXCEEDED");
    }
    return serialized;
  }
}

async function bulkPutRows(
  database: FinancialDatabase,
  table: RestoreTable,
  rows: readonly RestoreRecord[],
): Promise<void> {
  await (database.table(table) as Table<RestoreRecord, string>).bulkPut([...rows]);
}

function restoreTablesOf(database: FinancialDatabase): Table[] {
  return [
    database.workspaces,
    database.transactionFingerprints,
    ...RESTORE_TABLES.map(({ table }) => database.table(table)),
  ] as unknown as Table[];
}

function sectionRows(snapshot: WorkspaceBackupSnapshot, section: string): readonly RestoreRecord[] {
  const value = (snapshot as unknown as Record<string, unknown>)[section];
  return Array.isArray(value) ? (value as RestoreRecord[]) : [];
}

function identical(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function deleteDatabase(name: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
