import type {
  CsvMappingSource,
  ImportWorkerRequest,
  ImportWorkerResponse,
} from "@financial-intelligence/import-core";
import {
  DEFAULT_CSV_LIMITS,
  computeSourceFileMetadata,
  createCsvImportWorker,
} from "@financial-intelligence/import-csv";

const MAX_FILES = 10;

export async function parseCsvFiles(
  files: readonly File[],
  signal?: AbortSignal,
): Promise<readonly CsvMappingSource[]> {
  if (files.length === 0) throw new Error("Choose at least one CSV file.");
  if (files.length > MAX_FILES) throw new Error(`Choose no more than ${MAX_FILES} files at once.`);
  const sources: CsvMappingSource[] = [];
  for (const file of files) {
    if (file.size > DEFAULT_CSV_LIMITS.maxFileBytes) {
      throw new Error(
        `A selected file exceeds the ${formatBytes(DEFAULT_CSV_LIMITS.maxFileBytes)} limit.`,
      );
    }
    sources.push(await parseCsvFile(file, signal));
  }
  return sources;
}

async function parseCsvFile(file: File, signal?: AbortSignal): Promise<CsvMappingSource> {
  if (signal?.aborted === true) throw new DOMException("Import cancelled", "AbortError");
  const bytes = await file.arrayBuffer();
  const metadata = await computeSourceFileMetadata({
    fileName: file.name,
    mediaType: file.type || "text/csv",
    bytes,
  });
  const worker = createCsvImportWorker();
  const operationId = crypto.randomUUID();

  return new Promise<CsvMappingSource>((resolve, reject) => {
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
      reject(new Error("The CSV worker could not process the selected file."));
    });
    worker.addEventListener("message", (event: MessageEvent<ImportWorkerResponse>) => {
      const response = event.data;
      if (response.operationId !== operationId || response.type === "progress") return;
      cleanup();
      if (response.type === "failed") {
        reject(new Error(response.message));
        return;
      }
      resolve({
        metadata,
        parserId: response.result.parserId,
        parserVersion: response.result.parserVersion,
        rows: response.result.rows,
        issues: response.result.issues,
      });
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
