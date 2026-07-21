import {
  CACHE_NAMESPACES,
  classifyCacheKey,
  type CacheCategory,
  type CacheNamespace,
} from "./cache-namespaces";

export interface StorageEstimateReport {
  /** True only when the browser exposes `navigator.storage.estimate()`. */
  readonly available: boolean;
  readonly usageBytes?: number;
  readonly quotaBytes?: number;
  /** `navigator.storage.persisted()` result, or undefined when unsupported. */
  readonly persisted?: boolean;
  /** Whether a persistence request can be offered. */
  readonly canRequestPersistence: boolean;
}

export interface CacheNamespaceReport {
  readonly category: CacheCategory;
  readonly label: string;
  readonly description: string;
  readonly clearable: boolean;
  readonly cacheKeys: readonly string[];
  readonly itemCount: number;
  /** Sum of `Content-Length` across cached responses; a lower bound when some responses omit it. */
  readonly approximateBytes: number;
  readonly bytesAreApproximate: boolean;
}

export interface StorageInventory {
  readonly estimate: StorageEstimateReport;
  readonly namespaces: readonly CacheNamespaceReport[];
  /** Live cache keys that match none of our namespaces; reported but never auto-cleared. */
  readonly unknownCacheKeys: readonly string[];
}

/**
 * Minimal Cache Storage surface we depend on, so tests can inject a fake without a real browser.
 */
export interface CacheStoragePort {
  keys(): Promise<string[]>;
  open(cacheKey: string): Promise<CacheLikePort>;
  delete(cacheKey: string): Promise<boolean>;
}

export interface CacheLikePort {
  keys(): Promise<readonly RequestLike[]>;
  match(request: RequestLike): Promise<ResponseLike | undefined>;
}

export interface RequestLike {
  readonly url: string;
}

export interface ResponseLike {
  readonly headers: { get(name: string): string | null };
}

export interface StorageManagerPort {
  estimate?(): Promise<{ usage?: number; quota?: number }>;
  persisted?(): Promise<boolean>;
  persist?(): Promise<boolean>;
}

export interface StorageInventoryDependencies {
  readonly caches?: CacheStoragePort;
  readonly storage?: StorageManagerPort;
}

/** Build a dependency bundle from real browser globals, omitting anything unsupported. */
export function browserStorageDependencies(): StorageInventoryDependencies {
  const deps: { caches?: CacheStoragePort; storage?: StorageManagerPort } = {};
  if (typeof caches !== "undefined") {
    deps.caches = {
      keys: () => caches.keys(),
      open: async (key) => {
        const cache = await caches.open(key);
        return {
          keys: () => cache.keys(),
          match: (request) => cache.match(request.url),
        };
      },
      delete: (key) => caches.delete(key),
    };
  }
  if (typeof navigator !== "undefined" && "storage" in navigator) {
    deps.storage = navigator.storage;
  }
  return deps;
}

/**
 * Read the storage estimate, persistence status, and per-namespace cache inventory. Every browser
 * capability is optional: an unsupported API yields `available: false` rather than throwing, so the
 * settings UI can present accurate "not available in this browser" states.
 */
export async function readStorageInventory(
  deps: StorageInventoryDependencies = browserStorageDependencies(),
): Promise<StorageInventory> {
  const estimate = await readEstimate(deps.storage);
  const { namespaces, unknownCacheKeys } = await readCaches(deps.caches);
  return { estimate, namespaces, unknownCacheKeys };
}

/**
 * Clear one clearable namespace, returning the removed cache keys. The app shell is never cleared
 * (it is the offline recovery copy), and IndexedDB / exports are never touched by this path.
 */
export async function clearCacheNamespace(
  category: CacheCategory,
  deps: StorageInventoryDependencies = browserStorageDependencies(),
): Promise<readonly string[]> {
  const namespace = CACHE_NAMESPACES.find((entry) => entry.category === category);
  if (namespace === undefined || !namespace.clearable) {
    throw new Error(`The ${category} cache cannot be cleared from here.`);
  }
  if (deps.caches === undefined) return [];
  const keys = await deps.caches.keys();
  const matching = keys.filter((key) => namespace.matches(key));
  await Promise.all(matching.map((key) => deps.caches?.delete(key)));
  return matching;
}

/** Request durable persistence where supported; returns the granted state or undefined. */
export async function requestPersistentStorage(
  deps: StorageInventoryDependencies = browserStorageDependencies(),
): Promise<boolean | undefined> {
  if (deps.storage?.persist === undefined) return undefined;
  return deps.storage.persist();
}

async function readEstimate(
  storage: StorageManagerPort | undefined,
): Promise<StorageEstimateReport> {
  if (storage?.estimate === undefined) {
    return { available: false, canRequestPersistence: false };
  }
  const estimate = await storage.estimate();
  const persisted = storage.persisted === undefined ? undefined : await storage.persisted();
  return {
    available: true,
    ...(estimate.usage === undefined ? {} : { usageBytes: estimate.usage }),
    ...(estimate.quota === undefined ? {} : { quotaBytes: estimate.quota }),
    ...(persisted === undefined ? {} : { persisted }),
    canRequestPersistence: storage.persist !== undefined && persisted !== true,
  };
}

async function readCaches(
  cacheStorage: CacheStoragePort | undefined,
): Promise<{ namespaces: readonly CacheNamespaceReport[]; unknownCacheKeys: readonly string[] }> {
  const reports = new Map<CacheCategory, MutableReport>();
  for (const namespace of CACHE_NAMESPACES) reports.set(namespace.category, emptyReport(namespace));
  const unknownCacheKeys: string[] = [];

  if (cacheStorage === undefined) {
    return { namespaces: finalize(reports), unknownCacheKeys };
  }

  const keys = await cacheStorage.keys();
  for (const key of keys) {
    const namespace = classifyCacheKey(key);
    if (namespace === undefined) {
      unknownCacheKeys.push(key);
      continue;
    }
    const report = reports.get(namespace.category);
    if (report === undefined) continue;
    report.cacheKeys.push(key);
    await accumulateCache(cacheStorage, key, report);
  }

  return { namespaces: finalize(reports), unknownCacheKeys };
}

interface MutableReport {
  readonly namespace: CacheNamespace;
  readonly cacheKeys: string[];
  itemCount: number;
  approximateBytes: number;
  bytesAreApproximate: boolean;
}

function emptyReport(namespace: CacheNamespace): MutableReport {
  return {
    namespace,
    cacheKeys: [],
    itemCount: 0,
    approximateBytes: 0,
    bytesAreApproximate: false,
  };
}

async function accumulateCache(
  cacheStorage: CacheStoragePort,
  key: string,
  report: MutableReport,
): Promise<void> {
  const cache = await cacheStorage.open(key);
  const requests = await cache.keys();
  report.itemCount += requests.length;
  for (const request of requests) {
    const response = await cache.match(request);
    const length = response?.headers.get("content-length");
    const parsed = length === null || length === undefined ? Number.NaN : Number(length);
    if (Number.isFinite(parsed)) report.approximateBytes += parsed;
    else report.bytesAreApproximate = true;
  }
}

function finalize(reports: Map<CacheCategory, MutableReport>): readonly CacheNamespaceReport[] {
  return [...reports.values()].map((report) => ({
    category: report.namespace.category,
    label: report.namespace.label,
    description: report.namespace.description,
    clearable: report.namespace.clearable,
    cacheKeys: report.cacheKeys,
    itemCount: report.itemCount,
    approximateBytes: report.approximateBytes,
    bytesAreApproximate: report.bytesAreApproximate,
  }));
}
