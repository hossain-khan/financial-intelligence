// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as aiLocalModule from "@financial-intelligence/ai-local";
import {
  LOCAL_AI_PROFILE,
  downloadPinnedModel,
  isModelReady,
  readLocalAiCapability,
  readModelState,
  sideloadModelFiles,
  stagingCacheName,
} from "./local-ai";

const mockIsReady = vi.fn();
const mockSideload = vi.fn();

vi.mock("@financial-intelligence/ai-local", async (importOriginal) => {
  const actual = await importOriginal<typeof aiLocalModule>();
  return {
    ...actual,
    detectCapability: vi.fn(),
    downloadModel: vi.fn(),
    ModelSideloader: vi.fn(function MockSideloader() {
      return {
        isReady: mockIsReady,
        sideload: mockSideload,
      };
    }),
  };
});

import { detectCapability, downloadModel } from "@financial-intelligence/ai-local";

function createMockFile(name = "model.onnx"): File {
  const file = new File(["test-content"], name);
  Object.defineProperty(file, "webkitRelativePath", { value: "", writable: true });
  file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));
  return file;
}

describe("local-ai adapter", () => {
  const originalGpu = (navigator as { gpu?: unknown }).gpu;
  const originalCaches = globalThis.caches;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalGpu !== undefined) {
      Object.defineProperty(navigator, "gpu", {
        value: originalGpu,
        writable: true,
        configurable: true,
      });
    }
    if (originalCaches !== undefined) {
      Object.defineProperty(globalThis, "caches", {
        value: originalCaches,
        writable: true,
        configurable: true,
      });
    }
  });

  describe("readLocalAiCapability", () => {
    it("delegates to detectCapability with browser environment details", async () => {
      const mockReport = {
        supported: true,
        reasons: [],
        webGpu: true,
        storageQuotaBytes: 1000000,
      };
      vi.mocked(detectCapability).mockResolvedValue(mockReport as never);

      const report = await readLocalAiCapability();
      expect(report).toBe(mockReport);
      expect(detectCapability).toHaveBeenCalledWith(
        expect.objectContaining({
          hasWorker: expect.anything(),
        }),
        expect.anything(),
      );
    });

    it("passes GPU instance when navigator.gpu exists", async () => {
      const fakeGpu = { requestAdapter: vi.fn() };
      Object.defineProperty(navigator, "gpu", {
        value: fakeGpu,
        writable: true,
        configurable: true,
      });

      vi.mocked(detectCapability).mockResolvedValue({ supported: true } as never);
      await readLocalAiCapability();

      expect(detectCapability).toHaveBeenCalledWith(
        expect.objectContaining({ gpu: fakeGpu }),
        expect.anything(),
      );
    });
  });

  describe("isModelReady", () => {
    it("queries ModelSideloader.isReady", async () => {
      mockIsReady.mockResolvedValue(true);

      const ready = await isModelReady();
      expect(ready).toBe(true);
      expect(mockIsReady).toHaveBeenCalled();
    });
  });

  describe("readModelState", () => {
    it("returns 'ready' when model is ready", async () => {
      mockIsReady.mockResolvedValue(true);

      const state = await readModelState();
      expect(state).toBe("ready");
    });

    it("returns 'incomplete' when staging cache exists", async () => {
      mockIsReady.mockResolvedValue(false);

      const stagingName = stagingCacheName(LOCAL_AI_PROFILE.profileId);
      const mockCaches = {
        keys: vi.fn().mockResolvedValue([stagingName]),
      };
      Object.defineProperty(globalThis, "caches", {
        value: mockCaches,
        writable: true,
        configurable: true,
      });

      const state = await readModelState();
      expect(state).toBe("incomplete");
    });

    it("returns 'not-downloaded' when model is not ready and no staging cache exists", async () => {
      mockIsReady.mockResolvedValue(false);

      const mockCaches = {
        keys: vi.fn().mockResolvedValue(["unrelated-cache"]),
      };
      Object.defineProperty(globalThis, "caches", {
        value: mockCaches,
        writable: true,
        configurable: true,
      });

      const state = await readModelState();
      expect(state).toBe("not-downloaded");
    });
  });

  describe("sideloadModelFiles", () => {
    it("returns ready: true when sideload succeeds", async () => {
      mockSideload.mockResolvedValue(undefined);

      const mockFile = createMockFile();
      const outcome = await sideloadModelFiles([mockFile]);

      expect(outcome).toEqual({ ready: true });
      expect(mockSideload).toHaveBeenCalled();
    });

    it("returns ready: false and error message when sideload fails", async () => {
      mockSideload.mockRejectedValue(new Error("Invalid ONNX checksum"));

      const mockFile = createMockFile();
      const outcome = await sideloadModelFiles([mockFile]);

      expect(outcome).toEqual({ ready: false, error: "Invalid ONNX checksum" });
    });
  });

  describe("downloadPinnedModel", () => {
    it("returns ready: true when downloadModel resolves", async () => {
      vi.mocked(downloadModel).mockResolvedValue(undefined as never);

      const outcome = await downloadPinnedModel();
      expect(outcome).toEqual({ ready: true });
      expect(downloadModel).toHaveBeenCalled();
    });

    it("returns ready: false with error message when download fails", async () => {
      vi.mocked(downloadModel).mockRejectedValue(new Error("Network timeout") as never);

      const outcome = await downloadPinnedModel();
      expect(outcome).toEqual({ ready: false, error: "Network timeout" });
    });
  });
});
