import "fake-indexeddb/auto";

import {
  ApplyWorkspaceRestore,
  PlanWorkspaceRestore,
  type WorkspaceBackupSnapshotSource,
} from "@financial-intelligence/application";
import {
  encryptWorkspaceBackup,
  WORKSPACE_BACKUP_FORMAT,
  WORKSPACE_BACKUP_VERSION,
} from "@financial-intelligence/backup";
import {
  createWorkspace,
  parseUtcTimestamp,
  parseWorkspaceId,
} from "@financial-intelligence/domain";
import { afterEach, describe, expect, it } from "vitest";

import { FinancialDatabase, IndexedDbWorkspaceRepository, openFinancialDatabase } from "./database";
import { IndexedDbRestoreRepository } from "./restore";

const NOW = parseUtcTimestamp("2026-07-20T10:00:00Z");
const PASSPHRASE = "correct horse battery staple";
const WORKSPACE_ID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda999";

afterEach(async () => {
  for (const info of await indexedDB.databases()) {
    if (info.name !== undefined) indexedDB.deleteDatabase(info.name);
  }
});

function sourceSnapshot(name: string): WorkspaceBackupSnapshotSource {
  return {
    format: WORKSPACE_BACKUP_FORMAT,
    version: WORKSPACE_BACKUP_VERSION,
    exportedAt: NOW,
    databaseVersion: 8,
    workspace: {
      id: parseWorkspaceId(WORKSPACE_ID),
      name,
      schemaVersion: 1,
      revision: 2,
      createdAt: NOW,
      updatedAt: NOW,
    },
    accounts: [
      {
        id: "018f6b80-0d62-7d2c-9a5c-7f5f59cda001" as never,
        workspaceId: parseWorkspaceId(WORKSPACE_ID),
        name: "Everyday",
        type: "checking",
        currency: "CAD",
        archived: false,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    imports: [],
    transactions: [],
    categories: [],
    merchants: [],
    classificationRules: [],
    transferDecisions: [],
    recurringDecisions: [],
    transactionOperations: [],
    duplicateResolutionEvents: [],
  };
}

async function encryptedBackup(name: string): Promise<string> {
  return encryptWorkspaceBackup(sourceSnapshot(name), PASSPHRASE, { buildId: "test" });
}

function newDatabase(): FinancialDatabase {
  return new FinancialDatabase(`test-${crypto.randomUUID()}`);
}

describe("IndexedDbRestoreRepository", () => {
  it("restores a backup into a fresh database as a new workspace", async () => {
    const database = newDatabase();
    await openFinancialDatabase(database);
    const repo = new IndexedDbRestoreRepository(database);
    const plan = new PlanWorkspaceRestore(repo);
    const apply = new ApplyWorkspaceRestore(repo);

    const content = await encryptedBackup("Restored household");
    const { plan: restorePlan, snapshot } = await plan.execute(content, PASSPHRASE);
    expect(restorePlan.workspaceExistsLocally).toBe(false);
    expect(restorePlan.preview.workspaceName).toBe("Restored household");

    const result = await apply.execute(snapshot, "restore-as-new");
    expect(result.mode).toBe("restore-as-new");
    expect(result.recordsWritten).toBeGreaterThanOrEqual(1);

    const workspaces = new IndexedDbWorkspaceRepository(database);
    expect(await workspaces.findById(parseWorkspaceId(WORKSPACE_ID))).toMatchObject({
      name: "Restored household",
    });
  }, 20_000);

  it("rejects restore-as-new when the workspace already exists", async () => {
    const database = newDatabase();
    await openFinancialDatabase(database);
    const workspaces = new IndexedDbWorkspaceRepository(database);
    await workspaces.save(
      createWorkspace({ id: parseWorkspaceId(WORKSPACE_ID), name: "Existing", now: NOW }),
    );

    const repo = new IndexedDbRestoreRepository(database);
    const apply = new ApplyWorkspaceRestore(repo);
    const content = await encryptedBackup("Backup");
    const { snapshot } = await new PlanWorkspaceRestore(repo).execute(content, PASSPHRASE);

    await expect(apply.execute(snapshot, "restore-as-new")).rejects.toMatchObject({
      code: "WORKSPACE_EXISTS",
    });
  }, 20_000);

  it("replaces an existing workspace atomically", async () => {
    const database = newDatabase();
    await openFinancialDatabase(database);
    const workspaces = new IndexedDbWorkspaceRepository(database);
    await workspaces.save(
      createWorkspace({ id: parseWorkspaceId(WORKSPACE_ID), name: "Old name", now: NOW }),
    );

    const repo = new IndexedDbRestoreRepository(database);
    const content = await encryptedBackup("New name");
    const { snapshot } = await new PlanWorkspaceRestore(repo).execute(content, PASSPHRASE);
    const result = await new ApplyWorkspaceRestore(repo).execute(snapshot, "replace");
    expect(result.mode).toBe("replace");

    expect(await workspaces.findById(parseWorkspaceId(WORKSPACE_ID))).toMatchObject({
      name: "New name",
    });
  }, 20_000);

  it("fails a wrong passphrase without exposing content", async () => {
    const database = newDatabase();
    await openFinancialDatabase(database);
    const repo = new IndexedDbRestoreRepository(database);
    const content = await encryptedBackup("Secret household");
    const failure = await new PlanWorkspaceRestore(repo)
      .execute(content, "the wrong passphrase entirely")
      .catch((error: unknown) => error);
    expect((failure as { code?: string }).code).toBe("DECRYPTION_FAILED");
    expect(String(failure)).not.toContain("Secret household");
  }, 20_000);

  it("cleans up only abandoned staging databases older than the bounded age", async () => {
    const database = newDatabase();
    await openFinancialDatabase(database);
    // Two stale staging DBs (old timestamp) and one unrelated DB that must be preserved.
    const oldStamp = 1_000;
    await openDb(`financial-intelligence-restore-${oldStamp}-aaaa`);
    await openDb(`financial-intelligence-restore-${oldStamp}-bbbb`);
    await openDb("unrelated-database");

    const repo = new IndexedDbRestoreRepository(database, {
      now: () => oldStamp + 48 * 60 * 60 * 1000,
    });
    const removed = await repo.cleanupAbandonedStaging();
    expect(removed).toBe(2);
    const names = (await indexedDB.databases()).map((info) => info.name);
    expect(names).toContain("unrelated-database");
  }, 20_000);
});

async function openDb(name: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => resolve();
    request.onupgradeneeded = () => undefined;
  });
}
