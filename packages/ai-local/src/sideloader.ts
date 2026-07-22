import {
  SideloadError,
  readyCacheName,
  stagingCacheName,
  type CacheLike,
  type CacheStoreLike,
} from "./model-cache";
import type { ModelProfile } from "./model-profile";
import { publishStagingToReady } from "./model-store";

export { SideloadError };
export type { CacheLike, CacheStoreLike };

export interface SideloadFile {
  readonly path: string;
  readonly bytes: ArrayBuffer;
}

/**
 * Seeds the model cache from user-selected local files. Every file is matched to the pinned profile
 * and SHA-256 verified before anything is published: an unexpected, missing, or mismatched file
 * rejects the whole acquisition. Verified bytes are staged, then copied atomically into the ready
 * cache; the incomplete staging generation is always cleaned up. No network is involved.
 */
export class ModelSideloader {
  public constructor(
    private readonly cache: CacheLike,
    private readonly digest: (bytes: ArrayBuffer) => Promise<string>,
  ) {}

  public async sideload(
    profile: ModelProfile,
    files: readonly SideloadFile[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<void> {
    // Match by basename so a user can select the model files (or a whole folder) without needing to
    // reproduce the profile's `onnx/` subfolder layout. Profile paths keep their subfolder for the
    // cache key the runtime requests; picked files carry a bare name or a relative path.
    const expected = new Map(profile.files.map((file) => [basename(file.path), file]));
    if (expected.size !== profile.files.length) {
      throw new SideloadError("PROFILE_INVALID", "Profile has duplicate file basenames.");
    }
    const provided = new Map(files.map((file) => [basename(file.path), file]));

    for (const name of provided.keys()) {
      if (!expected.has(name)) {
        throw new SideloadError("UNEXPECTED_FILE", `Unexpected file: ${name}`);
      }
    }
    for (const [name, spec] of expected) {
      if (!provided.has(name))
        throw new SideloadError("MISSING_FILE", `Missing file: ${spec.path}`);
    }

    const staging = await this.cache.open(stagingCacheName(profile.profileId));
    let done = 0;
    for (const spec of profile.files) {
      const file = provided.get(basename(spec.path));
      if (file === undefined) throw new SideloadError("MISSING_FILE", `Missing file: ${spec.path}`);
      const actual = await this.digest(file.bytes);
      if (actual !== spec.sha256) {
        await this.cache.delete(stagingCacheName(profile.profileId));
        throw new SideloadError("DIGEST_MISMATCH", `Digest mismatch for ${spec.path}`);
      }
      await staging.put(spec.path, file.bytes);
      done += 1;
      onProgress?.(done, profile.files.length);
    }

    await publishStagingToReady(
      this.cache,
      profile.profileId,
      profile.files.map((file) => file.path),
    );
  }

  public async isReady(profile: ModelProfile): Promise<boolean> {
    const keys = await this.cache.keys();
    if (!keys.includes(readyCacheName(profile.profileId))) return false;
    const ready = await this.cache.open(readyCacheName(profile.profileId));
    for (const spec of profile.files) {
      if ((await ready.match(spec.path)) === undefined) return false;
    }
    return profile.files.length > 0;
  }
}

/** The final path segment, so `onnx/embed_tokens_q4.onnx` and `embed_tokens_q4.onnx` compare equal. */
function basename(path: string): string {
  const segments = path.split(/[/\\]/u);
  return segments[segments.length - 1] ?? path;
}
