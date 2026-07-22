// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceBackupSnapshot } from "@financial-intelligence/backup";
import { decryptBackupInWorker, encryptBackupInWorker } from "./backup-worker-client";

type EventListenerFn = (event: MessageEvent | ErrorEvent) => void;

describe("backup-worker-client", () => {
  const originalWorker = globalThis.Worker;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.Worker = originalWorker;
  });

  describe("encryptBackupInWorker", () => {
    it("resolves with encrypted content when worker sends 'encrypted' response", async () => {
      const listeners: Record<string, EventListenerFn[]> = {};
      const mockWorkerInstance = {
        postMessage: vi.fn((request) => {
          if (request.type === "encrypt") {
            const handler = listeners["message"]?.[0];
            if (handler) {
              handler({
                data: {
                  protocolVersion: 1,
                  type: "encrypted",
                  operationId: request.operationId,
                  content: "ENCRYPTED_PAYLOAD_STRING",
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

      globalThis.Worker = vi.fn(function MockWorker() {
        return mockWorkerInstance;
      }) as unknown as typeof Worker;

      const dummySnapshot: Omit<WorkspaceBackupSnapshot, "manifest"> = {
        vault: { key: "value" },
      } as unknown as Omit<WorkspaceBackupSnapshot, "manifest">;

      const result = await encryptBackupInWorker(dummySnapshot, "passphrase123", "build-1");
      expect(result).toBe("ENCRYPTED_PAYLOAD_STRING");
      expect(mockWorkerInstance.terminate).toHaveBeenCalled();
    });

    it("rejects with errorCode when worker sends 'failed' response", async () => {
      const listeners: Record<string, EventListenerFn[]> = {};
      const mockWorkerInstance = {
        postMessage: vi.fn((request) => {
          if (request.type === "encrypt") {
            const handler = listeners["message"]?.[0];
            if (handler) {
              handler({
                data: {
                  protocolVersion: 1,
                  type: "failed",
                  operationId: request.operationId,
                  errorCode: "ENCRYPTION_FAILED",
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

      globalThis.Worker = vi.fn(function MockWorker() {
        return mockWorkerInstance;
      }) as unknown as typeof Worker;

      const dummySnapshot = {} as unknown as Omit<WorkspaceBackupSnapshot, "manifest">;
      await expect(encryptBackupInWorker(dummySnapshot, "pass", "build-1")).rejects.toThrow(
        "ENCRYPTION_FAILED",
      );
      expect(mockWorkerInstance.terminate).toHaveBeenCalled();
    });
  });

  describe("decryptBackupInWorker", () => {
    it("resolves with WorkspaceBackupSnapshot when worker sends 'decrypted' response", async () => {
      const listeners: Record<string, EventListenerFn[]> = {};
      const mockSnapshot = {
        manifest: { version: 1 },
        vault: {},
      } as unknown as WorkspaceBackupSnapshot;

      const mockWorkerInstance = {
        postMessage: vi.fn((request) => {
          if (request.type === "decrypt") {
            const handler = listeners["message"]?.[0];
            if (handler) {
              handler({
                data: {
                  protocolVersion: 1,
                  type: "decrypted",
                  operationId: request.operationId,
                  snapshot: mockSnapshot,
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

      globalThis.Worker = vi.fn(function MockWorker() {
        return mockWorkerInstance;
      }) as unknown as typeof Worker;

      const result = await decryptBackupInWorker("ENCRYPTED_STRING", "passphrase123");
      expect(result).toBe(mockSnapshot);
      expect(mockWorkerInstance.terminate).toHaveBeenCalled();
    });

    it("rejects when worker fires an error event", async () => {
      const listeners: Record<string, EventListenerFn[]> = {};
      const mockWorkerInstance = {
        postMessage: vi.fn((request) => {
          if (request.type === "decrypt") {
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

      globalThis.Worker = vi.fn(function MockWorker() {
        return mockWorkerInstance;
      }) as unknown as typeof Worker;

      await expect(decryptBackupInWorker("BAD_DATA", "pass")).rejects.toThrow(
        "The backup worker could not complete the operation.",
      );
      expect(mockWorkerInstance.terminate).toHaveBeenCalled();
    });
  });
});
