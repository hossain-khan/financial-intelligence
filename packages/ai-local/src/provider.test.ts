import { describe, expect, it } from "vitest";

import { CLASSIFIER_PROFILE, type ModelProfile } from "./model-profile";
import { LocalAiProvider, type LocalWorker } from "./provider";
import type { LocalAiRequest, LocalAiResponse } from "./protocol";

class FakeWorker implements LocalWorker {
  public sent: LocalAiRequest[] = [];
  public reply?: (request: LocalAiRequest) => LocalAiResponse | undefined;
  private messageListeners: ((event: { data: LocalAiResponse }) => void)[] = [];

  public postMessage(message: LocalAiRequest): void {
    this.sent.push(message);
    const response = this.reply?.(message);
    if (response !== undefined) {
      queueMicrotask(() => {
        for (const listener of this.messageListeners) listener({ data: response });
      });
    }
  }
  public addEventListener(type: "message" | "error", listener: never): void {
    if (type === "message") this.messageListeners.push(listener);
  }
  public removeEventListener(type: "message" | "error", listener: never): void {
    if (type === "message") {
      this.messageListeners = this.messageListeners.filter((l) => l !== listener);
    }
  }
  public terminate(): void {}
}

const readyProfile: ModelProfile = {
  ...CLASSIFIER_PROFILE,
  files: [{ path: "a", sha256: "x", byteSize: 1 }],
};
const valid = { categoryId: "dining", confidence: 0.9, rationale: "ok" };
const request = {
  task: "category.classify.v1" as const,
  payload: { descriptor: "coffee", direction: "outflow", allowedCategoryIds: ["dining"] },
};
const options = () => ({ signal: new AbortController().signal, deadlineMs: 1000 });

function deps(worker: FakeWorker, ready = true) {
  return {
    createWorker: () => worker,
    profile: readyProfile,
    isReady: () => Promise.resolve(ready),
  };
}

function loadThen(response: (m: LocalAiRequest) => LocalAiResponse | undefined) {
  return (message: LocalAiRequest): LocalAiResponse | undefined => {
    if (message.type === "load") {
      return { protocolVersion: 1, type: "loaded", operationId: message.operationId };
    }
    return response(message);
  };
}

describe("LocalAiProvider", () => {
  it("returns a validated suggestion for a good result", async () => {
    const worker = new FakeWorker();
    worker.reply = loadThen((m) =>
      m.type === "execute"
        ? {
            protocolVersion: 1,
            type: "result",
            operationId: m.operationId,
            output: JSON.stringify(valid),
          }
        : undefined,
    );
    const result = await new LocalAiProvider(deps(worker)).execute(request, options());
    expect(result).toEqual({ ok: true, output: valid });
  });

  it("rejects schema-invalid output", async () => {
    const worker = new FakeWorker();
    worker.reply = loadThen((m) =>
      m.type === "execute"
        ? {
            protocolVersion: 1,
            type: "result",
            operationId: m.operationId,
            output: '{"categoryId":123}',
          }
        : undefined,
    );
    const result = await new LocalAiProvider(deps(worker)).execute(request, options());
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_output" } });
  });

  it("rejects non-JSON output", async () => {
    const worker = new FakeWorker();
    worker.reply = loadThen((m) =>
      m.type === "execute"
        ? { protocolVersion: 1, type: "result", operationId: m.operationId, output: "not json" }
        : undefined,
    );
    const result = await new LocalAiProvider(deps(worker)).execute(request, options());
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_output" } });
  });

  it("maps a device-lost failure to resource_exhausted", async () => {
    const worker = new FakeWorker();
    worker.reply = loadThen((m) =>
      m.type === "execute"
        ? {
            protocolVersion: 1,
            type: "failed",
            operationId: m.operationId,
            errorCode: "DEVICE_LOST",
            message: "lost",
          }
        : undefined,
    );
    const result = await new LocalAiProvider(deps(worker)).execute(request, options());
    expect(result).toMatchObject({ ok: false, error: { code: "resource_exhausted" } });
  });

  it("returns unsupported when the model is not ready", async () => {
    const result = await new LocalAiProvider(deps(new FakeWorker(), false)).execute(
      request,
      options(),
    );
    expect(result).toMatchObject({ ok: false, error: { code: "unsupported" } });
  });

  it("returns unsupported for an unsupported task", async () => {
    const result = await new LocalAiProvider(deps(new FakeWorker())).execute(
      { task: "query.plan.v1", payload: {} },
      options(),
    );
    expect(result).toMatchObject({ ok: false, error: { code: "unsupported" } });
  });
});
