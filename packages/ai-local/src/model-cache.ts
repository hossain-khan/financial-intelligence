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
