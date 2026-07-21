import {
  buildSnapshotWithManifest,
  encryptWorkspaceBackup,
  webCryptoDigest,
  WORKSPACE_BACKUP_FORMAT,
  WORKSPACE_BACKUP_VERSION,
  type WorkspaceBackupSnapshot,
} from "@financial-intelligence/backup";
import { parseUtcTimestamp, parseWorkspaceId } from "@financial-intelligence/domain";
import { describe, expect, it, vi } from "vitest";

import {
  ApplyWorkspaceRestore,
  PlanWorkspaceRestore,
  type RestoreConflict,
  type RestoreMode,
  type RestoreRepository,
  type RestoreResult,
} from "./restore";

const NOW = parseUtcTimestamp("2026-07-20T10:00:00Z");
const PASSPHRASE = "correct horse battery staple";

const source = {
  format: WORKSPACE_BACKUP_FORMAT as typeof WORKSPACE_BACKUP_FORMAT,
  version: WORKSPACE_BACKUP_VERSION as typeof WORKSPACE_BACKUP_VERSION,
  exportedAt: NOW,
  databaseVersion: 8,
  workspace: {
    id: parseWorkspaceId("018f6b80-0d62-7d2c-9a5c-7f5f59cda999"),
    name: "Plan household",
    schemaVersion: 1 as const,
    revision: 2,
    createdAt: NOW,
    updatedAt: NOW,
  },
  accounts: [],
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

async function encrypted(): Promise<string> {
  return encryptWorkspaceBackup(source, PASSPHRASE, { buildId: "test" });
}

class FakeRepo implements RestoreRepository {
  public applied: { snapshot: WorkspaceBackupSnapshot; mode: RestoreMode } | undefined;
  public constructor(
    private readonly options: {
      exists?: boolean;
      conflicts?: readonly RestoreConflict[];
    } = {},
  ) {}
  public async workspaceExists(): Promise<boolean> {
    return this.options.exists ?? false;
  }
  public async stage(): Promise<{
    readonly mergeConflicts: readonly RestoreConflict[];
    readonly estimatedBytes: number;
  }> {
    return { mergeConflicts: this.options.conflicts ?? [], estimatedBytes: 1024 };
  }
  public async apply(snapshot: WorkspaceBackupSnapshot, mode: RestoreMode): Promise<RestoreResult> {
    this.applied = { snapshot, mode };
    return { mode, workspaceId: snapshot.workspace.id, committedRevision: 2, recordsWritten: 1 };
  }
}

describe("PlanWorkspaceRestore", () => {
  it("produces a metadata-only plan from a valid backup", async () => {
    const repo = new FakeRepo({ exists: true });
    const { plan } = await new PlanWorkspaceRestore(repo).execute(await encrypted(), PASSPHRASE);
    expect(plan.preview.workspaceName).toBe("Plan household");
    expect(plan.workspaceExistsLocally).toBe(true);
    expect(plan.mergeConflicts).toEqual([]);
  }, 20_000);

  it("maps a wrong passphrase to a generic decryption failure", async () => {
    const repo = new FakeRepo();
    await expect(
      new PlanWorkspaceRestore(repo).execute(await encrypted(), "wrong passphrase value"),
    ).rejects.toMatchObject({ code: "DECRYPTION_FAILED" });
  }, 20_000);
});

describe("ApplyWorkspaceRestore", () => {
  async function snapshot(): Promise<WorkspaceBackupSnapshot> {
    return buildSnapshotWithManifest(source, { buildId: "test" }, (bytes) =>
      webCryptoDigest(bytes, crypto),
    );
  }

  it("rejects restore-as-new when the workspace already exists", async () => {
    const repo = new FakeRepo({ exists: true });
    await expect(
      new ApplyWorkspaceRestore(repo).execute(await snapshot(), "restore-as-new"),
    ).rejects.toMatchObject({ code: "WORKSPACE_EXISTS" });
  });

  it("rejects replace when there is no existing workspace", async () => {
    const repo = new FakeRepo({ exists: false });
    await expect(
      new ApplyWorkspaceRestore(repo).execute(await snapshot(), "replace"),
    ).rejects.toMatchObject({ code: "WORKSPACE_MISSING" });
  });

  it("rejects a merge that has conflicts and never calls apply", async () => {
    const repo = new FakeRepo({
      exists: true,
      conflicts: [{ section: "accounts", id: "a", reason: "divergent-record" }],
    });
    const applySpy = vi.spyOn(repo, "apply");
    await expect(
      new ApplyWorkspaceRestore(repo).execute(await snapshot(), "merge"),
    ).rejects.toMatchObject({ code: "MERGE_CONFLICT" });
    expect(applySpy).not.toHaveBeenCalled();
  });

  it("applies a conflict-free merge", async () => {
    const repo = new FakeRepo({ exists: true, conflicts: [] });
    const result = await new ApplyWorkspaceRestore(repo).execute(await snapshot(), "merge");
    expect(result.mode).toBe("merge");
    expect(repo.applied?.mode).toBe("merge");
  });
});
