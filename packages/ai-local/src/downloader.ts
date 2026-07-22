import { SideloadError, stagingCacheName, type CacheLike } from "./model-cache";
import type { ModelProfile } from "./model-profile";
import {
  createSha256Hasher,
  publishStagingToReady,
  stageVerifiedStream,
  type IncrementalHasher,
} from "./model-store";

export type DownloadErrorCode =
  | "network"
  | "digest_mismatch"
  | "too_large"
  | "cancelled"
  | "insufficient_storage"
  | "profile_invalid";

export class DownloadError extends Error {
  public constructor(
    public readonly code: DownloadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DownloadError";
  }
}

export interface DownloadProgress {
  readonly file: string;
  readonly fileBytes: number;
  readonly fileTotal: number;
  readonly overallBytes: number;
  readonly overallTotal: number;
}

export interface DownloadDeps {
  readonly cache: CacheLike;
  readonly fetch: typeof fetch;
  readonly onProgress?: (progress: DownloadProgress) => void;
  readonly signal?: AbortSignal;
  readonly createHasher?: () => Promise<IncrementalHasher>;
}

/** The pinned, immutable-revision resolve URL for a model file. */
export function modelFileUrl(profile: ModelProfile, path: string): string {
  return `https://huggingface.co/${profile.modelRepo}/resolve/${profile.modelRevision}/${path}`;
}

/**
 * Download every pinned file sequentially from the allow-listed host, streaming each into the staging
 * cache while verifying its SHA-256, then atomically publish to the ready model cache. A failure or
 * cancellation aborts the whole acquisition and deletes staging. Never buffers more than one file's
 * chunks at a time and never holds a partial download in the ready cache.
 */
export async function downloadModel(profile: ModelProfile, deps: DownloadDeps): Promise<void> {
  if (profile.files.length === 0) {
    throw new DownloadError("profile_invalid", "Model profile has no files to download.");
  }
  const createHasher = deps.createHasher ?? createSha256Hasher;
  let overallBase = 0;
  try {
    for (const spec of profile.files) {
      if (deps.signal?.aborted === true) throw new SideloadError("CANCELLED", "cancelled");

      let response: Response;
      try {
        response = await deps.fetch(modelFileUrl(profile, spec.path), {
          ...(deps.signal ? { signal: deps.signal } : {}),
        });
      } catch {
        throw new DownloadError("network", `Could not reach the model host for ${spec.path}.`);
      }
      if (!response.ok || response.body === null) {
        throw new DownloadError("network", `Download failed (${response.status}) for ${spec.path}.`);
      }

      const base = overallBase;
      await stageVerifiedStream({
        cache: deps.cache,
        profileId: profile.profileId,
        spec,
        body: response.body,
        createHasher,
        ...(deps.signal ? { signal: deps.signal } : {}),
        onProgress: (fileBytes) =>
          deps.onProgress?.({
            file: spec.path,
            fileBytes,
            fileTotal: spec.byteSize,
            overallBytes: base + fileBytes,
            overallTotal: profile.totalByteSize,
          }),
      });
      overallBase = base + spec.byteSize;
    }
    await publishStagingToReady(
      deps.cache,
      profile.profileId,
      profile.files.map((file) => file.path),
    );
  } catch (error) {
    await deps.cache.delete(stagingCacheName(profile.profileId)).catch(() => undefined);
    throw toDownloadError(error);
  }
}

function toDownloadError(error: unknown): DownloadError {
  if (error instanceof DownloadError) return error;
  if (error instanceof SideloadError) {
    const mapped: Record<string, DownloadErrorCode> = {
      DIGEST_MISMATCH: "digest_mismatch",
      TOO_LARGE: "too_large",
      CANCELLED: "cancelled",
    };
    return new DownloadError(mapped[error.code] ?? "network", error.message);
  }
  return new DownloadError("network", "Download failed.");
}
