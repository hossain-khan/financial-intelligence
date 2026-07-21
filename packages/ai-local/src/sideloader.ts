import { readyCacheName, stagingCacheName } from "./model-cache";
import type { ModelProfile } from "./model-profile";

export interface CacheStoreLike {
  put(key: string, bytes: ArrayBuffer): Promise<void>;
  match(key: string): Promise<ArrayBuffer | undefined>;
}
export interface CacheLike {
  open(name: string): Promise<CacheStoreLike>;
  delete(name: string): Promise<boolean>;
  keys(): Promise<string[]>;
}
export interface SideloadFile {
  readonly path: string;
  readonly bytes: ArrayBuffer;
}

export class SideloadError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SideloadError";
  }
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
    const expected = new Map(profile.files.map((file) => [file.path, file]));
    const provided = new Map(files.map((file) => [file.path, file]));

    for (const file of files) {
      if (!expected.has(file.path)) {
        throw new SideloadError("UNEXPECTED_FILE", `Unexpected file: ${file.path}`);
      }
    }
    for (const path of expected.keys()) {
      if (!provided.has(path)) throw new SideloadError("MISSING_FILE", `Missing file: ${path}`);
    }

    const staging = await this.cache.open(stagingCacheName(profile.profileId));
    let done = 0;
    for (const spec of profile.files) {
      const file = provided.get(spec.path);
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

    const ready = await this.cache.open(readyCacheName(profile.profileId));
    for (const spec of profile.files) {
      const bytes = await staging.match(spec.path);
      if (bytes === undefined) {
        throw new SideloadError("STAGING_LOST", `Staged file lost: ${spec.path}`);
      }
      await ready.put(spec.path, bytes);
    }
    await this.cache.delete(stagingCacheName(profile.profileId));
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
