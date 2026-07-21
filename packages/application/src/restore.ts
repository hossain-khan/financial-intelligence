import {
  decryptWorkspaceBackup,
  previewSnapshot,
  type WorkspaceBackupPreview,
  type WorkspaceBackupSnapshot,
} from "@financial-intelligence/backup";

/**
 * How a validated backup is written into local storage:
 * - `restore-as-new`: write the workspace under its original IDs; fail if that workspace already
 *   exists locally (the user must pick another mode).
 * - `replace`: remove the existing workspace's records and write the backup's in one transaction;
 *   an abort leaves the original intact.
 * - `merge`: write only records whose IDs do not already exist, or that are byte-identical to the
 *   existing record. Any real conflict is surfaced and the merge is rejected (v1 supports only
 *   conflict-free merges).
 */
export type RestoreMode = "restore-as-new" | "replace" | "merge";

export interface RestoreConflict {
  readonly section: string;
  readonly id: string;
  readonly reason: "id-collision" | "divergent-record";
}

export interface RestorePlan {
  readonly preview: WorkspaceBackupPreview;
  readonly workspaceId: string;
  readonly workspaceExistsLocally: boolean;
  /** Conflicts that block a merge; empty for a conflict-free backup. */
  readonly mergeConflicts: readonly RestoreConflict[];
  readonly estimatedBytes: number;
}

export interface RestoreResult {
  readonly mode: RestoreMode;
  readonly workspaceId: string;
  readonly committedRevision: number;
  readonly recordsWritten: number;
}

export class RestoreError extends Error {
  public constructor(
    public readonly code:
      | "DECRYPTION_FAILED"
      | "INVALID_PAYLOAD"
      | "WORKSPACE_EXISTS"
      | "WORKSPACE_MISSING"
      | "MERGE_CONFLICT"
      | "QUOTA_INSUFFICIENT"
      | "STORAGE_FAILURE"
      | "CANCELLED",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "RestoreError";
  }
}

/**
 * The staging + write boundary the application depends on. The implementation (storage-indexeddb)
 * validates the decrypted snapshot in a temporary database, computes conflicts, checks quota, and
 * performs the final atomic write over the primary database.
 */
export interface RestoreRepository {
  /** Whether a workspace with this id already exists in the primary database. */
  workspaceExists(workspaceId: string): Promise<boolean>;
  /** Validate the snapshot in a uniquely-named temporary database and report a conflict plan. */
  stage(snapshot: WorkspaceBackupSnapshot): Promise<{
    readonly mergeConflicts: readonly RestoreConflict[];
    readonly estimatedBytes: number;
  }>;
  /** Apply the staged snapshot atomically in the chosen mode, then clean up staging. */
  apply(snapshot: WorkspaceBackupSnapshot, mode: RestoreMode): Promise<RestoreResult>;
}

/**
 * Decryption boundary so the heavy Argon2id/AES-GCM work can run in a worker. The default decrypts
 * in-process; the web app injects a worker-backed implementation.
 */
export interface BackupDecryptor {
  decrypt(content: string, passphrase: string): Promise<WorkspaceBackupSnapshot>;
}

/** Decrypt + validate a backup and produce a metadata-only plan without writing canonical data. */
export class PlanWorkspaceRestore {
  public constructor(
    private readonly repository: RestoreRepository,
    private readonly decryptor?: BackupDecryptor,
  ) {}

  public async execute(
    content: string,
    passphrase: string,
    options: { readonly crypto?: Crypto } = {},
  ): Promise<{ plan: RestorePlan; snapshot: WorkspaceBackupSnapshot }> {
    const snapshot =
      this.decryptor !== undefined
        ? await this.decryptViaPort(content, passphrase)
        : await decrypt(content, passphrase, options);
    const workspaceId = snapshot.workspace.id;
    const [workspaceExistsLocally, staged] = await Promise.all([
      this.repository.workspaceExists(workspaceId),
      this.repository.stage(snapshot),
    ]);
    return {
      snapshot,
      plan: {
        preview: previewSnapshot(snapshot),
        workspaceId,
        workspaceExistsLocally,
        mergeConflicts: staged.mergeConflicts,
        estimatedBytes: staged.estimatedBytes,
      },
    };
  }

  private async decryptViaPort(
    content: string,
    passphrase: string,
  ): Promise<WorkspaceBackupSnapshot> {
    try {
      return await this.decryptor!.decrypt(content, passphrase);
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "";
      if (code === "DECRYPTION_FAILED") throw new RestoreError("DECRYPTION_FAILED");
      if (code === "RESOURCE_LIMIT") throw new RestoreError("QUOTA_INSUFFICIENT");
      throw new RestoreError("INVALID_PAYLOAD");
    }
  }
}

/** Apply a validated snapshot after the user confirms a mode. Re-checks mode preconditions. */
export class ApplyWorkspaceRestore {
  public constructor(private readonly repository: RestoreRepository) {}

  public async execute(
    snapshot: WorkspaceBackupSnapshot,
    mode: RestoreMode,
  ): Promise<RestoreResult> {
    const exists = await this.repository.workspaceExists(snapshot.workspace.id);
    if (mode === "restore-as-new" && exists) {
      throw new RestoreError("WORKSPACE_EXISTS");
    }
    if (mode === "replace" && !exists) {
      throw new RestoreError("WORKSPACE_MISSING");
    }
    if (mode === "merge") {
      const staged = await this.repository.stage(snapshot);
      if (staged.mergeConflicts.length > 0) {
        throw new RestoreError("MERGE_CONFLICT");
      }
    }
    return this.repository.apply(snapshot, mode);
  }
}

async function decrypt(
  content: string,
  passphrase: string,
  options: { readonly crypto?: Crypto },
): Promise<WorkspaceBackupSnapshot> {
  try {
    return await decryptWorkspaceBackup(content, passphrase, options);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    if (code === "DECRYPTION_FAILED") throw new RestoreError("DECRYPTION_FAILED");
    if (code === "RESOURCE_LIMIT") throw new RestoreError("QUOTA_INSUFFICIENT");
    throw new RestoreError("INVALID_PAYLOAD");
  }
}
