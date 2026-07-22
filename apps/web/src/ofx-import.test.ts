// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import type * as importOfxModule from "@financial-intelligence/import-ofx";
import { DEFAULT_OFX_LIMITS } from "@financial-intelligence/import-ofx";
import { parseOfxFile } from "./ofx-import";

vi.mock("@financial-intelligence/import-ofx", async (importOriginal) => {
  const actual = await importOriginal<typeof importOfxModule>();
  return {
    ...actual,
    createOfxImportWorker: vi.fn(),
  };
});

import { createOfxImportWorker } from "@financial-intelligence/import-ofx";

type EventListenerFn = (event: MessageEvent | ErrorEvent) => void;

function createTestFile(name: string, content: BlobPart, type = "application/x-ofx"): File {
  return new File([content], name, { type });
}

describe("parseOfxFile", () => {
  it("throws when file size exceeds maximum OFX byte limit", async () => {
    const oversizedBuffer = new ArrayBuffer(DEFAULT_OFX_LIMITS.maxFileBytes + 1);
    const oversizedFile = createTestFile("large.ofx", oversizedBuffer);
    await expect(parseOfxFile(oversizedFile)).rejects.toThrow(/exceeds the 16 MB limit/u);
  });

  it("throws AbortError if signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const validFile = createTestFile("sample.ofx", "<OFX></OFX>");
    await expect(parseOfxFile(validFile, controller.signal)).rejects.toThrow("Import cancelled");
  });

  it("successfully parses OFX statement via worker postMessage", async () => {
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
                  parserId: "ofx-parser",
                  parserVersion: "1.0.0",
                  statement: { accountId: "12345", currency: "USD", transactions: [] },
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

    vi.mocked(createOfxImportWorker).mockReturnValue(mockWorker as unknown as Worker);

    const testFile = createTestFile("test.ofx", "<OFX><BANKMSGSRSV1></BANKMSGSRSV1></OFX>");
    const parsed = await parseOfxFile(testFile);

    expect(parsed.result.parserId).toBe("ofx-parser");
    expect(mockWorker.terminate).toHaveBeenCalled();
  });

  it("rejects when worker sends a failed response type", async () => {
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
                message: "Invalid OFX header structure",
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

    vi.mocked(createOfxImportWorker).mockReturnValue(mockWorker as unknown as Worker);

    const testFile = createTestFile("bad.ofx", "invalid content");
    await expect(parseOfxFile(testFile)).rejects.toThrow("Invalid OFX header structure");
    expect(mockWorker.terminate).toHaveBeenCalled();
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

    vi.mocked(createOfxImportWorker).mockReturnValue(mockWorker as unknown as Worker);

    const testFile = createTestFile("err.ofx", "corrupt");
    await expect(parseOfxFile(testFile)).rejects.toThrow(
      "The OFX worker could not process the selected file.",
    );
    expect(mockWorker.terminate).toHaveBeenCalled();
  });
});
