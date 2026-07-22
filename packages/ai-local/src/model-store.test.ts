import { describe, expect, it } from "vitest";

import { readyCacheName, stagingCacheName } from "./model-cache";
import { createSha256Hasher, publishStagingToReady, stageVerifiedStream } from "./model-store";
import type { CacheLike, CacheStoreLike } from "./sideloader";

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

function streamOf(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function realSha(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("stageVerifiedStream", () => {
  it("streams a matching file into staging", async () => {
    const { cache, stores } = memoryCache();
    await stageVerifiedStream({
      cache,
      profileId: "p1",
      spec: { path: "a.bin", sha256: await realSha("HELLO"), byteSize: 5 },
      body: streamOf("HELLO"),
      createHasher: createSha256Hasher,
    });
    expect(stores.get(stagingCacheName("p1"))?.has("a.bin")).toBe(true);
  });

  it("throws DIGEST_MISMATCH when the hash differs", async () => {
    const { cache } = memoryCache();
    await expect(
      stageVerifiedStream({
        cache,
        profileId: "p1",
        spec: { path: "a.bin", sha256: "0".repeat(64), byteSize: 5 },
        body: streamOf("HELLO"),
        createHasher: createSha256Hasher,
      }),
    ).rejects.toMatchObject({ code: "DIGEST_MISMATCH" });
  });

  it("throws TOO_LARGE when bytes exceed the declared size", async () => {
    const { cache } = memoryCache();
    await expect(
      stageVerifiedStream({
        cache,
        profileId: "p1",
        spec: { path: "a.bin", sha256: await realSha("HELLO"), byteSize: 2 },
        body: streamOf("HELLO"),
        createHasher: createSha256Hasher,
      }),
    ).rejects.toMatchObject({ code: "TOO_LARGE" });
  });

  it("reports progress as chunks arrive", async () => {
    const { cache } = memoryCache();
    const seen: number[] = [];
    await stageVerifiedStream({
      cache,
      profileId: "p1",
      spec: { path: "a.bin", sha256: await realSha("HELLO"), byteSize: 5 },
      body: streamOf("HELLO"),
      createHasher: createSha256Hasher,
      onProgress: (bytes) => seen.push(bytes),
    });
    expect(seen.at(-1)).toBe(5);
  });
});

describe("publishStagingToReady", () => {
  it("copies staging to ready and deletes staging", async () => {
    const { cache, stores } = memoryCache();
    const staging = await cache.open(stagingCacheName("p1"));
    await staging.put("a.bin", new TextEncoder().encode("X").buffer);
    await publishStagingToReady(cache, "p1", ["a.bin"]);
    expect(stores.get(readyCacheName("p1"))?.has("a.bin")).toBe(true);
    expect(stores.has(stagingCacheName("p1"))).toBe(false);
  });
});
