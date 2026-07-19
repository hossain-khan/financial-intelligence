import type Dexie from "dexie";
import type { Transaction } from "dexie";

import { StorageError } from "./errors";

export interface DatabaseMigration {
  readonly version: number;
  readonly description: string;
  readonly stores: Readonly<Record<string, string | null>>;
  readonly upgrade?: (transaction: Transaction) => PromiseLike<unknown> | void;
}

const WORKSPACE_SCHEMA = "&id, createdAt, updatedAt";
const MIGRATION_JOURNAL_SCHEMA = "&id, migrationId, status, updatedAt";
const ACCOUNT_SCHEMA =
  "&id, workspaceId, [workspaceId+createdAt], [workspaceId+archived], createdAt, updatedAt";

export const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    version: 1,
    description: "Create the canonical workspace store",
    stores: { workspaces: WORKSPACE_SCHEMA },
  },
  {
    version: 2,
    description: "Add resumable migration journals",
    stores: {
      workspaces: WORKSPACE_SCHEMA,
      migrationJournal: MIGRATION_JOURNAL_SCHEMA,
    },
  },
  {
    version: 3,
    description: "Add canonical accounts scoped to workspaces",
    stores: {
      workspaces: WORKSPACE_SCHEMA,
      migrationJournal: MIGRATION_JOURNAL_SCHEMA,
      accounts: ACCOUNT_SCHEMA,
    },
  },
];

export const CURRENT_DATABASE_VERSION =
  DATABASE_MIGRATIONS[DATABASE_MIGRATIONS.length - 1]?.version ?? 0;

export function registerDatabaseMigrations(
  database: Dexie,
  migrations: readonly DatabaseMigration[] = DATABASE_MIGRATIONS,
): void {
  assertMigrationRegistry(migrations);

  for (const migration of migrations) {
    const version = database.version(migration.version).stores(migration.stores);

    if (migration.upgrade !== undefined) {
      version.upgrade(async (transaction) => {
        try {
          await migration.upgrade?.(transaction);
        } catch (error) {
          throw new StorageError("MIGRATION_FAILED", { cause: error });
        }
      });
    }
  }
}

function assertMigrationRegistry(migrations: readonly DatabaseMigration[]): void {
  if (migrations.length === 0) {
    throw new TypeError("The database migration registry must not be empty");
  }

  for (const [index, migration] of migrations.entries()) {
    const expectedVersion = index + 1;

    if (migration.version !== expectedVersion) {
      throw new TypeError(
        `Database migration versions must be contiguous: expected ${expectedVersion}, received ${migration.version}`,
      );
    }

    if (migration.description.trim().length === 0) {
      throw new TypeError(`Database migration ${migration.version} requires a description`);
    }
  }
}
