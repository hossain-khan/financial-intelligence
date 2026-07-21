import { PdfImportError, throwIfCancelled } from "./errors";
import type { PdfTextDocument, PdfTextItem, PdfTextPage } from "./model";
import type { PdfParseLimits } from "./options";
import {
  hardenedGetDocumentParameters,
  type PdfjsDocument,
  type PdfjsModule,
  type PdfjsTextItem,
} from "./pdfjs";

/** `%PDF-` signature; checked against a bounded prefix before any expensive work. */
const PDF_SIGNATURE = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
const MAX_METADATA_VALUE = 200;

export interface ExtractDependencies {
  readonly pdfjs: PdfjsModule;
  readonly now: () => number;
}

/**
 * Confirm the bytes actually start with a PDF signature. Extension/MIME hints are advisory; a file
 * whose content is not a PDF is rejected rather than handed to PDF.js on faith. A leading UTF-8 BOM
 * is tolerated because some tools prepend one.
 */
export function hasPdfSignature(bytes: ArrayBuffer): boolean {
  const view = new Uint8Array(bytes);
  const offset = view[0] === 0xef && view[1] === 0xbb && view[2] === 0xbf ? 3 : 0;
  if (view.length < offset + PDF_SIGNATURE.length) return false;
  return PDF_SIGNATURE.every((byte, index) => view[offset + index] === byte);
}

/**
 * Open a PDF with the hardened configuration and extract bounded, quantized text pages. Runs PDF.js
 * in whatever thread it is invoked from (the worker binds it to main-thread mode); this function
 * never spawns a worker or performs I/O. A password-protected document is rejected without ever
 * collecting or retaining the password.
 */
export async function extractPdfText(
  bytes: ArrayBuffer,
  limits: PdfParseLimits,
  deps: ExtractDependencies,
  signal: AbortSignal,
): Promise<PdfTextDocument> {
  throwIfCancelled(signal);
  const startedAt = deps.now();

  const task = deps.pdfjs.getDocument(hardenedGetDocumentParameters(new Uint8Array(bytes)));
  // Rejecting the supplied callback with an Error signals "no password available" so PDF.js fails
  // instead of prompting. We never store the reason or accept a password from anywhere.
  task.onPassword = (updatePassword) => {
    updatePassword(new PdfImportError("PASSWORD_PROTECTED", "The PDF is password protected"));
  };

  let document: PdfjsDocument;
  try {
    document = await task.promise;
  } catch (error) {
    await safeDestroy(task);
    throw normalizeOpenError(error, deps.pdfjs);
  }

  try {
    if (document.numPages < 1) {
      throw new PdfImportError("MALFORMED_DOCUMENT", "The PDF contains no pages");
    }
    if (document.numPages > limits.maxPages) {
      throw new PdfImportError(
        "PAGE_LIMIT_EXCEEDED",
        `The PDF exceeds the ${limits.maxPages}-page limit`,
      );
    }

    const metadata = await readMetadata(document);
    const pages: PdfTextPage[] = [];
    let totalCharacters = 0;

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      throwIfCancelled(signal);
      enforceRuntime(startedAt, limits.maxRuntimeMs, deps);
      const page = await extractPage(document, pageNumber, limits, () => totalCharacters);
      totalCharacters += page.characterCount;
      if (totalCharacters > limits.maxTotalTextCharacters) {
        throw new PdfImportError(
          "TEXT_LIMIT_EXCEEDED",
          "The PDF exceeds the total extracted-text limit",
        );
      }
      pages.push(page.page);
    }

    // Image-only / insufficient-text classification: a document whose usable text falls below the
    // floor cannot be parsed as text and is surfaced as image-only rather than silently empty.
    if (totalCharacters < limits.minUsableTextCharacters) {
      throw new PdfImportError(
        "IMAGE_ONLY_DOCUMENT",
        "The PDF has no extractable text; it is likely scanned or image-only",
      );
    }

    return {
      pageCount: pages.length,
      pages,
      textCharacterCount: totalCharacters,
      ...(metadata.producer === undefined ? {} : { producer: metadata.producer }),
      ...(metadata.creator === undefined ? {} : { creator: metadata.creator }),
    };
  } finally {
    await safeDestroy(task);
  }
}

interface ExtractedPage {
  readonly page: PdfTextPage;
  readonly characterCount: number;
}

async function extractPage(
  document: PdfjsDocument,
  pageNumber: number,
  limits: PdfParseLimits,
  totalSoFar: () => number,
): Promise<ExtractedPage> {
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  const rawItems = content.items;
  if (rawItems.length > limits.maxTextItemsPerPage) {
    throw new PdfImportError(
      "TEXT_LIMIT_EXCEEDED",
      `Page ${pageNumber} exceeds the per-page text-item limit`,
    );
  }

  const items: PdfTextItem[] = [];
  let characterCount = 0;
  let runningTotal = totalSoFar();
  for (const raw of rawItems) {
    const item = toTextItem(raw as PdfjsTextItem, limits);
    if (item === undefined) continue;
    items.push(item);
    characterCount += item.text.length;
    runningTotal += item.text.length;
    if (runningTotal > limits.maxTotalTextCharacters) {
      throw new PdfImportError(
        "TEXT_LIMIT_EXCEEDED",
        "The PDF exceeds the total extracted-text limit",
      );
    }
  }

  return {
    page: {
      pageNumber,
      width: finiteOrZero(viewport.width),
      height: finiteOrZero(viewport.height),
      items,
    },
    characterCount,
  };
}

function toTextItem(raw: PdfjsTextItem, limits: PdfParseLimits): PdfTextItem | undefined {
  if (typeof raw.str !== "string" || raw.str.length === 0) return undefined;
  const text = raw.str.length > limits.maxTextItemCharacters ? "" : raw.str;
  if (text.length === 0) return undefined;
  const transform = raw.transform;
  const rawX = finiteOrZero(Array.isArray(transform) ? transform[4] : 0);
  const rawY = finiteOrZero(Array.isArray(transform) ? transform[5] : 0);
  const quantum = limits.coordinateQuantum;
  return {
    text,
    x: Math.round(rawX / quantum) * quantum,
    y: Math.round(rawY / quantum) * quantum,
    width: finiteOrZero(raw.width),
    height: finiteOrZero(raw.height),
    rawX,
    rawY,
  };
}

async function readMetadata(
  document: PdfjsDocument,
): Promise<{ producer?: string; creator?: string }> {
  try {
    const metadata = await document.getMetadata();
    const info = metadata.info ?? {};
    return {
      ...bounded("producer", info.Producer),
      ...bounded("creator", info.Creator),
    };
  } catch {
    // Metadata is an optional detection hint; its absence never fails extraction.
    return {};
  }
}

function bounded(
  key: "producer" | "creator",
  value: unknown,
): { producer?: string } | { creator?: string } | Record<string, never> {
  if (typeof value !== "string" || value.length === 0) return {};
  return { [key]: value.slice(0, MAX_METADATA_VALUE) };
}

function normalizeOpenError(error: unknown, pdfjs: PdfjsModule): PdfImportError {
  if (error instanceof PdfImportError) return error;
  const name = error instanceof Error ? error.name : "";
  const passwordType = pdfjs.PasswordException;
  if (
    name === "PasswordException" ||
    (passwordType !== undefined && error instanceof passwordType)
  ) {
    return new PdfImportError("PASSWORD_PROTECTED", "The PDF is password protected");
  }
  if (name === "InvalidPDFException") {
    return new PdfImportError("MALFORMED_DOCUMENT", "The PDF structure is invalid or corrupt");
  }
  return new PdfImportError("EXTRACTION_FAILED", "The PDF could not be read");
}

function enforceRuntime(startedAt: number, maxRuntimeMs: number, deps: ExtractDependencies): void {
  if (deps.now() - startedAt > maxRuntimeMs) {
    throw new PdfImportError("RUNTIME_LIMIT_EXCEEDED", "PDF extraction exceeded the time limit");
  }
}

async function safeDestroy(task: { destroy(): Promise<void> }): Promise<void> {
  try {
    await task.destroy();
  } catch {
    // Teardown failures are non-fatal; the worker is short-lived and terminated by the caller.
  }
}

function finiteOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
