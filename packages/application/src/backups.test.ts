import { describe, expect, it } from "vitest";

import type { WorkspaceBackupSnapshot } from "@financial-intelligence/backup";
import {
  ENCRYPTED_BACKUP_MEDIA_TYPE,
  encryptWorkspaceBackup,
  WORKSPACE_BACKUP_FORMAT,
  WORKSPACE_BACKUP_VERSION,
} from "@financial-intelligence/backup";
import { parseUtcTimestamp, parseWorkspaceId } from "@financial-intelligence/domain";

import type { ApplicationClock } from "./workspaces";
import type { WorkspaceBackupRepository } from "./backups";
import { CreateEncryptedWorkspaceBackup, PreviewEncryptedWorkspaceBackup } from "./backups";

const NOW = parseUtcTimestamp("2026-07-20T10:00:00Z");
const WORKSPACE_ID = parseWorkspaceId("018f6b80-0d62-7d2c-9a5c-7f5f59cda999");

class FixedClock implements ApplicationClock {
  public now() {
    return new Date(NOW);
  }
}

const mockSnapshot: WorkspaceBackupSnapshot = {
  format: WORKSPACE_BACKUP_FORMAT,
  version: WORKSPACE_BACKUP_VERSION,
  exportedAt: "2026-07-20T10:00:00Z",
  databaseVersion: 8,
  workspace: {
    id: WORKSPACE_ID,
    name: "Personal Finance & Savings!",
    schemaVersion: 1,
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
  accounts: [],
  categories: [],
  transactions: [],
  duplicateResolutionEvents: [],
  imports: [],
  transactionOperations: [],
};

class MockBackupRepo implements WorkspaceBackupRepository {
  public async readSnapshot(): Promise<WorkspaceBackupSnapshot> {
    return mockSnapshot;
  }
}

describe("Backups application use cases", () => {
  it("creates encrypted backup with sanitized filename", async () => {
    const repo = new MockBackupRepo();
    const clock = new FixedClock();
    const createBackup = new CreateEncryptedWorkspaceBackup(repo, clock);

    const backup = await createBackup.execute(WORKSPACE_ID, "secret-passphrase");
    expect(backup.mediaType).toBe(ENCRYPTED_BACKUP_MEDIA_TYPE);
    expect(backup.fileName).toBe("personal-finance-savings-2026-07-20.fintbackup");
    expect(backup.content).toBeDefined();
  });

  it("previews encrypted backup metadata", async () => {
    const encryptedContent = await encryptWorkspaceBackup(mockSnapshot, "secret-passphrase");
    const previewBackup = new PreviewEncryptedWorkspaceBackup();

    const preview = await previewBackup.execute(encryptedContent, "secret-passphrase");
    expect(preview.workspaceName).toBe("Personal Finance & Savings!");
    expect(preview.counts.transactions).toBe(0);
  });
});
