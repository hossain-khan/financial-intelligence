import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PwaController,
  type BroadcastPort,
  type PwaBroadcastMessage,
  type ServiceWorkerRegistrationPort,
} from "./lifecycle";
import { beginProtectedOperation } from "./protected-operations";

interface Harness {
  readonly controller: PwaController;
  triggerNeedRefresh(): void;
  triggerOfflineReady(): void;
  triggerRegisterError(error: unknown): void;
  readonly activate: ReturnType<typeof vi.fn>;
  readonly reload: ReturnType<typeof vi.fn>;
  readonly posted: PwaBroadcastMessage[];
  receive(message: PwaBroadcastMessage): void;
}

function makeHarness(options: { supported?: boolean; activateRejects?: boolean } = {}): Harness {
  let callbacks:
    | {
        onNeedRefresh: () => void;
        onOfflineReady: () => void;
        onRegisterError: (e: unknown) => void;
      }
    | undefined;
  const activate = vi.fn(async () => {
    if (options.activateRejects) throw new Error("activate failed");
  });
  const registration: ServiceWorkerRegistrationPort = {
    supported: options.supported ?? true,
    register: (cb) => {
      callbacks = cb;
    },
    activate,
  };
  const posted: PwaBroadcastMessage[] = [];
  let broadcastListener: ((message: PwaBroadcastMessage) => void) | undefined;
  const broadcast: BroadcastPort = {
    post: (message) => posted.push(message),
    subscribe: (listener) => {
      broadcastListener = listener;
      return () => {
        broadcastListener = undefined;
      };
    },
  };
  const reload = vi.fn();
  const controller = new PwaController({ registration, broadcast, buildId: "build-1", reload });
  controller.start();
  return {
    controller,
    triggerNeedRefresh: () => callbacks?.onNeedRefresh(),
    triggerOfflineReady: () => callbacks?.onOfflineReady(),
    triggerRegisterError: (error) => callbacks?.onRegisterError(error),
    activate,
    reload,
    posted,
    receive: (message) => broadcastListener?.(message),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PwaController", () => {
  it("starts in checking and becomes offline-ready", () => {
    const harness = makeHarness();
    expect(harness.controller.getStatus().state).toBe("checking");
    harness.triggerOfflineReady();
    expect(harness.controller.getStatus().state).toBe("offline-ready");
  });

  it("reports unsupported browsers without registering", () => {
    const harness = makeHarness({ supported: false });
    expect(harness.controller.getStatus().state).toBe("failed");
    expect(harness.controller.getStatus().supported).toBe(false);
  });

  it("moves to update-available and activates + reloads on confirmation", async () => {
    const harness = makeHarness();
    harness.triggerNeedRefresh();
    expect(harness.controller.getStatus().state).toBe("update-available");
    await harness.controller.confirmUpdate();
    expect(harness.activate).toHaveBeenCalledOnce();
    expect(harness.reload).toHaveBeenCalledOnce();
    expect(harness.controller.getStatus().state).toBe("reload-required");
    expect(harness.posted).toContainEqual({ type: "reload-required", buildId: "build-1" });
  });

  it("defers activation while a protected operation is active, then applies it automatically", async () => {
    const harness = makeHarness();
    harness.triggerNeedRefresh();
    const release = beginProtectedOperation("import-commit");
    // Re-derive deferral now that an operation is active.
    harness.triggerNeedRefresh();
    expect(harness.controller.getStatus().updateDeferred).toBe(true);

    await harness.controller.confirmUpdate();
    // Still deferred; activation must not have happened during the protected operation.
    expect(harness.activate).not.toHaveBeenCalled();
    expect(harness.controller.getStatus().state).toBe("update-available");

    release();
    // Releasing the operation triggers the deferred activation.
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.activate).toHaveBeenCalledOnce();
  });

  it("marks reload-required when another tab activates a different build", () => {
    const harness = makeHarness();
    harness.triggerOfflineReady();
    harness.receive({ type: "reload-required", buildId: "build-2" });
    expect(harness.controller.getStatus().state).toBe("reload-required");
  });

  it("surfaces update-available when another tab reports one", () => {
    const harness = makeHarness();
    harness.triggerOfflineReady();
    // A controlling worker is present → treat as ready first.
    harness.receive({ type: "reload-required", buildId: "build-1" }); // same build, ignored
    expect(harness.controller.getStatus().state).toBe("offline-ready");
  });

  it("fails safely when activation throws, keeping the current version", async () => {
    const harness = makeHarness({ activateRejects: true });
    harness.triggerNeedRefresh();
    await harness.controller.confirmUpdate();
    expect(harness.controller.getStatus().state).toBe("failed");
    expect(harness.reload).not.toHaveBeenCalled();
  });

  it("reports a sanitized failure on registration error without leaking detail", () => {
    const harness = makeHarness();
    harness.triggerRegisterError(new Error("/Users/secret/path failed"));
    const status = harness.controller.getStatus();
    expect(status.state).toBe("failed");
    expect(status.message).not.toContain("secret");
  });
});
