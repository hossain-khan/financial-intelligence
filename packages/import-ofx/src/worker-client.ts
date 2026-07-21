import type {
  ImportWorkerRequest,
  ImportWorkerResponse,
} from "@financial-intelligence/import-core";

const workerUrl = new URL("../dist/ofx-import-worker.js", import.meta.url);

export function createOfxImportWorker(): Worker {
  return new Worker(workerUrl, { type: "module" });
}

export type { ImportWorkerRequest, ImportWorkerResponse };
