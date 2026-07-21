import { describe, expect, it } from "vitest";

import { readyCacheName, stagingCacheName } from "./model-cache";
import type { ModelProfile } from "./model-profile";
import {
  ModelSideloader,
  SideloadError,
  type CacheLike,
  type CacheStoreLike,
} from "./sideloader";

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

const bytesOf = (text: string): ArrayBuffer => {
  const view = new TextEncoder().encode(text);
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
};
const fakeDigest = (bytes: ArrayBuffer): Promise<string> =>
  Promise.resolve(`d-${new TextDecoder().decode(bytes)}`);

function profile(): ModelProfile {
  return {
    profileId: "p1",
    runtime: "transformers.js",
    runtimeVersion: "x",
    modelRepo: "r",
    modelRevision: "rev",
    quantization: "q",
    tokenizerId: "t",
    files: [
      { path: "a.onnx", sha256: "d-AAA", byteSize: 3 },
      { path: "b.json", sha256: "d-BBB", byteSize: 3 },
    ],
    license: "L",
    totalByteSize: 6,
    minCapabilityTier: "recommended",
    task: "category.classify.v1",
    promptVersion: "1.0.0",
    schemaVersion: "1.0.0",
    decoding: { temperature: 0, maxOutputTokens: 8 },
  };
}

describe("ModelSideloader", () => {
  it("publishes verified files and reports ready", async () => {
    const { cache, stores } = memoryCache();
    const loader = new ModelSideloader(cache, fakeDigest);
    await loader.sideload(profile(), [
      { path: "a.onnx", bytes: bytesOf("AAA") },
      { path: "b.json", bytes: bytesOf("BBB") },
    ]);
    expect(stores.get(readyCacheName("p1"))?.size).toBe(2);
    expect(stores.has(stagingCacheName("p1"))).toBe(false);
    expect(await loader.isReady(profile())).toBe(true);
  });

  it("rejects a digest mismatch and leaves nothing ready", async () => {
    const { cache, stores } = memoryCache();
    const loader = new ModelSideloader(cache, fakeDigest);
    await expect(
      loader.sideload(profile(), [
        { path: "a.onnx", bytes: bytesOf("WRONG") },
        { path: "b.json", bytes: bytesOf("BBB") },
      ]),
    ).rejects.toBeInstanceOf(SideloadError);
    expect(stores.get(readyCacheName("p1"))).toBeUndefined();
    expect(stores.has(stagingCacheName("p1"))).toBe(false);
  });

  it("rejects a missing expected file", async () => {
    const { cache } = memoryCache();
    const loader = new ModelSideloader(cache, fakeDigest);
    await expect(
      loader.sideload(profile(), [{ path: "a.onnx", bytes: bytesOf("AAA") }]),
    ).rejects.toMatchObject({ code: "MISSING_FILE" });
  });

  it("rejects an unexpected file", async () => {
    const { cache } = memoryCache();
    const loader = new ModelSideloader(cache, fakeDigest);
    await expect(
      loader.sideload(profile(), [
        { path: "a.onnx", bytes: bytesOf("AAA") },
        { path: "b.json", bytes: bytesOf("BBB") },
        { path: "evil.js", bytes: bytesOf("X") },
      ]),
    ).rejects.toMatchObject({ code: "UNEXPECTED_FILE" });
  });

  it("reports not ready before any sideload", async () => {
    const { cache } = memoryCache();
    const loader = new ModelSideloader(cache, fakeDigest);
    expect(await loader.isReady(profile())).toBe(false);
  });
});
