import type {
  ImportIssue,
  ImportWorkerRequest,
  ImportWorkerResponse,
  SourceFileMetadata,
  SourceRow,
} from "@financial-intelligence/import-core";
import {
  DEFAULT_CSV_LIMITS,
  computeSourceFileMetadata as computeCsvMetadata,
  createCsvImportWorker,
} from "@financial-intelligence/import-csv";
import {
  DEFAULT_OFX_LIMITS,
  computeSourceFileMetadata as computeOfxMetadata,
  createOfxImportWorker,
} from "@financial-intelligence/import-ofx";

const MAX_FILES = 10;

export interface StatementSourceBase {
  readonly metadata: SourceFileMetadata;
  readonly parserId: string;
  readonly parserVersion: string;
  readonly rows: readonly SourceRow[];
  readonly issues: readonly ImportIssue[];
  readonly detectedMetadata: Readonly<Record<string, string | number | boolean>> | undefined;
}

export type StatementSource = StatementSourceBase;

export async function parseStatementFiles(
  files: readonly File[],
  signal?: AbortSignal,
): Promise<readonly StatementSource[]> {
  if (files.length === 0) throw new Error("Choose at least one statement file.");
  if (files.length > MAX_FILES) throw new Error(`Choose no more than ${MAX_FILES} files at once.`);
  const sources: StatementSource[] = [];
  for (const file of files) {
    const kind = classifyFile(file);
    if (kind === "csv") {
      sources.push(await parseCsvFile(file, signal));
    } else if (kind === "ofx") {
      sources.push(await parseOfxFile(file, signal));
    } else {
      throw new Error(
        `${file.name} is not a supported statement format. Choose CSV, OFX, or QFX files.`,
      );
    }
  }
  return sources;
}

export type FileKind = "csv" | "ofx" | "unknown";

export function classifyFile(file: File): FileKind {
  const name = file.name.toLowerCase();
  if (name.endsWith(".ofx") || name.endsWith(".qfx")) return "ofx";
  if (name.endsWith(".csv") || name.endsWith(".tsv")) return "csv";

  const mediaType = file.type.toLowerCase();
  if (
    mediaType === "application/ofx" ||
    mediaType === "application/x-ofx" ||
    mediaType === "application/vnd.intu.qfx" ||
    mediaType === "text/ofx"
  )
    return "ofx";
  if (
    mediaType === "text/csv" ||
    mediaType === "text/tab-separated-values" ||
    mediaType === "text/plain"
  )
    return "csv";

  return "unknown";
}

async function parseCsvFile(file: File, signal?: AbortSignal): Promise<StatementSourceBase> {
  if (file.size > DEFAULT_CSV_LIMITS.maxFileBytes) {
    throw new Error(
      `A selected file exceeds the ${formatBytes(DEFAULT_CSV_LIMITS.maxFileBytes)} limit.`,
    );
  }
  if (signal?.aborted === true) throw new DOMException("Import cancelled", "AbortError");
  const bytes = await file.arrayBuffer();
  const metadata = await computeCsvMetadata({
    fileName: file.name,
    mediaType: file.type || "text/csv",
    bytes,
  });
  const worker = createCsvImportWorker();
  return runWorker<StatementSourceBase>(worker, bytes, metadata, signal, (result) => ({
    metadata,
    parserId: result.parserId,
    parserVersion: result.parserVersion,
    rows: result.rows,
    issues: result.issues,
    detectedMetadata: result.detectedMetadata,
  }));
}

async function parseOfxFile(file: File, signal?: AbortSignal): Promise<StatementSourceBase> {
  if (file.size > DEFAULT_OFX_LIMITS.maxFileBytes) {
    throw new Error(
      `A selected file exceeds the ${formatBytes(DEFAULT_OFX_LIMITS.maxFileBytes)} limit.`,
    );
  }
  if (signal?.aborted === true) throw new DOMException("Import cancelled", "AbortError");
  const bytes = await file.arrayBuffer();
  const metadata = await computeOfxMetadata({
    fileName: file.name,
    mediaType: file.type || "application/ofx",
    bytes,
  });
  const worker = createOfxImportWorker();
  return runWorker<StatementSourceBase>(worker, bytes, metadata, signal, (result) => ({
    metadata,
    parserId: result.parserId,
    parserVersion: result.parserVersion,
    rows: result.rows,
    issues: result.issues,
    detectedMetadata: result.detectedMetadata,
  }));
}

function runWorker<T>(
  worker: Worker,
  bytes: ArrayBuffer,
  metadata: SourceFileMetadata,
  signal: AbortSignal | undefined,
  transform: (result: {
    parserId: string;
    parserVersion: string;
    rows: readonly SourceRow[];
    issues: readonly ImportIssue[];
    detectedMetadata?: Readonly<Record<string, string | number | boolean>>;
  }) => T,
): Promise<T> {
  const operationId = crypto.randomUUID();

  return new Promise<T>((resolve, reject) => {
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
      reject(new Error("The import worker could not process the selected file."));
    });
    worker.addEventListener("message", (event: MessageEvent<ImportWorkerResponse>) => {
      const response = event.data;
      if (response.operationId !== operationId || response.type === "progress") return;
      cleanup();
      if (response.type === "failed") {
        reject(new Error(response.message));
        return;
      }
      resolve(transform(response.result));
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
