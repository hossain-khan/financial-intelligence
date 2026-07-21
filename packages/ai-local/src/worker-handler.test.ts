import { describe, expect, it } from "vitest";

import { FakeLocalEngine } from "./fake-engine";
import { CLASSIFIER_PROFILE } from "./model-profile";
import type { LocalAiResponse } from "./protocol";
import { createLocalAiWorkerHandler } from "./worker-handler";

function collector() {
  const messages: LocalAiResponse[] = [];
  return { messages, postMessage: (response: LocalAiResponse) => messages.push(response) };
}

const decoding = { temperature: 0, maxOutputTokens: 8 };

describe("local ai worker handler", () => {
  it("loads with progress then reports loaded", async () => {
    const target = collector();
    const handle = createLocalAiWorkerHandler(target, new FakeLocalEngine({ loadSteps: 2 }));
    await handle({
      protocolVersion: 1,
      type: "load",
      operationId: "op1",
      profile: CLASSIFIER_PROFILE,
    });
    expect(target.messages.some((m) => m.type === "progress")).toBe(true);
    expect(target.messages.at(-1)?.type).toBe("loaded");
  });

  it("executes and returns a result", async () => {
    const target = collector();
    const handle = createLocalAiWorkerHandler(
      target,
      new FakeLocalEngine({ generateOutput: "OUT" }),
    );
    await handle({
      protocolVersion: 1,
      type: "load",
      operationId: "l",
      profile: CLASSIFIER_PROFILE,
    });
    await handle({
      protocolVersion: 1,
      type: "execute",
      operationId: "e",
      task: "category.classify.v1",
      prompt: "p",
      decoding,
    });
    expect(target.messages.find((m) => m.type === "result")).toMatchObject({
      type: "result",
      output: "OUT",
    });
  });

  it("cancels an in-flight execute without emitting a late result", async () => {
    const target = collector();
    const handle = createLocalAiWorkerHandler(
      target,
      new FakeLocalEngine({ generateDelayMs: 50, generateOutput: "LATE" }),
    );
    await handle({
      protocolVersion: 1,
      type: "load",
      operationId: "l",
      profile: CLASSIFIER_PROFILE,
    });
    const exec = handle({
      protocolVersion: 1,
      type: "execute",
      operationId: "e",
      task: "category.classify.v1",
      prompt: "p",
      decoding,
    });
    await handle({ protocolVersion: 1, type: "cancel", operationId: "e" });
    await exec;
    expect(target.messages.some((m) => m.type === "result")).toBe(false);
    expect(target.messages.some((m) => m.type === "failed" && m.errorCode === "CANCELLED")).toBe(
      true,
    );
  });

  it("maps a device-lost generate to DEVICE_LOST", async () => {
    const target = collector();
    const handle = createLocalAiWorkerHandler(
      target,
      new FakeLocalEngine({ deviceLostOnGenerate: true }),
    );
    await handle({
      protocolVersion: 1,
      type: "load",
      operationId: "l",
      profile: CLASSIFIER_PROFILE,
    });
    await handle({
      protocolVersion: 1,
      type: "execute",
      operationId: "e",
      task: "category.classify.v1",
      prompt: "p",
      decoding,
    });
    expect(target.messages.some((m) => m.type === "failed" && m.errorCode === "DEVICE_LOST")).toBe(
      true,
    );
  });

  it("rejects an unsupported protocol version", async () => {
    const target = collector();
    const handle = createLocalAiWorkerHandler(target, new FakeLocalEngine());
    await handle({ protocolVersion: 2, type: "load", operationId: "x" });
    expect(target.messages.at(-1)).toMatchObject({
      type: "failed",
      errorCode: "UNSUPPORTED_PROTOCOL_VERSION",
    });
  });

  it("rejects an unknown message type", async () => {
    const target = collector();
    const handle = createLocalAiWorkerHandler(target, new FakeLocalEngine());
    await handle({ protocolVersion: 1, type: "explode", operationId: "x" });
    expect(target.messages.at(-1)).toMatchObject({
      type: "failed",
      errorCode: "UNKNOWN_MESSAGE_TYPE",
    });
  });
});
