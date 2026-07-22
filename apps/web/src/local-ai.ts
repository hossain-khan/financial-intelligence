import {
  CLASSIFIER_PROFILE,
  ModelSideloader,
  detectCapability,
  downloadModel,
  readyCacheName,
  stagingCacheName,
  type CacheLike,
  type CapabilityReport,
  type DownloadProgress,
  type ModelProfile,
  type SideloadFile,
} from "@financial-intelligence/ai-local";

export const LOCAL_AI_PROFILE: ModelProfile = CLASSIFIER_PROFILE;

/** Capability preflight against the real browser environment. */
export function readLocalAiCapability(): Promise<CapabilityReport> {
  const gpu = (navigator as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  return detectCapability(
    {
      isSecureContext: globalThis.isSecureContext,
      hasWorker: typeof Worker !== "undefined",
      ...(gpu === undefined ? {} : { gpu }),
      estimateStorage: () =>
        navigator.storage?.estimate?.() ?? Promise.resolve({ usage: undefined, quota: undefined }),
    },
    LOCAL_AI_PROFILE,
  );
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Adapts the browser `caches` global to the sideloader's minimal port. */
function browserCache(): CacheLike {
  return {
    open: async (name) => {
      const cache = await caches.open(name);
      return {
        put: (key, bytes) => cache.put(key, new Response(bytes)),
        match: async (key) => {
          const response = await cache.match(key);
          return response === undefined ? undefined : await response.arrayBuffer();
        },
      };
    },
    delete: (name) => caches.delete(name),
    keys: () => caches.keys(),
  };
}

export interface SideloadOutcome {
  readonly ready: boolean;
  readonly error?: string;
}

/** Verify + stage + publish user-selected model files into the model cache. */
export async function sideloadModelFiles(
  fileList: readonly File[],
  onProgress?: (done: number, total: number) => void,
): Promise<SideloadOutcome> {
  const loader = new ModelSideloader(browserCache(), sha256Hex);
  try {
    const files: SideloadFile[] = await Promise.all(
      fileList.map(async (file) => ({
        // Prefer the relative path from a folder pick (e.g. "onnx/embed_tokens_q4.onnx"); the
        // sideloader matches by basename either way.
        path: file.webkitRelativePath.length > 0 ? file.webkitRelativePath : file.name,
        bytes: await file.arrayBuffer(),
      })),
    );
    await loader.sideload(LOCAL_AI_PROFILE, files, onProgress);
    return { ready: true };
  } catch (error) {
    return { ready: false, error: error instanceof Error ? error.message : "Sideload failed." };
  }
}

export function isModelReady(): Promise<boolean> {
  return new ModelSideloader(browserCache(), sha256Hex).isReady(LOCAL_AI_PROFILE);
}

export type ModelState = "not-downloaded" | "ready" | "incomplete";

/**
 * Whether the pinned model is fully cached, partially downloaded (interrupted), or absent. Drives
 * the panel's primary state without any network access.
 */
export async function readModelState(): Promise<ModelState> {
  if (await isModelReady()) return "ready";
  const names = await caches.keys();
  return names.includes(stagingCacheName(LOCAL_AI_PROFILE.profileId))
    ? "incomplete"
    : "not-downloaded";
}

/**
 * One-click acquisition: fetch the pinned files from the allow-listed host, verify digests, and
 * publish to the model cache. This is the only code path that touches the network; inference runs
 * from cache with the runtime's remote fetching disabled (see the worker engine).
 */
export async function downloadPinnedModel(
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<SideloadOutcome> {
  try {
    await downloadModel(LOCAL_AI_PROFILE, {
      cache: browserCache(),
      fetch: fetch.bind(globalThis),
      ...(onProgress ? { onProgress } : {}),
      ...(signal ? { signal } : {}),
    });
    return { ready: true };
  } catch (error) {
    return { ready: false, error: error instanceof Error ? error.message : "Download failed." };
  }
}

export { readyCacheName, stagingCacheName };
