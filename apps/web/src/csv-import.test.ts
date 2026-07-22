// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import type * as importCsvModule from "@financial-intelligence/import-csv";
import { DEFAULT_CSV_LIMITS } from "@financial-intelligence/import-csv";
import { parseCsvFiles } from "./csv-import";

vi.mock("@financial-intelligence/import-csv", async (importOriginal) => {
  const actual = await importOriginal<typeof importCsvModule>();
  return {
    ...actual,
    createCsvImportWorker: vi.fn(),
  };
});

import { createCsvImportWorker } from "@financial-intelligence/import-csv";

type EventListenerFn = (event: MessageEvent | ErrorEvent) => void;

function createFile(name: string, content: BlobPart, type = "text/csv"): File {
  return new File([content], name, { type });
}

describe("parseCsvFiles", () => {
  it("throws when zero files are provided", async () => {
    await expect(parseCsvFiles([])).rejects.toThrow("Choose at least one CSV file.");
  });

  it("throws when more than 10 files are provided", async () => {
    const files = Array.from({ length: 11 }, (_, i) =>
      createFile(`file${i}.csv`, "date,amount\n2024-01-01,10"),
    );
    await expect(parseCsvFiles(files)).rejects.toThrow("Choose no more than 10 files at once.");
  });

  it("throws when a file exceeds the maximum allowed byte size", async () => {
    const oversizedBuffer = new ArrayBuffer(DEFAULT_CSV_LIMITS.maxFileBytes + 1);
    const oversizedFile = createFile("large.csv", oversizedBuffer);
    await expect(parseCsvFiles([oversizedFile])).rejects.toThrow(/exceeds the 16 MB limit/u);
  });

  it("throws an AbortError if signal is pre-aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const validFile = createFile("test.csv", "date,amount\n2024-01-01,10");
    await expect(parseCsvFiles([validFile], controller.signal)).rejects.toThrow("Import cancelled");
  });

  it("successfully parses CSV files via worker postMessage", async () => {
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
                  parserId: "generic-csv",
                  parserVersion: "1.0.0",
                  rows: [["2024-01-01", "10.00", "Coffee"]],
                  issues: [],
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

    vi.mocked(createCsvImportWorker).mockReturnValue(mockWorker as unknown as Worker);

    const testFile = createFile("valid.csv", "Date,Amount,Description\n2024-01-01,10.00,Coffee");
    const result = await parseCsvFiles([testFile]);

    expect(result).toHaveLength(1);
    expect(result[0]?.parserId).toBe("generic-csv");
    expect(result[0]?.rows).toEqual([["2024-01-01", "10.00", "Coffee"]]);
    expect(mockWorker.terminate).toHaveBeenCalled();
  });

  it("rejects when worker returns a failed response type", async () => {
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
                message: "Malformed CSV row structure",
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

    vi.mocked(createCsvImportWorker).mockReturnValue(mockWorker as unknown as Worker);

    const testFile = createFile("bad.csv", "bad data");
    await expect(parseCsvFiles([testFile])).rejects.toThrow("Malformed CSV row structure");
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

    vi.mocked(createCsvImportWorker).mockReturnValue(mockWorker as unknown as Worker);

    const testFile = createFile("error.csv", "date,amount");
    await expect(parseCsvFiles([testFile])).rejects.toThrow(
      "The CSV worker could not process the selected file.",
    );
    expect(mockWorker.terminate).toHaveBeenCalled();
  });
});
