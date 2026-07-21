import { describe, expect, it } from "vitest";

import { PdfImportError } from "./errors";
import { extractPdfText, hasPdfSignature, type ExtractDependencies } from "./extractor";
import { DEFAULT_PDF_LIMITS, type PdfParseLimits } from "./options";
import type {
  PdfjsDocument,
  PdfjsLoadingTask,
  PdfjsModule,
  PdfjsPage,
  PdfjsTextItem,
} from "./pdfjs";

interface FakeDoc {
  readonly pages: readonly (readonly PdfjsTextItem[])[];
  readonly info?: Record<string, unknown>;
  readonly password?: boolean;
  readonly openError?: Error;
}

function fakePdfjs(doc: FakeDoc): { pdfjs: PdfjsModule; destroyed: () => boolean } {
  let destroyed = false;
  class PasswordException extends Error {
    public constructor() {
      super("password");
      this.name = "PasswordException";
    }
  }
  const pdfjs: PdfjsModule = {
    PasswordException,
    getDocument() {
      const task = {
        onPassword: undefined as PdfjsLoadingTask["onPassword"],
        destroy: () => {
          destroyed = true;
          return Promise.resolve();
        },
      } as PdfjsLoadingTask;
      task.promise = (async () => {
        {
          if (doc.openError) throw doc.openError;
          if (doc.password) {
            task.onPassword?.(() => {}, 1);
            throw new PasswordException();
          }
          const document: PdfjsDocument = {
            numPages: doc.pages.length,
            getPage(pageNumber): Promise<PdfjsPage> {
              const items = doc.pages[pageNumber - 1] ?? [];
              const page: PdfjsPage = {
                getViewport: () => ({ width: 612, height: 792 }),
                getTextContent: () => Promise.resolve({ items }),
              };
              return Promise.resolve(page);
            },
            getMetadata: () => Promise.resolve({ info: doc.info ?? {} }),
          };
          return document;
        }
      })();
      return task;
    },
  };
  return { pdfjs, destroyed: () => destroyed };
}

function textItem(str: string, x: number, y: number): PdfjsTextItem {
  return { str, transform: [1, 0, 0, 1, x, y], width: str.length * 5, height: 10 };
}

const signal = new AbortController().signal;
function deps(doc: FakeDoc): ExtractDependencies & { destroyed: () => boolean } {
  const fake = fakePdfjs(doc);
  return { pdfjs: fake.pdfjs, now: () => 0, destroyed: fake.destroyed };
}

describe("hasPdfSignature", () => {
  it("accepts a %PDF- header, with or without a BOM", () => {
    expect(hasPdfSignature(new TextEncoder().encode("%PDF-1.4").buffer as ArrayBuffer)).toBe(true);
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, 0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(hasPdfSignature(withBom.buffer as ArrayBuffer)).toBe(true);
  });

  it("rejects non-PDF content", () => {
    expect(hasPdfSignature(new TextEncoder().encode("not a pdf").buffer as ArrayBuffer)).toBe(
      false,
    );
  });
});

const bytes = new TextEncoder().encode("%PDF-1.4 placeholder").buffer as ArrayBuffer;

describe("extractPdfText", () => {
  it("quantizes coordinates while retaining raw positions", async () => {
    const d = deps({
      pages: [
        [textItem("Hello", 60.7, 700.4), textItem("padding text to clear the floor", 60, 680)],
      ],
    });
    const document = await extractPdfText(bytes, DEFAULT_PDF_LIMITS, d, signal);
    const first = document.pages[0]?.items[0];
    expect(first?.x).toBe(60); // rounded to quantum 2
    expect(first?.rawX).toBeCloseTo(60.7);
    expect(d.destroyed()).toBe(true);
  });

  it("captures bounded producer/creator metadata hints", async () => {
    const d = deps({
      pages: [[textItem("enough visible text to pass the floor", 0, 0)]],
      info: { Producer: "Synthetic Bank Exporter", Creator: "y" },
    });
    const document = await extractPdfText(bytes, DEFAULT_PDF_LIMITS, d, signal);
    expect(document.producer).toBe("Synthetic Bank Exporter");
  });

  it("rejects a password-protected document without retaining a password", async () => {
    const d = deps({ pages: [], password: true });
    await expect(extractPdfText(bytes, DEFAULT_PDF_LIMITS, d, signal)).rejects.toMatchObject({
      code: "PASSWORD_PROTECTED",
    });
    expect(d.destroyed()).toBe(true);
  });

  it("classifies a text-free document as image-only", async () => {
    const d = deps({ pages: [[]] });
    await expect(extractPdfText(bytes, DEFAULT_PDF_LIMITS, d, signal)).rejects.toMatchObject({
      code: "IMAGE_ONLY_DOCUMENT",
    });
  });

  it("enforces the page limit", async () => {
    const limits: PdfParseLimits = { ...DEFAULT_PDF_LIMITS, maxPages: 1 };
    const d = deps({ pages: [[textItem("a", 0, 0)], [textItem("b", 0, 0)]] });
    await expect(extractPdfText(bytes, limits, d, signal)).rejects.toMatchObject({
      code: "PAGE_LIMIT_EXCEEDED",
    });
  });

  it("enforces the per-page text-item limit", async () => {
    const limits: PdfParseLimits = { ...DEFAULT_PDF_LIMITS, maxTextItemsPerPage: 1 };
    const d = deps({ pages: [[textItem("a", 0, 0), textItem("b", 10, 0)]] });
    await expect(extractPdfText(bytes, limits, d, signal)).rejects.toMatchObject({
      code: "TEXT_LIMIT_EXCEEDED",
    });
  });

  it("enforces the total text-character limit", async () => {
    const limits: PdfParseLimits = { ...DEFAULT_PDF_LIMITS, maxTotalTextCharacters: 3 };
    const d = deps({ pages: [[textItem("abcdef", 0, 0)]] });
    await expect(extractPdfText(bytes, limits, d, signal)).rejects.toMatchObject({
      code: "TEXT_LIMIT_EXCEEDED",
    });
  });

  it("maps an invalid-PDF open error to MALFORMED_DOCUMENT", async () => {
    const error = new Error("bad xref");
    error.name = "InvalidPDFException";
    const d = deps({ pages: [], openError: error });
    await expect(extractPdfText(bytes, DEFAULT_PDF_LIMITS, d, signal)).rejects.toMatchObject({
      code: "MALFORMED_DOCUMENT",
    });
  });

  it("throws when cancelled before extraction", async () => {
    const controller = new AbortController();
    controller.abort();
    const d = deps({ pages: [[textItem("a", 0, 0)]] });
    await expect(
      extractPdfText(bytes, DEFAULT_PDF_LIMITS, d, controller.signal),
    ).rejects.toBeInstanceOf(PdfImportError);
  });
});
