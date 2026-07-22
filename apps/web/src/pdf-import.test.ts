// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import type * as importPdfModule from "@financial-intelligence/import-pdf";
import { DEFAULT_PDF_LIMITS } from "@financial-intelligence/import-pdf";
import { parsePdfFile } from "./pdf-import";

vi.mock("@financial-intelligence/import-pdf", async (importOriginal) => {
  const actual = await importOriginal<typeof importPdfModule>();
  return {
    ...actual,
    createPdfImportWorker: vi.fn(),
  };
});

import { createPdfImportWorker } from "@financial-intelligence/import-pdf";

type EventListenerFn = (event: MessageEvent | ErrorEvent) => void;

function createTestFile(name: string, content: BlobPart, type = "application/pdf"): File {
  return new File([content], name, { type });
}

describe("parsePdfFile", () => {
  it("throws when file size exceeds maximum PDF byte limit", async () => {
    const oversizedBuffer = new ArrayBuffer(DEFAULT_PDF_LIMITS.maxFileBytes + 1);
    const oversizedFile = createTestFile("large.pdf", oversizedBuffer);
    await expect(parsePdfFile(oversizedFile)).rejects.toThrow(/exceeds the 16 MB limit/u);
  });

  it("throws AbortError if signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const validFile = createTestFile("sample.pdf", "%PDF-1.4");
    await expect(parsePdfFile(validFile, controller.signal)).rejects.toThrow("Import cancelled");
  });

  it("successfully parses PDF statement via worker postMessage", async () => {
    const listeners: Record<string, EventListenerFn[]> = {};
    const mockWorker = {
      postMessage: vi.fn((request) => {
        if (request.type === "parse") {
          const handler = listeners["message"]?.[0];
          if (handler) {
            handler({
              data: {
                protocolVersion: 1,
                type: "success",
                operationId: request.operationId,
                result: {
                  parserId: "generic-pdf",
                  parserVersion: "1.0.0",
                  statement: { accountId: "acc-1", currency: "USD", transactions: [] },
                },
              },
            } as MessageEvent);
          }
        }
      }),
      addEventListener: vi.fn((event: string, fn: EventListenerFn) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(fn);
      }),
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    };

    vi.mocked(createPdfImportWorker).mockReturnValue(mockWorker as unknown as Worker);

    const testFile = createTestFile("test.pdf", "%PDF-1.4 content");
    const parsed = await parsePdfFile(testFile);

    expect(parsed.result.parserId).toBe("generic-pdf");
    expect(mockWorker.terminate).toHaveBeenCalled();
  });

  it("transforms PASSWORD_PROTECTED error code into user-friendly message", async () => {
    const listeners: Record<string, EventListenerFn[]> = {};
    const mockWorker = {
      postMessage: vi.fn((request) => {
        if (request.type === "parse") {
          const handler = listeners["message"]?.[0];
          if (handler) {
            handler({
              data: {
                protocolVersion: 1,
                type: "failed",
                operationId: request.operationId,
                errorCode: "PASSWORD_PROTECTED",
                message: "Protected",
              },
            } as MessageEvent);
          }
        }
      }),
      addEventListener: vi.fn((event: string, fn: EventListenerFn) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(fn);
      }),
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    };

    vi.mocked(createPdfImportWorker).mockReturnValue(mockWorker as unknown as Worker);

    const testFile = createTestFile("locked.pdf", "%PDF-1.4");
    await expect(parsePdfFile(testFile)).rejects.toThrow(/password protected/u);
    expect(mockWorker.terminate).toHaveBeenCalled();
  });

  it("transforms IMAGE_ONLY_DOCUMENT error code into user-friendly message", async () => {
    const listeners: Record<string, EventListenerFn[]> = {};
    const mockWorker = {
      postMessage: vi.fn((request) => {
        if (request.type === "parse") {
          const handler = listeners["message"]?.[0];
          if (handler) {
            handler({
              data: {
                protocolVersion: 1,
                type: "failed",
                operationId: request.operationId,
                errorCode: "IMAGE_ONLY_DOCUMENT",
                message: "Scanned",
              },
            } as MessageEvent);
          }
        }
      }),
      addEventListener: vi.fn((event: string, fn: EventListenerFn) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(fn);
      }),
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    };

    vi.mocked(createPdfImportWorker).mockReturnValue(mockWorker as unknown as Worker);

    const testFile = createTestFile("scanned.pdf", "%PDF-1.4");
    await expect(parsePdfFile(testFile)).rejects.toThrow(/no selectable text/u);
  });

  it("transforms UNSUPPORTED_LAYOUT error code into user-friendly message", async () => {
    const listeners: Record<string, EventListenerFn[]> = {};
    const mockWorker = {
      postMessage: vi.fn((request) => {
        if (request.type === "parse") {
          const handler = listeners["message"]?.[0];
          if (handler) {
            handler({
              data: {
                protocolVersion: 1,
                type: "failed",
                operationId: request.operationId,
                errorCode: "UNSUPPORTED_LAYOUT",
                message: "Unknown layout",
              },
            } as MessageEvent);
          }
        }
      }),
      addEventListener: vi.fn((event: string, fn: EventListenerFn) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(fn);
      }),
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    };

    vi.mocked(createPdfImportWorker).mockReturnValue(mockWorker as unknown as Worker);

    const testFile = createTestFile("unknown.pdf", "%PDF-1.4");
    await expect(parsePdfFile(testFile)).rejects.toThrow(/layout is not recognized/u);
  });

  it("rejects when worker fires an error event", async () => {
    const listeners: Record<string, EventListenerFn[]> = {};
    const mockWorker = {
      postMessage: vi.fn((request) => {
        if (request.type === "parse") {
          const handler = listeners["error"]?.[0];
          if (handler) {
            handler(new ErrorEvent("error"));
          }
        }
      }),
      addEventListener: vi.fn((event: string, fn: EventListenerFn) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(fn);
      }),
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    };

    vi.mocked(createPdfImportWorker).mockReturnValue(mockWorker as unknown as Worker);

    const testFile = createTestFile("corrupt.pdf", "invalid");
    await expect(parsePdfFile(testFile)).rejects.toThrow(
      "The PDF worker could not process the selected file.",
    );
    expect(mockWorker.terminate).toHaveBeenCalled();
  });
});
