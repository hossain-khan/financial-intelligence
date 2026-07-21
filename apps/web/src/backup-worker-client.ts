import type { WorkspaceBackupSnapshot } from "@financial-intelligence/backup";

import type { BackupWorkerRequest, BackupWorkerResponse } from "./backup-worker";

/**
 * Run one backup crypto operation in a short-lived dedicated worker, off the main thread. The worker
 * is created per operation and terminated on completion or failure so passphrase-derived key
 * material does not outlive the request. Errors are surfaced as their sanitized code.
 */
/** Distributive omit so each union member keeps its own discriminated fields. */
type WithoutOperationId<T> = T extends unknown ? Omit<T, "operationId"> : never;

function runInWorker(
  request: WithoutOperationId<BackupWorkerRequest>,
): Promise<BackupWorkerResponse> {
  const worker = new Worker(new URL("./backup-worker.ts", import.meta.url), {
    type: "module",
    name: "financial-intelligence-backup",
  });
  const operationId = crypto.randomUUID();
  return new Promise<BackupWorkerResponse>((resolve, reject) => {
    const cleanup = () => worker.terminate();
    worker.addEventListener("error", () => {
      cleanup();
      reject(new Error("The backup worker could not complete the operation."));
    });
    worker.addEventListener("message", (event: MessageEvent<BackupWorkerResponse>) => {
      if (event.data.operationId !== operationId) return;
      cleanup();
      resolve(event.data);
    });
    worker.postMessage({ ...request, operationId } as BackupWorkerRequest);
  });
}

export async function encryptBackupInWorker(
  snapshot: Omit<WorkspaceBackupSnapshot, "manifest">,
  passphrase: string,
  buildId: string,
): Promise<string> {
  const response = await runInWorker({
    protocolVersion: 1,
    type: "encrypt",
    snapshot,
    passphrase,
    buildId,
  });
  if (response.type !== "encrypted")
    throw new Error(response.type === "failed" ? response.errorCode : "BACKUP_FAILED");
  return response.content;
}

export async function decryptBackupInWorker(
  content: string,
  passphrase: string,
): Promise<WorkspaceBackupSnapshot> {
  const response = await runInWorker({ protocolVersion: 1, type: "decrypt", content, passphrase });
  if (response.type !== "decrypted")
    throw new Error(response.type === "failed" ? response.errorCode : "BACKUP_FAILED");
  return response.snapshot;
}
