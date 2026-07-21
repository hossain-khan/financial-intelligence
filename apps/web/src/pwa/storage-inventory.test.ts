import { describe, expect, it, vi } from "vitest";

import { classifyCacheKey } from "./cache-namespaces";
import {
  clearCacheNamespace,
  readStorageInventory,
  requestPersistentStorage,
  type CacheStoragePort,
  type StorageInventoryDependencies,
  type StorageManagerPort,
} from "./storage-inventory";

function fakeCaches(contents: Record<string, { url: string; contentLength?: string }[]>): {
  port: CacheStoragePort;
  deleted: string[];
} {
  const store = new Map(Object.entries(contents));
  const deleted: string[] = [];
  const port: CacheStoragePort = {
    keys: () => Promise.resolve([...store.keys()]),
    open: (key) =>
      Promise.resolve({
        keys: () => Promise.resolve((store.get(key) ?? []).map((entry) => ({ url: entry.url }))),
        match: (request) => {
          const entry = (store.get(key) ?? []).find((item) => item.url === request.url);
          return Promise.resolve(
            entry === undefined
              ? undefined
              : {
                  headers: {
                    get: (name: string) =>
                      name.toLowerCase() === "content-length"
                        ? (entry.contentLength ?? null)
                        : null,
                  },
                },
          );
        },
      }),
    delete: (key) => {
      deleted.push(key);
      store.delete(key);
      return Promise.resolve(true);
    },
  };
  return { port, deleted };
}

describe("classifyCacheKey", () => {
  it("maps workbox and app-shell keys to app-shell", () => {
    expect(classifyCacheKey("workbox-precache-v2-https://x/")?.category).toBe("app-shell");
    expect(classifyCacheKey("financial-intelligence-app-1")?.category).toBe("app-shell");
  });

  it("maps model and source prefixes to their namespaces", () => {
    expect(classifyCacheKey("financial-intelligence-model-gemma")?.category).toBe("model");
    expect(classifyCacheKey("financial-intelligence-source-abc")?.category).toBe("source");
  });

  it("returns undefined for foreign keys", () => {
    expect(classifyCacheKey("some-other-cache")).toBeUndefined();
  });
});

describe("readStorageInventory", () => {
  it("aggregates per-namespace item counts and byte estimates", async () => {
    const { port } = fakeCaches({
      "workbox-precache-v2-app": [
        { url: "https://x/index.html", contentLength: "1000" },
        { url: "https://x/app.js", contentLength: "2000" },
      ],
      "financial-intelligence-model-gemma": [{ url: "https://x/model.bin", contentLength: "500" }],
    });
    const storage: StorageManagerPort = {
      estimate: () => Promise.resolve({ usage: 3500, quota: 100_000 }),
      persisted: () => Promise.resolve(false),
      persist: () => Promise.resolve(true),
    };
    const inventory = await readStorageInventory({ caches: port, storage });

    const appShell = inventory.namespaces.find((n) => n.category === "app-shell");
    expect(appShell?.itemCount).toBe(2);
    expect(appShell?.approximateBytes).toBe(3000);
    expect(appShell?.clearable).toBe(false);

    const model = inventory.namespaces.find((n) => n.category === "model");
    expect(model?.itemCount).toBe(1);
    expect(model?.clearable).toBe(true);

    expect(inventory.estimate).toMatchObject({
      available: true,
      usageBytes: 3500,
      quotaBytes: 100_000,
    });
    expect(inventory.estimate.canRequestPersistence).toBe(true);
  });

  it("flags approximate bytes when a response omits content-length", async () => {
    const { port } = fakeCaches({
      "financial-intelligence-model-x": [{ url: "https://x/blob" }],
    });
    const inventory = await readStorageInventory({ caches: port });
    const model = inventory.namespaces.find((n) => n.category === "model");
    expect(model?.bytesAreApproximate).toBe(true);
  });

  it("reports unavailable estimate when StorageManager is missing", async () => {
    const { port } = fakeCaches({});
    const inventory = await readStorageInventory({ caches: port });
    expect(inventory.estimate.available).toBe(false);
    expect(inventory.estimate.canRequestPersistence).toBe(false);
  });

  it("records foreign cache keys as unknown without classifying them", async () => {
    const { port } = fakeCaches({ "third-party-cache": [] });
    const inventory = await readStorageInventory({ caches: port });
    expect(inventory.unknownCacheKeys).toContain("third-party-cache");
  });
});

describe("clearCacheNamespace", () => {
  it("deletes only the matching clearable caches", async () => {
    const { port, deleted } = fakeCaches({
      "workbox-precache-v2-app": [],
      "financial-intelligence-model-a": [],
      "financial-intelligence-model-b": [],
    });
    const removed = await clearCacheNamespace("model", { caches: port });
    expect(removed).toHaveLength(2);
    expect(deleted).toEqual(
      expect.arrayContaining(["financial-intelligence-model-a", "financial-intelligence-model-b"]),
    );
    expect(deleted).not.toContain("workbox-precache-v2-app");
  });

  it("refuses to clear the protected app-shell namespace", async () => {
    const { port } = fakeCaches({ "workbox-precache-v2-app": [] });
    await expect(clearCacheNamespace("app-shell", { caches: port })).rejects.toThrow();
  });
});

describe("requestPersistentStorage", () => {
  it("returns the granted state when supported", async () => {
    const deps: StorageInventoryDependencies = {
      storage: { persist: () => Promise.resolve(true) },
    };
    expect(await requestPersistentStorage(deps)).toBe(true);
  });

  it("returns undefined when unsupported", async () => {
    const persist = vi.fn();
    void persist;
    expect(await requestPersistentStorage({ storage: {} })).toBeUndefined();
  });
});
