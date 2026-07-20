import {
  ENCRYPTED_BACKUP_MEDIA_TYPE,
  encryptWorkspaceBackup,
  previewEncryptedWorkspaceBackup,
  type WorkspaceBackupPreview,
  type WorkspaceBackupSnapshot,
} from "@financial-intelligence/backup";
import type { WorkspaceId } from "@financial-intelligence/domain";

import type { ApplicationClock } from "./workspaces";

export interface WorkspaceBackupRepository {
  readSnapshot(workspaceId: WorkspaceId, exportedAt: string): Promise<WorkspaceBackupSnapshot>;
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
  ) {}

  public async execute(
    workspaceId: WorkspaceId,
    passphrase: string,
  ): Promise<EncryptedWorkspaceBackup> {
    const now = this.clock.now();
    const snapshot = await this.repository.readSnapshot(workspaceId, now.toISOString());
    const content = await encryptWorkspaceBackup(snapshot, passphrase);
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
