import {
  ENCRYPTED_BACKUP_MEDIA_TYPE,
  encryptWorkspaceBackup,
  previewEncryptedWorkspaceBackup,
  type WorkspaceBackupPreview,
  type WorkspaceBackupSnapshot,
} from "@financial-intelligence/backup";
import type { WorkspaceId } from "@financial-intelligence/domain";

import type { ApplicationClock } from "./workspaces";

/** The repository reads the raw sections; the authenticated manifest is built during encryption. */
export type WorkspaceBackupSnapshotSource = Omit<WorkspaceBackupSnapshot, "manifest">;

/**
 * Encryption boundary so the heavy Argon2id/AES-GCM work can run in a worker. The default runs the
 * pure `encryptWorkspaceBackup` in-process; the web app injects a worker-backed implementation.
 */
export interface BackupEncryptor {
  encrypt(snapshot: WorkspaceBackupSnapshotSource, passphrase: string): Promise<string>;
}

export interface WorkspaceBackupRepository {
  readSnapshot(
    workspaceId: WorkspaceId,
    exportedAt: string,
  ): Promise<WorkspaceBackupSnapshotSource>;
}

export interface EncryptedWorkspaceBackup {
  readonly content: string;
  readonly fileName: string;
  readonly mediaType: typeof ENCRYPTED_BACKUP_MEDIA_TYPE;
}

export class CreateEncryptedWorkspaceBackup {
  public constructor(
    private readonly repository: WorkspaceBackupRepository,
    private readonly clock: ApplicationClock,
    private readonly buildId: string = "unknown",
    private readonly encryptor?: BackupEncryptor,
  ) {}

  public async execute(
    workspaceId: WorkspaceId,
    passphrase: string,
  ): Promise<EncryptedWorkspaceBackup> {
    const now = this.clock.now();
    const snapshot = await this.repository.readSnapshot(workspaceId, now.toISOString());
    const content =
      this.encryptor !== undefined
        ? await this.encryptor.encrypt(snapshot, passphrase)
        : await encryptWorkspaceBackup(snapshot, passphrase, { buildId: this.buildId });
    const date = now.toISOString().slice(0, 10);
    const safeName =
      snapshot.workspace.name
        .normalize("NFKD")
        .replaceAll(/[^a-zA-Z0-9]+/gu, "-")
        .replaceAll(/^-|-$/gu, "")
        .slice(0, 60)
        .toLowerCase() || "workspace";
    return {
      content,
      fileName: `${safeName}-${date}.fintbackup`,
      mediaType: ENCRYPTED_BACKUP_MEDIA_TYPE,
    };
  }
}

/** Decrypts and validates in memory, returning metadata only. It has no write dependency. */
export class PreviewEncryptedWorkspaceBackup {
  public async execute(content: string, passphrase: string): Promise<WorkspaceBackupPreview> {
    return previewEncryptedWorkspaceBackup(content, passphrase);
  }
}
