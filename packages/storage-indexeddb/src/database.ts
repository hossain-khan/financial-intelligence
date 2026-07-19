import type { AccountRepository, WorkspaceRepository } from "@financial-intelligence/application";
import type { Account, AccountId, Workspace, WorkspaceId } from "@financial-intelligence/domain";
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
// Dexie stores public schema versions at ten times their declared value in native IndexedDB.
const DEXIE_NATIVE_VERSION_SCALE = 10;

export class FinancialDatabase extends Dexie {
  public workspaces!: EntityTable<WorkspaceRecord, "id">;
  public accounts!: EntityTable<AccountRecord, "id">;
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
    // No referencing canonical store exists yet. This port method is intentionally present so
    // transaction storage can enforce the guard without changing account application behavior.
    return false;
  }

  public async deleteIfUnreferenced(id: AccountId): Promise<boolean> {
    try {
      await openFinancialDatabase(this.database);
      // Accounts are not referenced by any canonical store in v3. The repository contract keeps
      // this as one atomic decision so the transaction store can join this transaction in v4.
      await this.database.transaction("rw", this.database.accounts, async () => {
        await this.database.accounts.delete(id);
      });
      return true;
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
}
