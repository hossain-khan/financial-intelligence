import type {
  ImportWorkerRequest,
  ImportWorkerResponse,
  ParseStatementResult,
  SourceFileMetadata,
} from "@financial-intelligence/import-core";
import { computeSourceFileMetadata } from "@financial-intelligence/import-csv";
import { DEFAULT_OFX_LIMITS, createOfxImportWorker } from "@financial-intelligence/import-ofx";

export interface ParsedOfxSource {
  readonly metadata: SourceFileMetadata;
  readonly result: ParseStatementResult;
}

/**
 * Parse a single OFX/QFX file in the dedicated worker. OFX carries its own account and currency,
 * so — unlike CSV — only one file is imported at a time; the caller selects the target account.
 */
export async function parseOfxFile(file: File, signal?: AbortSignal): Promise<ParsedOfxSource> {
  if (file.size > DEFAULT_OFX_LIMITS.maxFileBytes) {
    throw new Error(
      `The selected file exceeds the ${formatBytes(DEFAULT_OFX_LIMITS.maxFileBytes)} limit.`,
    );
  }
  if (signal?.aborted === true) throw new DOMException("Import cancelled", "AbortError");
  const bytes = await file.arrayBuffer();
  const metadata = await computeSourceFileMetadata({
    fileName: file.name,
    mediaType: file.type || "application/x-ofx",
    bytes,
  });
  const worker = createOfxImportWorker();
  const operationId = crypto.randomUUID();

  return new Promise<ParsedOfxSource>((resolve, reject) => {
    const cleanup = () => {
      signal?.removeEventListener("abort", cancel);
      worker.terminate();
    };
    const cancel = () => {
      const request: ImportWorkerRequest = { protocolVersion: 1, type: "cancel", operationId };
      worker.postMessage(request);
      cleanup();
      reject(new DOMException("Import cancelled", "AbortError"));
    };
    worker.addEventListener("error", () => {
      cleanup();
      reject(new Error("The OFX worker could not process the selected file."));
    });
    worker.addEventListener("message", (event: MessageEvent<ImportWorkerResponse>) => {
      const response = event.data;
      if (response.operationId !== operationId || response.type === "progress") return;
      cleanup();
      if (response.type === "failed") {
        reject(new Error(response.message));
        return;
      }
      resolve({ metadata, result: response.result });
    });
    signal?.addEventListener("abort", cancel, { once: true });
    const request: ImportWorkerRequest = {
      protocolVersion: 1,
      type: "parse",
      operationId,
      input: { metadata, bytes },
    };
    worker.postMessage(request, [bytes]);
  });
}

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
