import type { EntityTable } from "dexie";

import { normalizeStorageError, StorageError, type StorageErrorCode } from "./errors";

export type MigrationJournalStatus = "running" | "failed" | "completed";

export interface MigrationJournalRecord {
  readonly id: string;
  readonly migrationId: string;
  readonly status: MigrationJournalStatus;
  readonly attempt: number;
  readonly checkpoint?: string;
  readonly errorCode?: StorageErrorCode;
  readonly updatedAt: string;
}

export interface JournaledMigrationContext {
  readonly checkpoint: string | undefined;
  saveCheckpoint(checkpoint: string): Promise<void>;
}

export interface JournaledMigration {
  readonly id: string;
  execute(context: JournaledMigrationContext): Promise<void>;
}

export interface MigrationJournalDatabase {
  readonly migrationJournal: EntityTable<MigrationJournalRecord, "id">;
  transaction<T>(
    mode: "rw",
    table: EntityTable<MigrationJournalRecord, "id">,
    scope: () => Promise<T>,
  ): Promise<T>;
}

export interface MigrationClock {
  now(): Date;
}

export class JournaledMigrationRunner {
  public constructor(
    private readonly database: MigrationJournalDatabase,
    private readonly clock: MigrationClock,
  ) {}

  public async run(migration: JournaledMigration): Promise<void> {
    const previous = await this.database.migrationJournal.get(migration.id);

    if (previous?.status === "completed") {
      return;
    }

    let current = await this.write({
      id: migration.id,
      migrationId: migration.id,
      status: "running",
      attempt: (previous?.attempt ?? 0) + 1,
      ...(previous?.checkpoint === undefined ? {} : { checkpoint: previous.checkpoint }),
      updatedAt: this.clock.now().toISOString(),
    });

    try {
      await migration.execute({
        checkpoint: current.checkpoint,
        saveCheckpoint: async (checkpoint) => {
          current = await this.write({
            ...current,
            status: "running",
            checkpoint,
            updatedAt: this.clock.now().toISOString(),
          });
        },
      });

      await this.write({
        ...current,
        status: "completed",
        updatedAt: this.clock.now().toISOString(),
      });
    } catch (error) {
      const normalized = normalizeStorageError(error);
      try {
        await this.write({
          ...current,
          status: "failed",
          errorCode: normalized.code,
          updatedAt: this.clock.now().toISOString(),
        });
      } catch (journalError) {
        throw new StorageError("MIGRATION_FAILED", {
          cause: normalizeStorageError(journalError),
        });
      }
      throw new StorageError("MIGRATION_FAILED", { cause: normalized });
    }
  }

  private async write(record: MigrationJournalRecord): Promise<MigrationJournalRecord> {
    try {
      await this.database.transaction("rw", this.database.migrationJournal, async () => {
        await this.database.migrationJournal.put(record);
      });
      return record;
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }
}
