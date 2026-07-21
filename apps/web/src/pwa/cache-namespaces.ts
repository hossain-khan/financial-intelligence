/**
 * Versioned Cache Storage namespace contract. This is the shared vocabulary the app-shell cache,
 * the future model cache (#38), and the optional source-file cache (source retention) all agree on,
 * so an inventory or a targeted clear can reason about disposable artifacts without ever touching
 * canonical financial data.
 *
 * Canonical financial data lives in IndexedDB ONLY and is never represented here. A generic
 * "clear cache" action operates on these namespaces exclusively; deleting a workspace uses the
 * existing explicit deletion workflow.
 */
export type CacheCategory = "app-shell" | "model" | "source";

export interface CacheNamespace {
  readonly category: CacheCategory;
  readonly label: string;
  readonly description: string;
  /**
   * Whether this app clears the namespace as a disposable artifact. The app shell is protected: it
   * is the only copy needed to recover offline, so it is reported but excluded from a blanket clear.
   */
  readonly clearable: boolean;
  /** Matches a live Cache Storage key to this namespace. */
  matches(cacheKey: string): boolean;
}

// Workbox names its precache `workbox-precache-v2-<scope>`; the runtime uses the configured prefix.
const APP_SHELL_PATTERNS = [/^workbox-precache/u, /^financial-intelligence-app-/u];
const MODEL_PREFIX = "financial-intelligence-model-";
const SOURCE_PREFIX = "financial-intelligence-source-";

export const CACHE_NAMESPACES: readonly CacheNamespace[] = Object.freeze([
  {
    category: "app-shell",
    label: "Application shell",
    description:
      "Versioned app code, styles, and offline shell. Kept so the app opens without a network; refreshed automatically on update.",
    clearable: false,
    matches: (key) => APP_SHELL_PATTERNS.some((pattern) => pattern.test(key)),
  },
  {
    category: "model",
    label: "AI model files",
    description:
      "Optional local model artifacts you choose to download. Safe to clear; models can be re-downloaded when used.",
    clearable: true,
    matches: (key) => key.startsWith(MODEL_PREFIX),
  },
  {
    category: "source",
    label: "Retained source files",
    description:
      "Original statement files you explicitly chose to keep. Safe to clear; canonical transactions already committed are unaffected.",
    clearable: true,
    matches: (key) => key.startsWith(SOURCE_PREFIX),
  },
]);

/** The namespace a live cache key belongs to, or undefined if it is not one of ours. */
export function classifyCacheKey(cacheKey: string): CacheNamespace | undefined {
  return CACHE_NAMESPACES.find((namespace) => namespace.matches(cacheKey));
}
