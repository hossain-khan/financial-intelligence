import type {
  ImportWorkerRequest,
  ImportWorkerResponse,
  ParseStatementResult,
} from "@financial-intelligence/import-core";
import { describe, expect, it, vi } from "vitest";

import { createOfxImportWorkerHandler } from "./worker-handler";

interface FakeTarget {
  messages: ImportWorkerResponse[];
  postMessage(response: ImportWorkerResponse): void;
}

function createFakeTarget(): FakeTarget {
  return {
    messages: [],
    postMessage(response) {
      this.messages.push(response);
    },
  };
}

function parseRequest(bytes: ArrayBuffer): ImportWorkerRequest {
  return {
    protocolVersion: 1,
    type: "parse",
    operationId: "op-1",
    input: {
      metadata: {
        fileName: "test.ofx",
        mediaType: "application/ofx",
        byteSize: bytes.byteLength,
        sha256: "a".repeat(64),
      },
      bytes,
    },
  };
}

const validOfx = new TextEncoder().encode(
  `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>CAD</CURDEF><BANKACCTFROM><ACCTID>1234</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260718000000</DTPOSTED><TRNAMT>-5.00</TRNAMT><FITID>1</FITID><NAME>COFFEE</NAME></STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`,
);

describe("createOfxImportWorkerHandler", () => {
  it("parses a valid OFX file and returns a completed response", async () => {
    const target = createFakeTarget();
    const handler = createOfxImportWorkerHandler(target);
    await handler(parseRequest(validOfx.buffer));

    const completed = target.messages.find((message) => message.type === "completed");
    expect(completed?.type).toBe("completed");
    if (completed?.type === "completed") {
      expect(completed.result.parserId).toBe("financial-intelligence/ofx");
      expect(completed.result.rows).toHaveLength(1);
    }
  });

  it("reports progress during parsing", async () => {
    const target = createFakeTarget();
    const handler = createOfxImportWorkerHandler(target);
    await handler(parseRequest(validOfx.buffer));

    expect(target.messages.some((message) => message.type === "progress")).toBe(true);
  });

  it("cancels an active parse operation", async () => {
    const target = createFakeTarget();
    const handler = createOfxImportWorkerHandler(target);
    const parsePromise = handler(parseRequest(validOfx.buffer));
    await handler({ protocolVersion: 1, type: "cancel", operationId: "op-1" });
    await parsePromise;

    const failed = target.messages.find((message) => message.type === "failed");
    expect(failed?.type === "failed" && failed.errorCode === "CANCELLED").toBe(true);
  });

  it("rejects an unsupported protocol version", async () => {
    const target = createFakeTarget();
    const handler = createOfxImportWorkerHandler(target);
    await handler({ protocolVersion: 2, type: "parse", operationId: "op-1", input: {} as never });

    const failed = target.messages.find((message) => message.type === "failed");
    expect(failed?.type === "failed" && failed.errorCode === "UNSUPPORTED_PROTOCOL_VERSION").toBe(
      true,
    );
  });

  it("rejects an invalid parse request", async () => {
    const target = createFakeTarget();
    const handler = createOfxImportWorkerHandler(target);
    await handler({
      protocolVersion: 1,
      type: "parse",
      operationId: "op-1",
      input: { metadata: {}, bytes: new ArrayBuffer(0) },
    });

    const failed = target.messages.find((message) => message.type === "failed");
    expect(failed?.type === "failed" && failed.errorCode === "INVALID_REQUEST").toBe(true);
  });

  it("rejects duplicate active operations", async () => {
    const target = createFakeTarget();
    const slowResult: ParseStatementResult = {
      parserId: "test",
      parserVersion: "1",
      rows: [],
      issues: [],
    };
    const slow = vi.fn(
      async () =>
        new Promise<ParseStatementResult>((resolve) => setTimeout(resolve, 100, slowResult)),
    );
    const custom = createOfxImportWorkerHandler(target, {
      id: "test",
      version: "1",
      supports: () => true,
      parse: slow,
    });
    const promise1 = custom(parseRequest(validOfx.buffer));
    await custom(parseRequest(validOfx.buffer));
    await promise1;

    const failed = target.messages.find((message) => message.type === "failed");
    expect(failed?.type === "failed" && failed.errorCode === "OPERATION_ALREADY_ACTIVE").toBe(true);
  });
});
