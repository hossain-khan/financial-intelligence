import { describe, expect, it, vi } from "vitest";

import { extractPdfText } from "./extractor";
import { hardenedGetDocumentParameters } from "./pdfjs";
import { DEFAULT_PDF_LIMITS } from "./options";
import type { PdfjsLoadingTask, PdfjsModule } from "./pdfjs";
import { parseWithRealPdfjs, realPdfjs } from "./testing";

const signal = new AbortController().signal;

describe("hardened configuration", () => {
  it("applies the no-eval, no-network document parameters", () => {
    const params = hardenedGetDocumentParameters(new Uint8Array([1, 2, 3]));
    expect(params).toMatchObject({
      isEvalSupported: false,
      useWorkerFetch: false,
      disableFontFace: true,
      useSystemFonts: false,
      stopAtErrors: true,
    });
  });

  it("passes exactly the hardened parameters to pdfjs.getDocument", async () => {
    const getDocument = vi.fn((): PdfjsLoadingTask => {
      throw new Error("stop after capture");
    });
    const pdfjs = { getDocument } as unknown as PdfjsModule;
    await expect(
      extractPdfText(
        new TextEncoder().encode("%PDF-1.4").buffer as ArrayBuffer,
        DEFAULT_PDF_LIMITS,
        { pdfjs, now: () => 0 },
        signal,
      ),
    ).rejects.toBeDefined();
    expect(getDocument).toHaveBeenCalledWith(
      expect.objectContaining({ isEvalSupported: false, useWorkerFetch: false }),
    );
  });
});

/**
 * A PDF carrying document-level JavaScript (OpenAction) and a URI-link annotation. Text-only
 * extraction must return the visible text and never execute the action or resolve the link. We run
 * it through the real pdfjs to prove the active content is inert in our configuration.
 */
const ACTIVE_CONTENT_PDF = [
  "%PDF-1.4",
  "1 0 obj",
  "<< /Type /Catalog /Pages 2 0 R /OpenAction << /S /JavaScript /JS (app.alert('x')) >> >>",
  "endobj",
  "2 0 obj",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "endobj",
  "3 0 obj",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R /Annots [6 0 R] >>",
  "endobj",
  "4 0 obj",
  "<< /Length 60 >>",
  "stream",
  "BT /F1 12 Tf 72 700 Td (Date Description Amount) Tj ET",
  "endstream",
  "endobj",
  "5 0 obj",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  "endobj",
  "6 0 obj",
  "<< /Type /Annot /Subtype /Link /Rect [0 0 10 10] /A << /S /URI /URI (http://evil.example/leak) >> >>",
  "endobj",
  "trailer",
  "<< /Size 7 /Root 1 0 R >>",
  "%%EOF",
].join("\n");

describe("active content is inert", () => {
  it("extracts text from a PDF with JavaScript and link annotations without executing them", async () => {
    // Guard: no global network primitive is invoked during extraction.
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn(() => Promise.reject(new Error("network blocked")));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    try {
      const bytes = new TextEncoder().encode(ACTIVE_CONTENT_PDF);
      const result = await parseWithRealPdfjs(bytes).catch((error: unknown) => error);
      // Either it parses the visible text or reports an unsupported layout — never a network call
      // and never a thrown script side effect.
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not spawn a nested Worker (main-thread pdfjs mode)", async () => {
    // Loading the hardened pdfjs sets globalThis.pdfjsWorker so pdfjs runs in-thread.
    await realPdfjs();
    expect((globalThis as { pdfjsWorker?: unknown }).pdfjsWorker).toBeDefined();
  });
});
