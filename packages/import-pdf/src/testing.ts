import type { ParseStatementInput } from "@financial-intelligence/import-core";

import { loadHardenedPdfjs } from "./load-pdfjs";
import { PdfStatementParser } from "./parser";
import type { PdfjsModule } from "./pdfjs";

let cached: Promise<PdfjsModule> | undefined;

/** Load the real hardened pdfjs once per test process (legacy build runs under Node/Vitest). */
export function realPdfjs(): Promise<PdfjsModule> {
  cached ??= loadHardenedPdfjs();
  return cached;
}

/** Build a parser input from raw bytes with a deterministic synthetic sha256. */
export function pdfInput(bytes: Uint8Array, fileName = "statement.pdf"): ParseStatementInput {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return {
    metadata: {
      fileName,
      mediaType: "application/pdf",
      byteSize: buffer.byteLength,
      sha256: "0".repeat(64),
    },
    bytes: buffer,
  };
}

/** Parse synthetic bytes through the real PDF.js-backed parser. */
export async function parseWithRealPdfjs(bytes: Uint8Array, fileName?: string) {
  const pdfjs = await realPdfjs();
  const parser = new PdfStatementParser({ pdfjs, now: () => 0 });
  return parser.parse(pdfInput(bytes, fileName), new AbortController().signal);
}
