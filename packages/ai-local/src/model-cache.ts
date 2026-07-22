/**
 * Cache Storage key helpers for local model artifacts. These live in the app's `model` namespace
 * (prefix `financial-intelligence-model-`, declared clearable in apps/web/src/pwa/cache-namespaces),
 * so the existing storage inventory, a targeted clear, and #38's per-model removal all reach them
 * without touching the app shell or canonical IndexedDB.
 */
export const MODEL_CACHE_PREFIX = "financial-intelligence-model-";

/** The published, ready-to-load cache for a profile. */
export function readyCacheName(profileId: string): string {
  return `${MODEL_CACHE_PREFIX}${profileId}`;
}

/** The staging cache used while verifying an incomplete acquisition; never loaded from. */
export function stagingCacheName(profileId: string): string {
  return `${MODEL_CACHE_PREFIX}${profileId}-staging`;
}

/**
 * Minimal Cache Storage port. The real browser `caches` global is adapted to it in the app layer;
 * tests inject an in-memory implementation. Defined on this leaf module so the sideloader, the
 * streaming model-store, and the downloader can share it without an import cycle.
 */
export interface CacheStoreLike {
  put(key: string, bytes: ArrayBuffer): Promise<void>;
  match(key: string): Promise<ArrayBuffer | undefined>;
}
export interface CacheLike {
  open(name: string): Promise<CacheStoreLike>;
  delete(name: string): Promise<boolean>;
  keys(): Promise<string[]>;
}

/** Stable-coded error for model acquisition (sideload and download share it). */
export class SideloadError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SideloadError";
  }
}
