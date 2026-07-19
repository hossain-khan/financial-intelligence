import type {
  ImportWorkerResponse,
  ParseStatementInput,
  StatementParser,
} from "@financial-intelligence/import-core";

import { CsvImportError } from "./errors";
import { CsvStatementParser } from "./parser";

export interface WorkerResponseTarget {
  postMessage(response: ImportWorkerResponse): void;
}

export type CsvImportWorkerHandler = (message: unknown) => Promise<void>;

export function createCsvImportWorkerHandler(
  target: WorkerResponseTarget,
  parser: StatementParser = new CsvStatementParser(),
): CsvImportWorkerHandler {
  const operations = new Map<string, AbortController>();

  return async (message: unknown): Promise<void> => {
    const operationId = readOperationId(message);
    if (!isRecord(message) || message.protocolVersion !== 1) {
      target.postMessage(
        failed(operationId, "UNSUPPORTED_PROTOCOL_VERSION", "Unsupported worker protocol version"),
      );
      return;
    }

    if (message.type === "cancel") {
      const controller = operations.get(operationId);
      if (controller === undefined) {
        target.postMessage(
          failed(operationId, "OPERATION_NOT_FOUND", "No active parse operation was found"),
        );
      } else {
        controller.abort();
      }
      return;
    }

    if (message.type !== "parse") {
      target.postMessage(
        failed(operationId, "UNKNOWN_MESSAGE_TYPE", "Unknown worker message type"),
      );
      return;
    }
    if (!isParseInput(message.input)) {
      target.postMessage(failed(operationId, "INVALID_REQUEST", "Parse request is invalid"));
      return;
    }
    if (operations.has(operationId)) {
      target.postMessage(
        failed(operationId, "OPERATION_ALREADY_ACTIVE", "Operation is already active"),
      );
      return;
    }

    const controller = new AbortController();
    operations.set(operationId, controller);
    try {
      const result = await parser.parse(message.input, controller.signal, (progress) => {
        if (!controller.signal.aborted) {
          target.postMessage({
            protocolVersion: 1,
            type: "progress",
            operationId,
            completed: progress.completed,
            ...(progress.total === undefined ? {} : { total: progress.total }),
          });
        }
      });
      if (controller.signal.aborted) {
        target.postMessage(failed(operationId, "CANCELLED", "Statement parsing was cancelled"));
      } else {
        target.postMessage({ protocolVersion: 1, type: "completed", operationId, result });
      }
    } catch (error) {
      target.postMessage(normalizeFailure(operationId, error, controller.signal.aborted));
    } finally {
      operations.delete(operationId);
    }
  };
}

function normalizeFailure(
  operationId: string,
  error: unknown,
  aborted: boolean,
): ImportWorkerResponse {
  if (aborted || (error instanceof CsvImportError && error.code === "CANCELLED")) {
    return failed(operationId, "CANCELLED", "Statement parsing was cancelled");
  }
  if (error instanceof CsvImportError) {
    return failed(operationId, error.code, error.message);
  }
  return failed(operationId, "PARSE_FAILED", "Statement parsing failed");
}

function failed(operationId: string, errorCode: string, message: string): ImportWorkerResponse {
  return { protocolVersion: 1, type: "failed", operationId, errorCode, message };
}

function readOperationId(message: unknown): string {
  if (
    isRecord(message) &&
    typeof message.operationId === "string" &&
    message.operationId.length > 0 &&
    message.operationId.length <= 128
  ) {
    return message.operationId;
  }
  return "unknown";
}

function isParseInput(value: unknown): value is ParseStatementInput {
  if (!isRecord(value) || !(value.bytes instanceof ArrayBuffer) || !isRecord(value.metadata)) {
    return false;
  }
  const metadata = value.metadata;
  return (
    typeof metadata.fileName === "string" &&
    metadata.fileName.length <= 255 &&
    typeof metadata.mediaType === "string" &&
    metadata.mediaType.length <= 120 &&
    typeof metadata.byteSize === "number" &&
    Number.isSafeInteger(metadata.byteSize) &&
    metadata.byteSize >= 0 &&
    typeof metadata.sha256 === "string" &&
    /^[0-9a-f]{64}$/u.test(metadata.sha256)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
