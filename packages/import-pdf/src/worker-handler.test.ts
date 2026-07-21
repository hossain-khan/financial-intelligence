import type {
  ImportWorkerResponse,
  ParseStatementInput,
  ParseStatementResult,
  StatementParser,
} from "@financial-intelligence/import-core";
import { describe, expect, it, vi } from "vitest";

import { PdfImportError } from "./errors";
import { createPdfImportWorkerHandler } from "./worker-handler";

function input(): ParseStatementInput {
  return {
    metadata: {
      fileName: "s.pdf",
      mediaType: "application/pdf",
      byteSize: 4,
      sha256: "c".repeat(64),
    },
    bytes: new TextEncoder().encode("%PDF").buffer as ArrayBuffer,
  };
}

function collector() {
  const messages: ImportWorkerResponse[] = [];
  return { postMessage: (m: ImportWorkerResponse) => messages.push(m), messages };
}

const emptyResult: ParseStatementResult = {
  parserId: "pdf",
  parserVersion: "1.0.0",
  rows: [],
  issues: [],
};

function parserThatResolves(): StatementParser {
  return {
    id: "pdf",
    version: "1.0.0",
    supports: () => true,
    parse: () => Promise.resolve(emptyResult),
  };
}

describe("createPdfImportWorkerHandler", () => {
  it("completes a valid parse", async () => {
    const target = collector();
    const handler = createPdfImportWorkerHandler(target, () => parserThatResolves());
    await handler({ protocolVersion: 1, type: "parse", operationId: "op1", input: input() });
    expect(target.messages.at(-1)).toMatchObject({ type: "completed", operationId: "op1" });
  });

  it("lazily builds the parser only once", async () => {
    const factory = vi.fn(() => parserThatResolves());
    const target = collector();
    const handler = createPdfImportWorkerHandler(target, factory);
    await handler({ protocolVersion: 1, type: "parse", operationId: "op1", input: input() });
    await handler({ protocolVersion: 1, type: "parse", operationId: "op2", input: input() });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("rejects an unsupported protocol version", async () => {
    const target = collector();
    const handler = createPdfImportWorkerHandler(target, () => parserThatResolves());
    await handler({ protocolVersion: 2, type: "parse", operationId: "op1", input: input() });
    expect(target.messages[0]).toMatchObject({
      type: "failed",
      errorCode: "UNSUPPORTED_PROTOCOL_VERSION",
    });
  });

  it("rejects an invalid parse request", async () => {
    const target = collector();
    const handler = createPdfImportWorkerHandler(target, () => parserThatResolves());
    await handler({ protocolVersion: 1, type: "parse", operationId: "op1", input: {} });
    expect(target.messages[0]).toMatchObject({ type: "failed", errorCode: "INVALID_REQUEST" });
  });

  it("reports cancellation for an unknown operation", async () => {
    const target = collector();
    const handler = createPdfImportWorkerHandler(target, () => parserThatResolves());
    await handler({ protocolVersion: 1, type: "cancel", operationId: "nope" });
    expect(target.messages[0]).toMatchObject({ type: "failed", errorCode: "OPERATION_NOT_FOUND" });
  });

  it("maps a PdfImportError to its stable code", async () => {
    const parser: StatementParser = {
      id: "pdf",
      version: "1.0.0",
      supports: () => true,
      parse: () => Promise.reject(new PdfImportError("PASSWORD_PROTECTED", "nope")),
    };
    const target = collector();
    const handler = createPdfImportWorkerHandler(target, () => parser);
    await handler({ protocolVersion: 1, type: "parse", operationId: "op1", input: input() });
    expect(target.messages.at(-1)).toMatchObject({
      type: "failed",
      errorCode: "PASSWORD_PROTECTED",
    });
  });

  it("normalizes an unknown error to PARSE_FAILED", async () => {
    const parser: StatementParser = {
      id: "pdf",
      version: "1.0.0",
      supports: () => true,
      parse: () => Promise.reject(new Error("boom")),
    };
    const target = collector();
    const handler = createPdfImportWorkerHandler(target, () => parser);
    await handler({ protocolVersion: 1, type: "parse", operationId: "op1", input: input() });
    expect(target.messages.at(-1)).toMatchObject({ type: "failed", errorCode: "PARSE_FAILED" });
  });
});
