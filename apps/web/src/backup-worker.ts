/// <reference lib="webworker" />

import {
  decryptWorkspaceBackup,
  encryptWorkspaceBackup,
  EncryptedBackupError,
  type WorkspaceBackupSnapshot,
} from "@financial-intelligence/backup";

/**
 * Bounded, versioned worker protocol for backup cryptography. The heavy Argon2id derivation and
 * AES-GCM work run here, off the main thread. Passphrases and plaintext live only for the duration
 * of a request and are never logged, persisted, or echoed back — only the ciphertext string, the
 * validated snapshot, or a sanitized error code crosses the boundary.
 */
export type BackupWorkerRequest =
  | {
      readonly protocolVersion: 1;
      readonly type: "encrypt";
      readonly operationId: string;
      readonly snapshot: Omit<WorkspaceBackupSnapshot, "manifest">;
      readonly passphrase: string;
      readonly buildId: string;
    }
  | {
      readonly protocolVersion: 1;
      readonly type: "decrypt";
      readonly operationId: string;
      readonly content: string;
      readonly passphrase: string;
    };

export type BackupWorkerResponse =
  | {
      readonly protocolVersion: 1;
      readonly type: "encrypted";
      readonly operationId: string;
      readonly content: string;
    }
  | {
      readonly protocolVersion: 1;
      readonly type: "decrypted";
      readonly operationId: string;
      readonly snapshot: WorkspaceBackupSnapshot;
    }
  | {
      readonly protocolVersion: 1;
      readonly type: "failed";
      readonly operationId: string;
      readonly errorCode: string;
    };

async function handle(request: BackupWorkerRequest): Promise<BackupWorkerResponse> {
  try {
    if (request.type === "encrypt") {
      const content = await encryptWorkspaceBackup(request.snapshot, request.passphrase, {
        buildId: request.buildId,
      });
      return { protocolVersion: 1, type: "encrypted", operationId: request.operationId, content };
    }
    const snapshot = await decryptWorkspaceBackup(request.content, request.passphrase);
    return { protocolVersion: 1, type: "decrypted", operationId: request.operationId, snapshot };
  } catch (error) {
    const errorCode = error instanceof EncryptedBackupError ? error.code : "BACKUP_FAILED";
    return { protocolVersion: 1, type: "failed", operationId: request.operationId, errorCode };
  }
}

self.addEventListener("message", (event: MessageEvent<BackupWorkerRequest>) => {
  const request = event.data;
  if (request?.protocolVersion !== 1) return;
  void handle(request).then((response) => self.postMessage(response));
});
