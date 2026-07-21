import { describe, expect, it } from "vitest";

import { MODEL_CACHE_PREFIX, readyCacheName, stagingCacheName } from "./model-cache";

describe("model cache keys", () => {
  it("names ready and staging caches in the model namespace", () => {
    expect(readyCacheName("p1")).toBe(`${MODEL_CACHE_PREFIX}p1`);
    expect(stagingCacheName("p1")).toBe(`${MODEL_CACHE_PREFIX}p1-staging`);
    expect(readyCacheName("p1").startsWith(MODEL_CACHE_PREFIX)).toBe(true);
  });
});
