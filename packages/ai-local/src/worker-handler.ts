import type { EngineDecoding, LocalEngine } from "./engine";
import type { LocalAiResponse } from "./protocol";
import type { ModelProfile } from "./model-profile";

export interface WorkerResponseTarget {
  postMessage(response: LocalAiResponse): void;
}

export type LocalAiWorkerHandler = (message: unknown) => Promise<void>;

/**
 * Protocol handler over a `LocalEngine`, modeled on the import-csv worker: one AbortController per
 * operation, cancel aborts it, each operation settles exactly once, and a cancelled operation never
 * emits a late `result`. A GPU device-loss error is mapped to a stable `DEVICE_LOST` code.
 */
export function createLocalAiWorkerHandler(
  target: WorkerResponseTarget,
  engine: LocalEngine,
): LocalAiWorkerHandler {
  const operations = new Map<string, AbortController>();

  const fail = (operationId: string, errorCode: string, message: string): void =>
    target.postMessage({ protocolVersion: 1, type: "failed", operationId, errorCode, message });
  const loaded = (operationId: string): void =>
    target.postMessage({ protocolVersion: 1, type: "loaded", operationId });

  return async (message: unknown): Promise<void> => {
    if (
      !isRecord(message) ||
      message.protocolVersion !== 1 ||
      typeof message.operationId !== "string"
    ) {
      fail(readOperationId(message), "UNSUPPORTED_PROTOCOL_VERSION", "Unsupported worker protocol version");
      return;
    }
    const operationId = message.operationId;

    if (message.type === "cancel") {
      operations.get(operationId)?.abort();
      return;
    }

    const controller = new AbortController();
    operations.set(operationId, controller);
    try {
      switch (message.type) {
        case "load": {
          await engine.load(message.profile as ModelProfile, (fraction) => {
            if (!controller.signal.aborted) {
              target.postMessage({ protocolVersion: 1, type: "progress", operationId, fraction });
            }
          }, controller.signal);
          if (controller.signal.aborted) fail(operationId, "CANCELLED", "Load cancelled");
          else loaded(operationId);
          break;
        }
        case "warmup": {
          await engine.warmup(controller.signal);
          loaded(operationId);
          break;
        }
        case "execute": {
          const output = await engine.generate(
            String(message.prompt),
            message.decoding as EngineDecoding,
            controller.signal,
          );
          if (controller.signal.aborted) {
            fail(operationId, "CANCELLED", "Execution cancelled");
          } else {
            target.postMessage({ protocolVersion: 1, type: "result", operationId, output });
          }
          break;
        }
        case "unload": {
          await engine.unload();
          loaded(operationId);
          break;
        }
        case "dispose": {
          await engine.dispose();
          loaded(operationId);
          break;
        }
        default:
          fail(operationId, "UNKNOWN_MESSAGE_TYPE", "Unknown worker message type");
      }
    } catch (error) {
      if (controller.signal.aborted) {
        fail(operationId, "CANCELLED", "Operation cancelled");
      } else if (error instanceof Error && /device.*lost/iu.test(error.message)) {
        fail(operationId, "DEVICE_LOST", "GPU device was lost");
      } else {
        fail(operationId, "ENGINE_ERROR", "Engine operation failed");
      }
    } finally {
      operations.delete(operationId);
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOperationId(message: unknown): string {
  return isRecord(message) && typeof message.operationId === "string"
    ? message.operationId
    : "unknown";
}
