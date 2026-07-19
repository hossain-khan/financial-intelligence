import "fake-indexeddb/auto";

import Dexie from "dexie";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinancialDatabase, openFinancialDatabase } from "./database";
import { JournaledMigrationRunner } from "./migration-journal";

const databases: FinancialDatabase[] = [];
const NOW = new Date("2026-07-19T16:00:00.000Z");

afterEach(async () => {
  await Promise.all(
    databases.splice(0).map(async (database) => {
      const name = database.name;
      database.close();
      await Dexie.delete(name);
    }),
  );
});

describe("JournaledMigrationRunner", () => {
  it("records a checkpoint and deterministically resumes a failed low-quota migration", async () => {
    const database = await testDatabase();
    const runner = new JournaledMigrationRunner(database, { now: () => NOW });
    const firstExecute = vi.fn(async ({ saveCheckpoint }) => {
      await saveCheckpoint("derived-index-built");
      throw new DOMException("Synthetic quota pressure", "QuotaExceededError");
    });

    await expect(
      runner.run({ id: "rebuild-search-v1", execute: firstExecute }),
    ).rejects.toMatchObject({ code: "MIGRATION_FAILED" });
    expect(await database.migrationJournal.get("rebuild-search-v1")).toMatchObject({
      status: "failed",
      attempt: 1,
      checkpoint: "derived-index-built",
      errorCode: "QUOTA_EXCEEDED",
    });

    const resumedExecute = vi.fn(async ({ checkpoint }) => {
      expect(checkpoint).toBe("derived-index-built");
    });
    await runner.run({ id: "rebuild-search-v1", execute: resumedExecute });

    expect(resumedExecute).toHaveBeenCalledOnce();
    expect(await database.migrationJournal.get("rebuild-search-v1")).toMatchObject({
      status: "completed",
      attempt: 2,
      checkpoint: "derived-index-built",
    });
  });

  it("does not rerun a completed migration", async () => {
    const database = await testDatabase();
    const runner = new JournaledMigrationRunner(database, { now: () => NOW });
    const execute = vi.fn(async () => undefined);
    const migration = { id: "completed-once", execute };

    await runner.run(migration);
    await runner.run(migration);

    expect(execute).toHaveBeenCalledOnce();
  });
});

async function testDatabase(): Promise<FinancialDatabase> {
  const database = new FinancialDatabase(`journal-test-${crypto.randomUUID()}`);
  databases.push(database);
  return openFinancialDatabase(database);
}
