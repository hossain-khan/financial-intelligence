import { describe, expect, it, vi } from "vitest";

import { DownloadError, downloadModel, modelFileUrl } from "./downloader";
import { readyCacheName, type CacheLike, type CacheStoreLike } from "./model-cache";
import type { ModelProfile, ModelProfileFile } from "./model-profile";

function memoryCache() {
  const stores = new Map<string, Map<string, ArrayBuffer>>();
  const cache: CacheLike = {
    open: (name) => {
      const store = stores.get(name) ?? new Map<string, ArrayBuffer>();
      stores.set(name, store);
      const api: CacheStoreLike = {
        put: (key, bytes) => {
          store.set(key, bytes);
          return Promise.resolve();
        },
        match: (key) => Promise.resolve(store.get(key)),
      };
      return Promise.resolve(api);
    },
    delete: (name) => Promise.resolve(stores.delete(name)),
    keys: () => Promise.resolve([...stores.keys()]),
  };
  return { cache, stores };
}

async function realSha(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const bodyOf = (text: string): Response => new Response(new TextEncoder().encode(text));

function profile(files: readonly ModelProfileFile[]): ModelProfile {
  return {
    profileId: "p1",
    runtime: "transformers.js",
    runtimeVersion: "4.2.0",
    modelRepo: "org/model",
    modelRevision: "rev123",
    quantization: "q4",
    tokenizerId: "org/model",
    files,
    license: "L",
    totalByteSize: files.reduce((sum, file) => sum + file.byteSize, 0),
    minCapabilityTier: "recommended",
    task: "category.classify.v1",
    promptVersion: "1.0.0",
    schemaVersion: "1.0.0",
    decoding: { temperature: 0, maxOutputTokens: 256 },
  };
}

describe("modelFileUrl", () => {
  it("builds a pinned resolve URL", () => {
    expect(modelFileUrl(profile([]), "onnx/a.onnx")).toBe(
      "https://huggingface.co/org/model/resolve/rev123/onnx/a.onnx",
    );
  });
});

describe("downloadModel", () => {
  it("downloads, verifies, and publishes all files", async () => {
    const { cache, stores } = memoryCache();
    const files = [
      { path: "config.json", sha256: await realSha("CFG"), byteSize: 3 },
      { path: "onnx/w.onnx", sha256: await realSha("WWW"), byteSize: 3 },
    ];
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(url.endsWith("config.json") ? bodyOf("CFG") : bodyOf("WWW")),
    ) as unknown as typeof fetch;
    await downloadModel(profile(files), { cache, fetch: fetchMock });
    expect(stores.get(readyCacheName("p1"))?.size).toBe(2);
  });

  it("aborts and cleans up on a digest mismatch", async () => {
    const { cache, stores } = memoryCache();
    const files = [{ path: "config.json", sha256: "0".repeat(64), byteSize: 3 }];
    const fetchMock = vi.fn(() => Promise.resolve(bodyOf("CFG"))) as unknown as typeof fetch;
    await expect(downloadModel(profile(files), { cache, fetch: fetchMock })).rejects.toMatchObject({
      code: "digest_mismatch",
    });
    expect(stores.get(readyCacheName("p1"))).toBeUndefined();
    expect(stores.keys()).not.toContain("financial-intelligence-model-p1-staging");
  });

  it("maps an error response to a network DownloadError", async () => {
    const { cache } = memoryCache();
    const files = [{ path: "config.json", sha256: await realSha("CFG"), byteSize: 3 }];
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 503 })),
    ) as unknown as typeof fetch;
    await expect(downloadModel(profile(files), { cache, fetch: fetchMock })).rejects.toMatchObject({
      code: "network",
    });
  });

  it("maps a thrown fetch to a network DownloadError", async () => {
    const { cache } = memoryCache();
    const files = [{ path: "config.json", sha256: await realSha("CFG"), byteSize: 3 }];
    const fetchMock = vi.fn(() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    await expect(downloadModel(profile(files), { cache, fetch: fetchMock })).rejects.toBeInstanceOf(
      DownloadError,
    );
  });

  it("reports cumulative overall progress across files", async () => {
    const { cache } = memoryCache();
    const files = [
      { path: "a", sha256: await realSha("AA"), byteSize: 2 },
      { path: "b", sha256: await realSha("BB"), byteSize: 2 },
    ];
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(bodyOf(url.endsWith("a") ? "AA" : "BB")),
    ) as unknown as typeof fetch;
    const seen: number[] = [];
    await downloadModel(profile(files), {
      cache,
      fetch: fetchMock,
      onProgress: (p) => seen.push(p.overallBytes),
    });
    expect(Math.max(...seen)).toBe(4);
  });

  it("rejects a profile with no files", async () => {
    const { cache } = memoryCache();
    const fetchMock = vi.fn() as unknown as typeof fetch;
    await expect(downloadModel(profile([]), { cache, fetch: fetchMock })).rejects.toMatchObject({
      code: "profile_invalid",
    });
  });
});
