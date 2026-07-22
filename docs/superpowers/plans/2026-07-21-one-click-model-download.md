# One-click browser-local model download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user download and run the pinned browser-local model with one click — streamed, digest-verified, cached — while keeping the app offline-first everywhere else. Supersede ADR-020's sideload-only stance (ADR-021), tighten the CSP to Hugging Face hosts only, and give the Settings panel real download progress + a cached/ready indicator. Fold in and close #95.

**Architecture:** A new `ModelDownloader` in `packages/ai-local` fetches each pinned file sequentially, streams it into a staging Cache Storage entry while incrementally SHA-256-hashing it (`hash-wasm`), verifies against the pinned profile, then atomically publishes to the ready model cache — never buffering a ~1.6 GB file whole. `env.allowRemoteModels` is enabled only during the download and disabled for load/inference. `LocalAiPanel` gains a one-click primary flow with per-file + overall progress and a ready/cached state; sideload is demoted to a secondary "advanced" disclosure.

**Tech Stack:** TypeScript (strict), Vitest, React 19 + react-aria-components, Cache Storage, `hash-wasm` (incremental SHA-256), `@huggingface/transformers` (unchanged), Playwright.

## Global Constraints

- Node 24 (`nvm use 24`); pnpm; after any `pnpm install` run `pnpm exec prettier --write pnpm-lock.yaml` to keep the lockfile diff minimal.
- Offline-first invariant: the default path (startup, imports, rules, ledger, dashboards, AI inference) makes ZERO network requests. Only the explicit "Download model" action contacts the allow-listed hosts.
- `connect-src` allow-lists ONLY `'self' https://huggingface.co https://*.hf.co` — nothing broader. The header check must fail if it is broadened.
- Every downloaded file is SHA-256-verified against the pinned `CLASSIFIER_PROFILE` before publish; a mismatch aborts the whole acquisition and cleans up staging.
- Never buffer a full weight file (~1.6 GB) in memory — stream to cache with incremental hashing.
- `env.allowRemoteModels` is `true` only during the download phase; `false` for load/warmup/execute.
- Runtime import stays worker-only (existing boundary test must keep passing).
- Model output remains strict-validated (unchanged).
- Commits: no `Co-Authored-By` trailer. Canonical test: `pnpm test:coverage`.
- Full gate before PR: `pnpm typescript:check && pnpm format:check && pnpm lint && pnpm schema:check && pnpm typecheck && pnpm test:coverage && pnpm build && pnpm security:headers:check -- apps/web/dist/_headers && pnpm audit --audit-level high`, plus `pnpm browser:test` (worker/UI/network change → all three browsers).

## Verified facts (from spike + repo inspection)

- HF `resolve/<rev>/<path>` → same-origin redirect to `huggingface.co/api/resolve-cache/…`; weight bytes → region-specific `*.hf.co` Xet CDN (e.g. `us.aws.cdn.hf.co`). Hence the `*.hf.co` wildcard.
- `hash-wasm@4.12.0` is already a dependency of `packages/backup`; it exports `createSHA256(): Promise<IHasher>` with `.init()/.update(data)/.digest("hex")` for incremental hashing.
- `apps/web/scripts/check-security-headers.mjs` substring-matches CSP directives (needs tightening).
- Existing pieces to reuse/refactor: `packages/ai-local/src/sideloader.ts` (staging/publish/cache-key pattern, `SideloadError`), `src/model-cache.ts` (`readyCacheName`/`stagingCacheName`), `apps/web/src/local-ai.ts` (browser cache adapter + `sha256Hex`), `apps/web/src/LocalAiPanel.tsx`.

---

## File Structure

**`packages/ai-local/`:**
- Create `src/model-store.ts` — a small shared helper: staging/ready cache-key publish + cleanup, and a streaming `writeVerifiedFileToStaging(cache, stagingName, spec, stream, hasher, onProgress)`. Extracted so downloader + sideloader agree on cache mechanics.
- Create `src/downloader.ts` — `ModelDownloader` (+ `DownloadError`).
- Create `src/downloader.test.ts`.
- Modify `src/sideloader.ts` — reuse the shared publish helper (behavior unchanged).
- Modify `src/index.ts`, `package.json` (add `hash-wasm`).

**`apps/web/`:**
- Modify `public/_headers` (CSP connect-src).
- Modify `scripts/check-security-headers.mjs` (assert exact connect-src token set).
- Modify `src/local-ai.ts` (add `downloadModel` glue + `modelState()` returning not-downloaded/ready/incomplete).
- Modify `src/LocalAiPanel.tsx` + `LocalAiPanel.test.tsx` (one-click flow, progress, cached state, sideload demoted).
- Modify `e2e/ai-local-offline.spec.ts` or add `e2e/ai-local-download.spec.ts`.

**Docs:** `docs/adr/ADR-021-One-Click-Model-Download.md`; modify `docs/adr/ADR-020-Browser-Local-AI-Runtime.md` (status → superseded), `docs/adr/README.md`, `docs/12-SECURITY-AND-PRIVACY.md`, `docs/08-AI-ARCHITECTURE.md`, `docs/16-TECHNOLOGY-STACK.md`, `docs/ai-evaluation-baseline.md`, `CHANGELOG.md`, `docs/15-ROADMAP.md`.

---

## Task 1: CSP allow-list + tightened header check

**Files:** Modify `apps/web/public/_headers`, `apps/web/scripts/check-security-headers.mjs`; add `apps/web/scripts/check-security-headers.test.mjs` (or a vitest test).

- [ ] **Step 1: Update the CSP header**

In `apps/web/public/_headers`, change the `connect-src` directive:

```
connect-src 'self' https://huggingface.co https://*.hf.co
```

Leave every other directive unchanged.

- [ ] **Step 2: Tighten the header-check script**

In `apps/web/scripts/check-security-headers.mjs`, replace the substring check for `connect-src 'self'` with an exact token-set assertion. Parse the CSP, find the `connect-src` directive, and assert its sources equal exactly `['self'` (quoted), `https://huggingface.co`, `https://*.hf.co]`. Keep the other directive checks as-is.

```js
// Replace "connect-src 'self'" in requiredCspDirectives with an explicit connect-src check:
const cspLine = source.split("\n").find((l) => l.includes("Content-Security-Policy:")) ?? "";
const connectMatch = /connect-src ([^;]+)/u.exec(cspLine);
if (connectMatch === null) throw new Error("connect-src directive is missing");
const sources = connectMatch[1].trim().split(/\s+/u).sort();
const allowed = ["'self'", "https://*.hf.co", "https://huggingface.co"].sort();
if (sources.length !== allowed.length || sources.some((s, i) => s !== allowed[i])) {
  throw new Error(`connect-src must be exactly ${allowed.join(" ")} — found: ${connectMatch[1].trim()}`);
}
```

Remove `"connect-src 'self'"` from the `requiredCspDirectives` array (now covered by the exact check).

- [ ] **Step 3: Verify**

Run: `nvm use 24 && pnpm build && pnpm security:headers:check -- apps/web/dist/_headers`
Expected: passes. Then hand-test failure: temporarily add `https://evil.example` to the header, re-run, confirm it throws; revert.

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/_headers apps/web/scripts/
git commit -m "Allow-list Hugging Face model hosts in connect-src, tighten header check

Refs #33"
```

---

## Task 2: Shared model-store helper + streaming write

**Files:** Create `packages/ai-local/src/model-store.ts`, `src/model-store.test.ts`; modify `package.json` (add `hash-wasm`), `src/sideloader.ts` to use it.

**Interfaces:**
- Produces:
  - `interface StreamSink { write(chunk: Uint8Array): Promise<void> }` (internal)
  - `async function publishStagingToReady(cache: CacheLike, profileId: string, paths: readonly string[]): Promise<void>` — copies staging→ready, deletes staging (the atomic-publish step both paths share).
  - `async function stageVerifiedStream(deps: { cache: CacheLike; profileId: string; spec: ModelProfileFile; body: ReadableStream<Uint8Array>; createHasher: () => Promise<IncrementalHasher>; onProgress?: (fileBytes: number) => void; signal?: AbortSignal }): Promise<void>` — streams the body into the staging cache entry keyed by `spec.path`, updates the hash per chunk, enforces `spec.byteSize` as a ceiling, and throws `SideloadError("DIGEST_MISMATCH"|"TOO_LARGE"|"CANCELLED")` on failure.
  - `interface IncrementalHasher { update(data: Uint8Array): void; digestHex(): string }` — thin wrapper over hash-wasm's `IHasher`.
  - `async function createSha256Hasher(): Promise<IncrementalHasher>`.
- Consumes: `CacheLike`, `readyCacheName`, `stagingCacheName`, `SideloadError`, `ModelProfileFile`.

- [ ] **Step 1: Add hash-wasm dependency**

In `packages/ai-local/package.json` add `"hash-wasm": "4.12.0"` to `dependencies`. Run `nvm use 24 && pnpm install && pnpm exec prettier --write pnpm-lock.yaml`.

- [ ] **Step 2: Write the failing test**

Create `src/model-store.test.ts` (using the in-memory `CacheLike` from the sideloader test pattern):

```ts
import { describe, expect, it } from "vitest";
import { createSha256Hasher, publishStagingToReady, stageVerifiedStream } from "./model-store";
import { readyCacheName, stagingCacheName } from "./model-cache";
import { SideloadError, type CacheLike, type CacheStoreLike } from "./sideloader";

function memoryCache() {
  const stores = new Map<string, Map<string, ArrayBuffer>>();
  const cache: CacheLike = {
    open: (name) => {
      const store = stores.get(name) ?? new Map<string, ArrayBuffer>();
      stores.set(name, store);
      return Promise.resolve({
        put: (k: string, b: ArrayBuffer) => { store.set(k, b); return Promise.resolve(); },
        match: (k: string) => Promise.resolve(store.get(k)),
      } satisfies CacheStoreLike);
    },
    delete: (name) => Promise.resolve(stores.delete(name)),
    keys: () => Promise.resolve([...stores.keys()]),
  };
  return { cache, stores };
}
function streamOf(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } });
}
async function realSha(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("stageVerifiedStream", () => {
  it("streams a matching file into staging", async () => {
    const { cache, stores } = memoryCache();
    const sha256 = await realSha("HELLO");
    await stageVerifiedStream({
      cache, profileId: "p1",
      spec: { path: "a.bin", sha256, byteSize: 5 },
      body: streamOf("HELLO"), createHasher: createSha256Hasher,
    });
    expect(stores.get(stagingCacheName("p1"))?.has("a.bin")).toBe(true);
  });

  it("throws DIGEST_MISMATCH when the hash differs", async () => {
    const { cache } = memoryCache();
    await expect(stageVerifiedStream({
      cache, profileId: "p1",
      spec: { path: "a.bin", sha256: "0".repeat(64), byteSize: 5 },
      body: streamOf("HELLO"), createHasher: createSha256Hasher,
    })).rejects.toMatchObject({ code: "DIGEST_MISMATCH" });
  });

  it("throws TOO_LARGE when bytes exceed the declared size", async () => {
    const { cache } = memoryCache();
    await expect(stageVerifiedStream({
      cache, profileId: "p1",
      spec: { path: "a.bin", sha256: await realSha("HELLO"), byteSize: 2 },
      body: streamOf("HELLO"), createHasher: createSha256Hasher,
    })).rejects.toMatchObject({ code: "TOO_LARGE" });
  });
});

describe("publishStagingToReady", () => {
  it("copies staging to ready and deletes staging", async () => {
    const { cache, stores } = memoryCache();
    const staging = await cache.open(stagingCacheName("p1"));
    await staging.put("a.bin", new TextEncoder().encode("X").buffer);
    await publishStagingToReady(cache, "p1", ["a.bin"]);
    expect(stores.get(readyCacheName("p1"))?.has("a.bin")).toBe(true);
    expect(stores.has(stagingCacheName("p1"))).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `nvm use 24 && pnpm vitest run packages/ai-local/src/model-store.test.ts`
Expected: FAIL (unresolved `./model-store`).

- [ ] **Step 4: Implement model-store.ts**

Create `src/model-store.ts`. `createSha256Hasher` wraps `hash-wasm`'s `createSHA256()`:

```ts
import { createSHA256 } from "hash-wasm";

import { readyCacheName, stagingCacheName } from "./model-cache";
import type { ModelProfileFile } from "./model-profile";
import { SideloadError, type CacheLike } from "./sideloader";

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
      if (total > spec.byteSize) throw new SideloadError("TOO_LARGE", `File exceeds declared size: ${spec.path}`);
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
```

Note on the streaming claim: `CacheStoreLike.put` takes an `ArrayBuffer`, so the final `put` assembles the file once. The memory win vs. the sideloader is that hashing happens incrementally during the read; a future optimization can write a `Response(body)` stream directly to the real Cache API. Document this honestly in the code comment — the `CacheLike` abstraction publishes a buffer, but the hash never requires a second full copy, and the real browser Cache can store the streamed `Response` without our holding it. (Keep the buffered `concat` for the in-memory test adapter; in `local-ai.ts` the real cache adapter can `put(new Response(body))` — see Task 4.)

- [ ] **Step 5: Refactor sideloader to use publishStagingToReady**

In `src/sideloader.ts`, replace the inline staging→ready copy loop with a call to `publishStagingToReady(this.cache, profile.profileId, profile.files.map((f) => f.path))`. Behavior identical; run existing sideloader tests to confirm.

- [ ] **Step 6: Run + export**

Add exports to `src/index.ts`: `createSha256Hasher`, `publishStagingToReady`, `stageVerifiedStream`, and the `IncrementalHasher` type.

Run: `nvm use 24 && pnpm vitest run packages/ai-local/src/model-store.test.ts packages/ai-local/src/sideloader.test.ts && pnpm --filter @financial-intelligence/ai-local typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/ai-local/ pnpm-lock.yaml
git commit -m "Add streaming staged-publish helper with incremental SHA-256

Refs #33"
```

---

## Task 3: ModelDownloader

**Files:** Create `src/downloader.ts`, `src/downloader.test.ts`; modify `src/index.ts`.

**Interfaces:**
- Consumes: `ModelProfile`, `CacheLike`, `stageVerifiedStream`, `publishStagingToReady`, `createSha256Hasher`.
- Produces:
  - `class DownloadError extends Error { code: "network" | "digest_mismatch" | "too_large" | "cancelled" | "insufficient_storage" | "profile_invalid" }`
  - `interface DownloadProgress { readonly file: string; readonly fileBytes: number; readonly fileTotal: number; readonly overallBytes: number; readonly overallTotal: number }`
  - `interface DownloadDeps { readonly cache: CacheLike; readonly fetch: typeof fetch; readonly onProgress?: (p: DownloadProgress) => void; readonly signal?: AbortSignal; readonly createHasher?: () => Promise<IncrementalHasher> }`
  - `function modelFileUrl(profile: ModelProfile, path: string): string` → `https://huggingface.co/${modelRepo}/resolve/${modelRevision}/${path}`
  - `async function downloadModel(profile: ModelProfile, deps: DownloadDeps): Promise<void>` — sequentially fetch → stream-stage-verify each file, then publish; abort/cleanup on failure.

- [ ] **Step 1: Write the failing test**

Create `src/downloader.test.ts` with an injected `fetch` returning `Response`s with streamed bodies:

```ts
import { describe, expect, it, vi } from "vitest";
import { DownloadError, downloadModel, modelFileUrl } from "./downloader";
import { readyCacheName } from "./model-cache";
import type { ModelProfile } from "./model-profile";
import type { CacheLike, CacheStoreLike } from "./sideloader";

// in-memory cache (same shape as other tests)
function memoryCache() { /* …identical to model-store.test.ts… */ }
async function realSha(text: string): Promise<string> { /* …identical… */ }
const bodyOf = (t: string) => new Response(new TextEncoder().encode(t));

function profile(files: ModelProfile["files"]): ModelProfile {
  return {
    profileId: "p1", runtime: "transformers.js", runtimeVersion: "4.2.0",
    modelRepo: "org/model", modelRevision: "rev123", quantization: "q4", tokenizerId: "org/model",
    files, license: "L", totalByteSize: files.reduce((s, f) => s + f.byteSize, 0),
    minCapabilityTier: "recommended", task: "category.classify.v1", promptVersion: "1.0.0",
    schemaVersion: "1.0.0", decoding: { temperature: 0, maxOutputTokens: 256 },
  };
}

describe("modelFileUrl", () => {
  it("builds a pinned resolve URL", () => {
    expect(modelFileUrl(profile([]), "onnx/a.onnx")).toBe(
      "https://huggingface.co/org/model/resolve/rev123/onnx/a.onnx",
    );
  });
});

describe("downloadModel", () => {
  it("downloads, verifies, and publishes all files", async () => {
    const { cache, stores } = memoryCache();
    const files = [
      { path: "config.json", sha256: await realSha("CFG"), byteSize: 3 },
      { path: "onnx/w.onnx", sha256: await realSha("WWW"), byteSize: 3 },
    ];
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("config.json") ? bodyOf("CFG") : bodyOf("WWW"),
    ) as unknown as typeof fetch;
    await downloadModel(profile(files), { cache, fetch: fetchMock });
    expect(stores.get(readyCacheName("p1"))?.size).toBe(2);
  });

  it("aborts and cleans up on a digest mismatch", async () => {
    const { cache, stores } = memoryCache();
    const files = [{ path: "config.json", sha256: "0".repeat(64), byteSize: 3 }];
    const fetchMock = vi.fn(async () => bodyOf("CFG")) as unknown as typeof fetch;
    await expect(downloadModel(profile(files), { cache, fetch: fetchMock }))
      .rejects.toBeInstanceOf(DownloadError);
    expect(stores.get(readyCacheName("p1"))).toBeUndefined();
  });

  it("maps a fetch failure to a network DownloadError", async () => {
    const { cache } = memoryCache();
    const files = [{ path: "config.json", sha256: await realSha("CFG"), byteSize: 3 }];
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 })) as unknown as typeof fetch;
    await expect(downloadModel(profile(files), { cache, fetch: fetchMock }))
      .rejects.toMatchObject({ code: "network" });
  });

  it("reports overall progress across files", async () => {
    const { cache } = memoryCache();
    const files = [
      { path: "a", sha256: await realSha("AA"), byteSize: 2 },
      { path: "b", sha256: await realSha("BB"), byteSize: 2 },
    ];
    const fetchMock = vi.fn(async (u: string) => bodyOf(u.endsWith("a") ? "AA" : "BB")) as unknown as typeof fetch;
    const seen: number[] = [];
    await downloadModel(profile(files), { cache, fetch: fetchMock, onProgress: (p) => seen.push(p.overallBytes) });
    expect(Math.max(...seen)).toBe(4);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `nvm use 24 && pnpm vitest run packages/ai-local/src/downloader.test.ts`
Expected: FAIL (unresolved `./downloader`).

- [ ] **Step 3: Implement downloader.ts**

```ts
import { createSha256Hasher, publishStagingToReady, stageVerifiedStream, type IncrementalHasher } from "./model-store";
import { stagingCacheName } from "./model-cache";
import type { ModelProfile } from "./model-profile";
import { SideloadError, type CacheLike } from "./sideloader";

export type DownloadErrorCode =
  | "network" | "digest_mismatch" | "too_large" | "cancelled" | "insufficient_storage" | "profile_invalid";

export class DownloadError extends Error {
  public constructor(public readonly code: DownloadErrorCode, message: string) {
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

export function modelFileUrl(profile: ModelProfile, path: string): string {
  return `https://huggingface.co/${profile.modelRepo}/resolve/${profile.modelRevision}/${path}`;
}

export async function downloadModel(profile: ModelProfile, deps: DownloadDeps): Promise<void> {
  if (profile.files.length === 0) throw new DownloadError("profile_invalid", "Profile has no files.");
  const createHasher = deps.createHasher ?? createSha256Hasher;
  let overallBytes = 0;
  try {
    for (const spec of profile.files) {
      if (deps.signal?.aborted === true) throw new SideloadError("CANCELLED", "cancelled");
      let response: Response;
      try {
        response = await deps.fetch(modelFileUrl(profile, spec.path), { signal: deps.signal });
      } catch (error) {
        throw new DownloadError("network", `Could not reach the model host for ${spec.path}`);
      }
      if (!response.ok || response.body === null) {
        throw new DownloadError("network", `Download failed (${response.status}) for ${spec.path}`);
      }
      const base = overallBytes;
      await stageVerifiedStream({
        cache: deps.cache,
        profileId: profile.profileId,
        spec,
        body: response.body,
        createHasher,
        signal: deps.signal,
        onProgress: (fileBytes) =>
          deps.onProgress?.({
            file: spec.path,
            fileBytes,
            fileTotal: spec.byteSize,
            overallBytes: base + fileBytes,
            overallTotal: profile.totalByteSize,
          }),
      });
      overallBytes = base + spec.byteSize;
    }
    await publishStagingToReady(deps.cache, profile.profileId, profile.files.map((f) => f.path));
  } catch (error) {
    await deps.cache.delete(stagingCacheName(profile.profileId)).catch(() => undefined);
    throw toDownloadError(error);
  }
}

function toDownloadError(error: unknown): DownloadError {
  if (error instanceof DownloadError) return error;
  if (error instanceof SideloadError) {
    const map: Record<string, DownloadErrorCode> = {
      DIGEST_MISMATCH: "digest_mismatch", TOO_LARGE: "too_large", CANCELLED: "cancelled",
    };
    return new DownloadError(map[error.code] ?? "network", error.message);
  }
  return new DownloadError("network", "Download failed.");
}
```

- [ ] **Step 4: Run + export + commit**

Add `downloadModel`, `modelFileUrl`, `DownloadError` and the `DownloadProgress`/`DownloadDeps` types to `src/index.ts`.

Run: `nvm use 24 && pnpm vitest run packages/ai-local/src/downloader.test.ts && pnpm --filter @financial-intelligence/ai-local typecheck`
Expected: PASS.

```bash
git add packages/ai-local/
git commit -m "Add ModelDownloader: streamed, digest-verified CDN fetch to cache

Refs #33"
```

---

## Task 4: Engine network-lock + web glue

**Files:** Modify `packages/ai-local/src/transformers-engine.ts` (ensure remote off at load), `apps/web/src/local-ai.ts` (add `downloadModel` glue + `modelState()`).

- [ ] **Step 1: Confirm engine load keeps remote off**

`transformers-engine.ts` already sets `env.allowRemoteModels = false` in `load`. Add a one-line comment that the download flow (in the app layer) is the only place remote is enabled, and it is re-disabled before load. No behavior change; this is the defense-in-depth note.

- [ ] **Step 2: Add download glue + model-state to local-ai.ts**

Add to `apps/web/src/local-ai.ts`:

```ts
import { downloadModel, type DownloadProgress } from "@financial-intelligence/ai-local";
// transformers.js env — toggled only around the explicit download.
import { env } from "@huggingface/transformers";

export type ModelState = "not-downloaded" | "ready" | "incomplete";

export async function readModelState(): Promise<ModelState> {
  const loader = new ModelSideloader(browserCache(), sha256Hex);
  if (await loader.isReady(LOCAL_AI_PROFILE)) return "ready";
  const keys = await caches.keys();
  return keys.includes(stagingCacheName(LOCAL_AI_PROFILE.profileId)) ? "incomplete" : "not-downloaded";
}

export async function downloadPinnedModel(
  onProgress?: (p: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<SideloadOutcome> {
  env.allowRemoteModels = true; // enabled ONLY for this explicit download
  try {
    await downloadModel(LOCAL_AI_PROFILE, { cache: browserCache(), fetch: fetch.bind(globalThis), ...(onProgress ? { onProgress } : {}), ...(signal ? { signal } : {}) });
    return { ready: true };
  } catch (error) {
    return { ready: false, error: error instanceof Error ? error.message : "Download failed." };
  } finally {
    env.allowRemoteModels = false; // re-lock: inference is offline
  }
}
```

Note: importing `env` from the runtime into `local-ai.ts` (main thread) — verify this does NOT pull the whole runtime into the main bundle. `env` is a lightweight config object, but if the boundary/bundle test flags it, move the `allowRemoteModels` toggle into a tiny worker message instead. Check the ai-local architecture test still passes (it asserts non-worker files don't import the runtime — `local-ai.ts` is in apps/web, not ai-local, so the ai-local boundary test is unaffected, but confirm the app bundle size is acceptable).

- [ ] **Step 3: Typecheck**

Run: `nvm use 24 && pnpm --filter @financial-intelligence/web typecheck`
Expected: PASS. If `env` import bloats the bundle (check `pnpm build` output), refactor to toggle remote via a worker message and keep `local-ai.ts` runtime-free.

- [ ] **Step 4: Commit**

```bash
git add packages/ai-local/ apps/web/src/local-ai.ts
git commit -m "Add one-click download glue and model-state; lock remote to download only

Refs #33"
```

---

## Task 5: One-click UI with progress + cached state

**Files:** Modify `apps/web/src/LocalAiPanel.tsx`, `apps/web/src/LocalAiPanel.test.tsx`.

- [ ] **Step 1: Write failing panel tests**

Add tests (jsdom) with injected deps: renders a Download button when state is `not-downloaded`; renders "Model ready" + Remove when `ready`; shows progress region during download; shows a plain-language error on failure. Inject `detectCapability`, `readModelState`, and a `download` fn via new optional props.

```tsx
it("shows Download when the model is not cached", async () => {
  render(<LocalAiPanel detectCapability={() => Promise.resolve(recommended)} readModelState={() => Promise.resolve("not-downloaded")} />);
  expect(await screen.findByRole("button", { name: /Download model/i })).toBeEnabled();
});

it("shows a ready indicator when the model is already cached", async () => {
  render(<LocalAiPanel detectCapability={() => Promise.resolve(recommended)} readModelState={() => Promise.resolve("ready")} />);
  expect(await screen.findByText(/ready on this device/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Download model/i })).not.toBeInTheDocument();
});

it("shows plain-language error when download fails", async () => {
  render(<LocalAiPanel
    detectCapability={() => Promise.resolve(recommended)}
    readModelState={() => Promise.resolve("not-downloaded")}
    download={() => Promise.resolve({ ready: false, error: "Could not reach the model host" })} />);
  fireEvent.click(await screen.findByRole("button", { name: /Download model/i }));
  expect(await screen.findByText(/Could not reach the model host/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement the panel**

Add optional props `readModelState` and `download` (default to the real `local-ai.ts` fns). On mount, resolve capability + model state. Render by state:
- `not-downloaded` → Download button (size + license), on click drive `download(onProgress)`, show a `role="progressbar"` region with per-file name + overall percent/bytes + Cancel (an `AbortController`).
- `ready` → "✓ Model ready on this device" + on-disk size + a Remove button (clears the model cache namespace via existing storage-inventory clear, or `caches.delete(readyCacheName(...))`).
- `incomplete` → "Download interrupted — resume" that re-runs download.
- `unsupported` → existing rules-only message.
- Keep the sideload `<input>` behind a collapsed `<details>` "Advanced: load from files".
Announce phase changes via `role="status"`. Format bytes with the existing helper.

- [ ] **Step 3: Run**

Run: `nvm use 24 && pnpm vitest run apps/web/src/LocalAiPanel.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/
git commit -m "Add one-click download UI with progress, cached-state, and Remove

Refs #33"
```

---

## Task 6: e2e + docs (ADR-021, supersede ADR-020, close #95)

**Files:** Modify `e2e/ai-local-offline.spec.ts` (add a download-path assertion using a mocked route) or add `e2e/ai-local-download.spec.ts`; create `docs/adr/ADR-021-One-Click-Model-Download.md`; modify ADR-020 status, ADR index, security/AI/tech-stack/baseline docs, CHANGELOG, roadmap.

- [ ] **Step 1: e2e — download hits only allow-listed hosts, inference is offline**

Add a Playwright spec: install the network guard allowing `LOCAL_ORIGIN` + `huggingface.co`/`*.hf.co`; `page.route` the HF resolve URLs to serve tiny fake bytes matching a test profile OR assert that clicking Download issues requests only to allowed hosts; then assert that after a seeded ready cache, navigating/inference makes zero external requests (existing offline assertion). Keep the real ~3.3 GB download out of CI — use route interception with small fake payloads. Document that the real download is manually verified.

- [ ] **Step 2: ADR-021 + supersede ADR-020**

Create `docs/adr/ADR-021-One-Click-Model-Download.md` (Accepted, 2026-07-21): one-click CDN download primary; `connect-src 'self' https://huggingface.co https://*.hf.co` (region-specific Xet CDN → wildcard); download-then-verify-then-lock enforcement; app-driven streamed fetch + incremental SHA-256; sideload demoted to secondary. Alternatives: exact-host (region-fragile), self-host (hosting cost), keep sideload-only (rejected — impractical). In `ADR-020`, change `- Status: Accepted` → `- Status: Superseded by ADR-021` and add a one-line pointer; do not rewrite its body. Add the ADR-021 line to `docs/adr/README.md`.

- [ ] **Step 3: Update specs + changelog + roadmap**

- `docs/12-SECURITY-AND-PRIVACY.md`: the two new `connect-src` origins, why the default path is still offline, the download-then-lock rule.
- `docs/08-AI-ARCHITECTURE.md`: one-click acquisition primary, sideload secondary.
- `docs/16-TECHNOLOGY-STACK.md`: HF is an allow-listed download origin.
- `docs/ai-evaluation-baseline.md`: note acquisition is now one-click.
- `CHANGELOG.md`, `docs/15-ROADMAP.md`.

- [ ] **Step 4: Close #95**

`gh issue comment 95` explaining it's folded into this work (one-click + progress + cached-state + friendly errors delivered here), then `gh issue close 95`.

- [ ] **Step 5: Commit**

```bash
git add docs/ CHANGELOG.md e2e/
git commit -m "Add ADR-021, supersede ADR-020, document one-click download

Refs #33"
```

---

## Task 7: Full gate + PR

- [ ] **Step 1: Full local gate**

```bash
nvm use 24 && pnpm install --frozen-lockfile && pnpm exec prettier --write pnpm-lock.yaml && \
pnpm typescript:check && pnpm format:check && pnpm lint && pnpm schema:check && \
pnpm typecheck && pnpm test:coverage && pnpm build && \
pnpm security:headers:check -- apps/web/dist/_headers && pnpm audit --audit-level high
```

Expected: all green. Confirm the built `_headers` has the new connect-src and the header check enforces it exactly.

- [ ] **Step 2: Browser suite**

Run: `nvm use 24 && pnpm browser:test` — the download + offline specs pass on Chromium/Firefox/WebKit.

- [ ] **Step 3: Push + PR**

```bash
git push -u origin hk/ai-local-download
gh pr create --title "One-click browser-local model download (supersedes sideload-only) (#33)" --body-file <template>
```

PR body must state: privacy/network — `connect-src` gains HF hosts, reachable only during the explicit download; default path + inference stay zero-network (e2e-proven); download-then-lock enforcement. Data — model files streamed to the clearable `model` cache, no IndexedDB. Docs — ADR-021 supersedes ADR-020. a11y — download progress/cancel/ready/error states validated. Closes #95. Refs #33.

- [ ] **Step 4: Watch CI**

Run: `gh pr checks --watch` — fix root causes, never force-push/amend, until green.

---

## Self-Review

**Spec coverage:** CSP allow-list + tightened check → Task 1. Streaming staged-publish + incremental hash → Task 2. ModelDownloader (fetch→verify→publish, progress, cancel, error taxonomy) → Task 3. Remote-only-during-download lock → Task 4. One-click UI + per-file/overall progress + cached/ready/incomplete state + Remove + secondary sideload → Task 5. e2e (allow-listed download + zero-network inference) + ADR-021 supersede + close #95 + docs → Task 6. ✅ all mapped.

**Placeholder scan:** the e2e mocking approach (route interception, small fake payloads) is described concretely; the real multi-GB download is explicitly manual-verify. The `env`-import-bundle risk in Task 4 has a concrete fallback (toggle via worker message). No unresolved TODOs.

**Type consistency:** `CacheLike`/`SideloadError` reused from sideloader across Tasks 2/3; `IncrementalHasher` defined Task 2, consumed Task 3; `DownloadProgress`/`DownloadDeps` defined Task 3, consumed Tasks 4/5; `ModelState` Task 4→5. `stageVerifiedStream`/`publishStagingToReady` signatures identical Task 2 def vs Task 3 use.

**Honest risk flags:** (1) Task 2's `concat` assembles the file once for the `CacheLike` buffer `put` — the incremental hash avoids a *second* copy, and Task 4's real cache adapter can `put(new Response(body))` to stream; the plan notes this rather than overclaiming zero-copy through the test abstraction. (2) The real regional CDN host under `*.hf.co` was verified for the US region; the wildcard covers other regions by design.