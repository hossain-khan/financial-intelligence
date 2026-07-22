import { createSHA256 } from "hash-wasm";

import {
  SideloadError,
  readyCacheName,
  stagingCacheName,
  type CacheLike,
} from "./model-cache";
import type { ModelProfileFile } from "./model-profile";

/** Minimal incremental SHA-256 over streamed chunks (Web Crypto's digest is one-shot only). */
export interface IncrementalHasher {
  update(data: Uint8Array): void;
  digestHex(): string;
}

export async function createSha256Hasher(): Promise<IncrementalHasher> {
  const hasher = await createSHA256();
  hasher.init();
  return {
    update: (data) => hasher.update(data),
    digestHex: () => hasher.digest("hex"),
  };
}

export interface StageStreamDeps {
  readonly cache: CacheLike;
  readonly profileId: string;
  readonly spec: ModelProfileFile;
  readonly body: ReadableStream<Uint8Array>;
  readonly createHasher: () => Promise<IncrementalHasher>;
  readonly onProgress?: (fileBytes: number) => void;
  readonly signal?: AbortSignal;
}

/**
 * Stream a response body into the staging cache while hashing it incrementally, so a large weight
 * file is never hashed from a second full copy. The declared `byteSize` is a hard ceiling and the
 * digest is checked against the pinned profile before the entry is accepted. Throws `SideloadError`
 * with a stable code on mismatch, oversize, or cancellation.
 */
export async function stageVerifiedStream(deps: StageStreamDeps): Promise<void> {
  const { cache, profileId, spec, body, onProgress, signal } = deps;
  const hasher = await deps.createHasher();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = body.getReader();
  try {
    for (;;) {
      if (signal?.aborted === true) throw new SideloadError("CANCELLED", "Download cancelled");
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > spec.byteSize) {
        throw new SideloadError("TOO_LARGE", `File exceeds declared size: ${spec.path}`);
      }
      hasher.update(value);
      chunks.push(value);
      onProgress?.(total);
    }
  } finally {
    reader.releaseLock();
  }
  if (hasher.digestHex() !== spec.sha256) {
    throw new SideloadError("DIGEST_MISMATCH", `Digest mismatch for ${spec.path}`);
  }
  const staging = await cache.open(stagingCacheName(profileId));
  await staging.put(spec.path, concat(chunks, total));
}

/**
 * Atomically publish every staged file into the ready cache, then drop staging. Shared by the
 * downloader and the sideloader so both agree on cache keys and the publish step.
 */
export async function publishStagingToReady(
  cache: CacheLike,
  profileId: string,
  paths: readonly string[],
): Promise<void> {
  const staging = await cache.open(stagingCacheName(profileId));
  const ready = await cache.open(readyCacheName(profileId));
  for (const path of paths) {
    const bytes = await staging.match(path);
    if (bytes === undefined) throw new SideloadError("STAGING_LOST", `Staged file lost: ${path}`);
    await ready.put(path, bytes);
  }
  await cache.delete(stagingCacheName(profileId));
}

function concat(chunks: readonly Uint8Array[], total: number): ArrayBuffer {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}
