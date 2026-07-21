import type {
  ImportWorkerRequest,
  ImportWorkerResponse,
  ParseStatementResult,
  SourceFileMetadata,
} from "@financial-intelligence/import-core";
import { computeSourceFileMetadata } from "@financial-intelligence/import-csv";
import { DEFAULT_PDF_LIMITS, createPdfImportWorker } from "@financial-intelligence/import-pdf";

export interface ParsedPdfSource {
  readonly metadata: SourceFileMetadata;
  readonly result: ParseStatementResult;
}

/**
 * Parse a single PDF statement in the dedicated worker. Like OFX, a PDF carries its own account
 * context and only one file is imported at a time; the caller selects the target account.
 */
export async function parsePdfFile(file: File, signal?: AbortSignal): Promise<ParsedPdfSource> {
  if (file.size > DEFAULT_PDF_LIMITS.maxFileBytes) {
    throw new Error(
      `The selected file exceeds the ${formatBytes(DEFAULT_PDF_LIMITS.maxFileBytes)} limit.`,
    );
  }
  if (signal?.aborted === true) throw new DOMException("Import cancelled", "AbortError");
  const bytes = await file.arrayBuffer();
  const metadata = await computeSourceFileMetadata({
    fileName: file.name,
    mediaType: file.type || "application/pdf",
    bytes,
  });
  const worker = createPdfImportWorker();
  const operationId = crypto.randomUUID();

  return new Promise<ParsedPdfSource>((resolve, reject) => {
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
      reject(new Error("The PDF worker could not process the selected file."));
    });
    worker.addEventListener("message", (event: MessageEvent<ImportWorkerResponse>) => {
      const response = event.data;
      if (response.operationId !== operationId || response.type === "progress") return;
      cleanup();
      if (response.type === "failed") {
        reject(new Error(pdfFailureMessage(response.errorCode, response.message)));
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

/** Turn the worker's stable error codes into actionable guidance for unsupported documents. */
function pdfFailureMessage(errorCode: string, fallback: string): string {
  switch (errorCode) {
    case "PASSWORD_PROTECTED":
      return "This PDF is password protected. Remove the password, or export a CSV or OFX statement instead.";
    case "IMAGE_ONLY_DOCUMENT":
      return "This PDF has no selectable text (it looks scanned or image-only). Export a CSV or OFX statement, or a text-based PDF.";
    case "UNSUPPORTED_LAYOUT":
      return "This statement layout is not recognized yet. Export a CSV or OFX statement, or share a synthetic sample to add support.";
    default:
      return fallback;
  }
}

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
