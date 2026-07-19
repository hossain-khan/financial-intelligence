import type {
  ImportWorkerResponse,
  ParseProgressReporter,
  ParseStatementInput,
  ParseStatementResult,
  SourceFileMetadata,
  StatementParser,
} from "@financial-intelligence/import-core";
import { describe, expect, it } from "vitest";

import { CsvImportError } from "./errors";
import { createCsvImportWorkerHandler } from "./worker-handler";

const metadata: SourceFileMetadata = {
  fileName: "test.csv",
  mediaType: "text/csv",
  byteSize: 0,
  sha256: "0".repeat(64),
};

describe("CSV import worker protocol", () => {
  it("emits bounded progress and a completed response", async () => {
    const responses: ImportWorkerResponse[] = [];
    const parser = new FakeParser(async (_input, _signal, progress) => {
      progress?.({ completed: 0, total: 0 });
      return result();
    });
    const handle = createCsvImportWorkerHandler(
      { postMessage: (response) => responses.push(response) },
      parser,
    );

    await handle(parseRequest());

    expect(responses).toEqual([
      { protocolVersion: 1, type: "progress", operationId: "operation-1", completed: 0, total: 0 },
      { protocolVersion: 1, type: "completed", operationId: "operation-1", result: result() },
    ]);
  });

  it("cancels an active operation without emitting a partial result", async () => {
    const responses: ImportWorkerResponse[] = [];
    const parser = new FakeParser(
      async (_input, signal) =>
        new Promise<ParseStatementResult>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new CsvImportError("CANCELLED", "cancelled")),
            { once: true },
          );
        }),
    );
    const handle = createCsvImportWorkerHandler(
      { postMessage: (response) => responses.push(response) },
      parser,
    );

    const active = handle(parseRequest());
    await Promise.resolve();
    await handle({ protocolVersion: 1, type: "cancel", operationId: "operation-1" });
    await active;

    expect(responses).toEqual([
      {
        protocolVersion: 1,
        type: "failed",
        operationId: "operation-1",
        errorCode: "CANCELLED",
        message: "Statement parsing was cancelled",
      },
    ]);
  });

  it.each([
    [
      { protocolVersion: 2, type: "parse", operationId: "version", input: parseRequest().input },
      "UNSUPPORTED_PROTOCOL_VERSION",
    ],
    [{ protocolVersion: 1, type: "surprise", operationId: "unknown" }, "UNKNOWN_MESSAGE_TYPE"],
    [{ protocolVersion: 1, type: "parse", operationId: "invalid", input: {} }, "INVALID_REQUEST"],
    [{ protocolVersion: 1, type: "cancel", operationId: "missing" }, "OPERATION_NOT_FOUND"],
  ])("rejects incompatible or invalid messages safely", async (message, errorCode) => {
    const responses: ImportWorkerResponse[] = [];
    const handle = createCsvImportWorkerHandler({
      postMessage: (response) => responses.push(response),
    });

    await handle(message);

    expect(responses).toHaveLength(1);
    expect(responses[0]).toMatchObject({ type: "failed", errorCode });
  });

  it("normalizes unexpected parser failures without leaking source content", async () => {
    const responses: ImportWorkerResponse[] = [];
    const parser = new FakeParser(async () => {
      throw new Error("secret source row =HYPERLINK(...)");
    });
    const handle = createCsvImportWorkerHandler(
      { postMessage: (response) => responses.push(response) },
      parser,
    );

    await handle(parseRequest());

    expect(responses[0]).toMatchObject({
      type: "failed",
      errorCode: "PARSE_FAILED",
      message: "Statement parsing failed",
    });
    expect(JSON.stringify(responses)).not.toContain("HYPERLINK");
  });
});

class FakeParser implements StatementParser {
  readonly id = "fake";
  readonly version = "1";

  constructor(
    private readonly implementation: (
      input: ParseStatementInput,
      signal: AbortSignal,
      progress?: ParseProgressReporter,
    ) => Promise<ParseStatementResult>,
  ) {}

  supports(): boolean {
    return true;
  }

  parse(
    input: ParseStatementInput,
    signal: AbortSignal,
    progress?: ParseProgressReporter,
  ): Promise<ParseStatementResult> {
    return this.implementation(input, signal, progress);
  }
}

function parseRequest() {
  return {
    protocolVersion: 1,
    type: "parse",
    operationId: "operation-1",
    input: { metadata, bytes: new ArrayBuffer(0) },
  } as const;
}

function result(): ParseStatementResult {
  return { parserId: "fake", parserVersion: "1", rows: [], issues: [] };
}
