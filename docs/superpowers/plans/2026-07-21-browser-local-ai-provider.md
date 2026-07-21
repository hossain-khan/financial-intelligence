# Browser-local AI provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `packages/ai-local` — a privacy-default browser-local `AiProvider` using transformers.js in a worker, with capability preflight, local-file model sideload + SHA-256 integrity + model-cache integration, cancellable off-thread `category.classify.v1` execution, and a minimal Settings UI — so a maintainer can sideload and run a local LLM with zero network after acquisition.

**Architecture:** `ai-local` implements `ai-core`'s `AiProvider`. All `@huggingface/transformers` imports are isolated in a module worker (main thread never imports the runtime). A typed `protocolVersion: 1` worker protocol (modeled on `packages/import-csv`) exposes `load`/`warmup`/`execute`/`cancel`/`unload`/`dispose`. A `FakeLocalEngine` makes every path CI-testable without WebGPU or weights; the real engine is wired behind the capability gate and validated by the maintainer. `connect-src 'self'` is unchanged — models are sideloaded from disk, verified, and seeded into the `model` Cache Storage namespace.

**Tech Stack:** TypeScript (strict), Vitest, React 19 + react-aria-components, Vite module workers, Web Crypto (`crypto.subtle`) for SHA-256, Cache Storage, WebGPU via transformers.js.

## Global Constraints

- Node 24: run `nvm use 24` before any command.
- Package manager `pnpm`; add deps via `package.json` + `pnpm install`, then `pnpm exec prettier --write pnpm-lock.yaml` so the lockfile diff vs `origin/main` stays minimal (this environment's pnpm rewrites quote style otherwise).
- `ai-local` main-thread entry MUST NOT import `@huggingface/transformers` (runtime stays worker-only); `domain`/`ai-core`/`ai-evaluation` MUST NOT import `ai-local`. A boundary test enforces this.
- `connect-src 'self'` in `apps/web/public/_headers` MUST remain unchanged. No model origin is added. Load/warmup/execute make zero network requests.
- No model download/sideload begins without explicit user action and an accurate size + license disclosure shown first.
- No remote fallback ever; WebGPU/engine failure preserves rules-only mode.
- Model output is untrusted: always strict-validate with `validateAiTask` regardless of constrained decoding.
- Model cache keys use the existing `financial-intelligence-model-` prefix (`model` namespace, `clearable: true`); model assets never mix with app shell or IndexedDB.
- Model identity is fully pinned (repo, immutable revision SHA, tokenizer, quantization, per-file SHA-256 + bytes, license, task/prompt/schema versions, decoding) — never a mutable alias.
- WebGPU + multi-GB weights cannot run in the implementing sandbox: build + CI-verify against the fake runtime; the real engine execution, model pin, and #32 numbers are the maintainer's spike, recorded after.
- Commits: no `Co-Authored-By: Claude` trailer. Canonical test command `pnpm test:coverage`.
- Full gate before PR: `pnpm typescript:check && pnpm format:check && pnpm lint && pnpm schema:check && pnpm typecheck && pnpm test:coverage && pnpm build && pnpm security:headers:check -- apps/web/dist/_headers && pnpm audit --audit-level high`, plus `pnpm browser:test` (worker/storage/UI change → all three browsers).

---

## File Structure

**New package `packages/ai-local/`:**
- `package.json`, `tsconfig.json`, `src/index.ts` — config + main-thread barrel (no runtime import).
- `src/model-profile.ts` — `ModelProfile` type + the pinned profile constant (digests filled by spike).
- `src/capability.ts` — `detectCapability()` + `CapabilityReport` (+ test).
- `src/protocol.ts` — versioned worker message types (`load`/`warmup`/`execute`/`cancel`/`unload`/`dispose` + responses).
- `src/engine.ts` — `LocalEngine` interface the worker drives (real + fake implement it).
- `src/fake-engine.ts` — `FakeLocalEngine` for CI (+ used by tests).
- `src/worker-handler.ts` — protocol handler over a `LocalEngine` (+ test); mirrors import-csv.
- `src/worker.ts` — worker entry: constructs the real engine, wires the handler (excluded from coverage; runtime-only).
- `src/transformers-engine.ts` — real `LocalEngine` wrapping `@huggingface/transformers` (worker-only import; excluded from coverage).
- `src/worker-client.ts` — `createLocalAiWorker()` (+ test).
- `src/sideloader.ts` — `ModelSideloader`: verify + stage + publish into cache (+ test).
- `src/model-cache.ts` — cache key helpers over the `model` namespace (+ test).
- `src/provider.ts` — `LocalAiProvider implements AiProvider` driving the worker client (+ test with fake worker).
- `src/architecture.test.ts` — boundary test.

**apps/web:**
- `src/LocalAiPanel.tsx` + `LocalAiPanel.test.tsx` — Settings "Local AI" panel.
- `src/local-ai.ts` — thin glue (capability + sideload + provider wiring) for the panel.
- Modify `src/App.tsx` — mount `<LocalAiPanel />` in Settings.
- Add `e2e/ai-local-offline.spec.ts` — seeded-cache load+execute makes zero network requests.

**Docs:** `docs/adr/ADR-020-Browser-Local-AI-Runtime.md`; modify `docs/adr/README.md`, `docs/08-AI-ARCHITECTURE.md`, `docs/07-SYSTEM-ARCHITECTURE.md`, `docs/12-SECURITY-AND-PRIVACY.md`, `docs/16-TECHNOLOGY-STACK.md`, `docs/ai-evaluation-baseline.md`, `CHANGELOG.md`, `docs/15-ROADMAP.md`.

---

## Task 1: Package scaffold, ModelProfile, capability preflight

**Files:**
- Create: `packages/ai-local/package.json`, `tsconfig.json`, `src/index.ts`
- Create: `src/model-profile.ts`, `src/capability.ts`, `src/capability.test.ts`

**Interfaces:**
- Consumes: `AiTaskId` from `ai-core`.
- Produces:
  - `interface ModelProfileFile { readonly path: string; readonly sha256: string; readonly byteSize: number }`
  - `interface ModelProfile { profileId; runtime: "transformers.js"; runtimeVersion; modelRepo; modelRevision; quantization; tokenizerId; files: readonly ModelProfileFile[]; license; totalByteSize; minCapabilityTier: "constrained" | "recommended"; task: "category.classify.v1"; promptVersion; schemaVersion: "1.0.0"; decoding: { temperature: number; maxOutputTokens: number } }` (all string unless noted)
  - `const CLASSIFIER_PROFILE: ModelProfile` — placeholder digests marked `PENDING_SPIKE` (documented; filled by the maintainer's spike).
  - `type CapabilityTier = "unsupported" | "constrained" | "recommended"`
  - `interface CapabilityReport { readonly tier: CapabilityTier; readonly reasons: readonly string[] }`
  - `interface CapabilityEnvironment { readonly isSecureContext: boolean; readonly hasWorker: boolean; readonly gpu?: { requestAdapter(): Promise<unknown> }; estimateStorage(): Promise<{ usage?: number; quota?: number }> }`
  - `function detectCapability(env: CapabilityEnvironment, profile: ModelProfile): Promise<CapabilityReport>`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@financial-intelligence/ai-local",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc -p tsconfig.json" },
  "dependencies": {
    "@financial-intelligence/ai-core": "workspace:*",
    "@financial-intelligence/domain": "workspace:*",
    "@financial-intelligence/schemas": "workspace:*"
  }
}
```

The `@huggingface/transformers` dependency is added in Task 5 (kept out until the real engine lands, so earlier tasks stay lightweight).

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2023", "DOM", "DOM.Iterable"], "types": ["node"] },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Install + normalize lockfile**

Run: `nvm use 24 && pnpm install && pnpm exec prettier --write pnpm-lock.yaml`
Expected: package linked; `git diff origin/main -- pnpm-lock.yaml` is only the new workspace link.

- [ ] **Step 4: Implement model-profile.ts**

```ts
import type { AiTaskId } from "@financial-intelligence/ai-core";

export interface ModelProfileFile {
  readonly path: string;
  readonly sha256: string;
  readonly byteSize: number;
}

export interface ModelProfile {
  readonly profileId: string;
  readonly runtime: "transformers.js";
  readonly runtimeVersion: string;
  readonly modelRepo: string;
  readonly modelRevision: string;
  readonly quantization: string;
  readonly tokenizerId: string;
  readonly files: readonly ModelProfileFile[];
  readonly license: string;
  readonly totalByteSize: number;
  readonly minCapabilityTier: "constrained" | "recommended";
  readonly task: AiTaskId;
  readonly promptVersion: string;
  readonly schemaVersion: "1.0.0";
  readonly decoding: { readonly temperature: number; readonly maxOutputTokens: number };
}

// Placeholder pending the maintainer's runtime/model spike (see the #33 spec and ADR-020).
// The exact repo/revision/file digests are pinned only after a real in-browser load is confirmed.
// Target: a Gemma 3n edge ONNX export (E2B/E4B); fallback: a known-good smaller ONNX instruct model.
export const CLASSIFIER_PROFILE: ModelProfile = {
  profileId: "local-classifier-v1",
  runtime: "transformers.js",
  runtimeVersion: "PENDING_SPIKE",
  modelRepo: "PENDING_SPIKE",
  modelRevision: "PENDING_SPIKE",
  quantization: "PENDING_SPIKE",
  tokenizerId: "PENDING_SPIKE",
  files: [],
  license: "PENDING_SPIKE",
  totalByteSize: 0,
  minCapabilityTier: "recommended",
  task: "category.classify.v1",
  promptVersion: "1.0.0",
  schemaVersion: "1.0.0",
  decoding: { temperature: 0, maxOutputTokens: 64 },
};
```

- [ ] **Step 5: Write the failing capability test**

Create `src/capability.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { detectCapability, type CapabilityEnvironment } from "./capability";
import { CLASSIFIER_PROFILE } from "./model-profile";

const profile = { ...CLASSIFIER_PROFILE, totalByteSize: 1_000_000 };

function env(over: Partial<CapabilityEnvironment> = {}): CapabilityEnvironment {
  return {
    isSecureContext: true,
    hasWorker: true,
    gpu: { requestAdapter: () => Promise.resolve({}) },
    estimateStorage: () => Promise.resolve({ usage: 0, quota: 10_000_000 }),
    ...over,
  };
}

describe("detectCapability", () => {
  it("reports recommended when GPU, worker, secure context, and storage headroom are present", async () => {
    const report = await detectCapability(env(), profile);
    expect(report.tier).toBe("recommended");
  });

  it("reports unsupported without WebGPU", async () => {
    const report = await detectCapability(env({ gpu: undefined }), profile);
    expect(report.tier).toBe("unsupported");
    expect(report.reasons).toContain("no-webgpu");
  });

  it("reports unsupported outside a secure context", async () => {
    const report = await detectCapability(env({ isSecureContext: false }), profile);
    expect(report.tier).toBe("unsupported");
  });

  it("reports constrained when storage headroom is below the model size", async () => {
    const report = await detectCapability(
      env({ estimateStorage: () => Promise.resolve({ usage: 9_900_000, quota: 10_000_000 }) }),
      profile,
    );
    expect(report.tier).toBe("constrained");
    expect(report.reasons).toContain("low-storage-headroom");
  });

  it("reports unsupported when the adapter cannot be acquired", async () => {
    const report = await detectCapability(
      env({ gpu: { requestAdapter: () => Promise.resolve(null) } }),
      profile,
    );
    expect(report.tier).toBe("unsupported");
    expect(report.reasons).toContain("no-gpu-adapter");
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `nvm use 24 && pnpm vitest run packages/ai-local/src/capability.test.ts`
Expected: FAIL (cannot resolve `./capability`).

- [ ] **Step 7: Implement capability.ts**

```ts
import type { ModelProfile } from "./model-profile";

export type CapabilityTier = "unsupported" | "constrained" | "recommended";

export interface CapabilityReport {
  readonly tier: CapabilityTier;
  readonly reasons: readonly string[];
}

export interface CapabilityEnvironment {
  readonly isSecureContext: boolean;
  readonly hasWorker: boolean;
  readonly gpu?: { requestAdapter(): Promise<unknown> };
  estimateStorage(): Promise<{ usage?: number; quota?: number }>;
}

export async function detectCapability(
  env: CapabilityEnvironment,
  profile: ModelProfile,
): Promise<CapabilityReport> {
  const reasons: string[] = [];
  if (!env.isSecureContext) reasons.push("insecure-context");
  if (!env.hasWorker) reasons.push("no-worker");
  if (env.gpu === undefined) reasons.push("no-webgpu");

  let adapterOk = false;
  if (env.gpu !== undefined) {
    try {
      adapterOk = (await env.gpu.requestAdapter()) != null;
      if (!adapterOk) reasons.push("no-gpu-adapter");
    } catch {
      reasons.push("no-gpu-adapter");
    }
  }

  const hardBlockers = reasons.some((r) =>
    ["insecure-context", "no-worker", "no-webgpu", "no-gpu-adapter"].includes(r),
  );
  if (hardBlockers) return { tier: "unsupported", reasons };

  let headroom = false;
  try {
    const estimate = await env.estimateStorage();
    const free = (estimate.quota ?? 0) - (estimate.usage ?? 0);
    headroom = free >= profile.totalByteSize;
    if (!headroom) reasons.push("low-storage-headroom");
  } catch {
    reasons.push("storage-estimate-unavailable");
  }

  return headroom ? { tier: "recommended", reasons } : { tier: "constrained", reasons };
}
```

- [ ] **Step 8: Create index barrel + run**

Create `src/index.ts`:

```ts
export { CLASSIFIER_PROFILE } from "./model-profile";
export type { ModelProfile, ModelProfileFile } from "./model-profile";
export { detectCapability } from "./capability";
export type { CapabilityEnvironment, CapabilityReport, CapabilityTier } from "./capability";
```

Run: `nvm use 24 && pnpm vitest run packages/ai-local/src/capability.test.ts && pnpm --filter @financial-intelligence/ai-local typecheck`
Expected: PASS (5 tests).

- [ ] **Step 9: Commit**

```bash
git add packages/ai-local/ pnpm-lock.yaml
git commit -m "Scaffold ai-local with model profile and capability preflight

Refs #33"
```

---

## Task 2: Worker protocol, engine interface, fake engine, and handler

**Files:**
- Create: `src/protocol.ts`, `src/engine.ts`, `src/fake-engine.ts`
- Create: `src/worker-handler.ts`, `src/worker-handler.test.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `AiTaskId` from `ai-core`; `ModelProfile` (Task 1).
- Produces:
  - `type LocalAiRequest` = union of `{ protocolVersion: 1; type: "load"; operationId; profile: ModelProfile }`, `{ ...; type: "warmup"; operationId }`, `{ ...; type: "execute"; operationId; task: AiTaskId; prompt: string; decoding: {...} }`, `{ ...; type: "cancel"; operationId }`, `{ ...; type: "unload"; operationId }`, `{ ...; type: "dispose"; operationId }`.
  - `type LocalAiResponse` = `{ protocolVersion: 1; type: "progress"; operationId; fraction: number }` | `{ ...; type: "loaded"; operationId }` | `{ ...; type: "result"; operationId; output: string }` | `{ ...; type: "failed"; operationId; errorCode: string; message: string }`.
  - `interface LocalEngine { load(profile, onProgress, signal): Promise<void>; warmup(signal): Promise<void>; generate(prompt, decoding, signal): Promise<string>; unload(): Promise<void>; dispose(): Promise<void> }`
  - `class FakeLocalEngine implements LocalEngine` — scriptable: configurable generate output, load progress, and a "device lost" toggle that throws.
  - `interface WorkerResponseTarget { postMessage(response: LocalAiResponse): void }`
  - `function createLocalAiWorkerHandler(target, engine): (message: unknown) => Promise<void>`

- [ ] **Step 1: Implement protocol.ts + engine.ts**

`src/protocol.ts` — the request/response unions above (all messages carry `protocolVersion: 1` and `operationId: string`).

`src/engine.ts`:

```ts
import type { ModelProfile } from "./model-profile";

export interface EngineDecoding {
  readonly temperature: number;
  readonly maxOutputTokens: number;
}

export interface LocalEngine {
  load(profile: ModelProfile, onProgress: (fraction: number) => void, signal: AbortSignal): Promise<void>;
  warmup(signal: AbortSignal): Promise<void>;
  generate(prompt: string, decoding: EngineDecoding, signal: AbortSignal): Promise<string>;
  unload(): Promise<void>;
  dispose(): Promise<void>;
}
```

- [ ] **Step 2: Implement fake-engine.ts**

```ts
import type { EngineDecoding, LocalEngine } from "./engine";
import type { ModelProfile } from "./model-profile";

export interface FakeEngineScript {
  readonly generateOutput?: string;
  readonly loadSteps?: number;
  readonly deviceLostOnGenerate?: boolean;
  readonly generateDelayMs?: number;
}

export class FakeLocalEngine implements LocalEngine {
  public loaded = false;
  public disposed = false;
  public constructor(private readonly script: FakeEngineScript = {}) {}

  public async load(_profile: ModelProfile, onProgress: (f: number) => void, signal: AbortSignal): Promise<void> {
    const steps = this.script.loadSteps ?? 2;
    for (let i = 1; i <= steps; i += 1) {
      if (signal.aborted) throw new DOMException("aborted", "AbortError");
      onProgress(i / steps);
    }
    this.loaded = true;
  }
  public warmup(): Promise<void> {
    return Promise.resolve();
  }
  public async generate(_prompt: string, _decoding: EngineDecoding, signal: AbortSignal): Promise<string> {
    if (this.script.deviceLostOnGenerate === true) throw new Error("device lost");
    await new Promise((resolve) => setTimeout(resolve, this.script.generateDelayMs ?? 0));
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    return this.script.generateOutput ?? '{"categoryId":"dining","confidence":0.9,"rationale":"ok"}';
  }
  public unload(): Promise<void> {
    this.loaded = false;
    return Promise.resolve();
  }
  public dispose(): Promise<void> {
    this.disposed = true;
    return Promise.resolve();
  }
}
```

- [ ] **Step 3: Write the failing handler test**

Create `src/worker-handler.test.ts` covering: load emits progress + `loaded`; execute returns `result`; cancel of an in-flight (delayed) execute yields `failed`/`CANCELLED` and no late result; device-lost generate yields `failed`/`DEVICE_LOST`; unsupported protocol version and unknown type are rejected. (Mirror the import-csv handler test structure: a `target` collecting responses, `crypto.randomUUID()` operation ids.)

```ts
import { describe, expect, it, vi } from "vitest";
import { FakeLocalEngine } from "./fake-engine";
import { createLocalAiWorkerHandler } from "./worker-handler";
import type { LocalAiResponse } from "./protocol";
import { CLASSIFIER_PROFILE } from "./model-profile";

function collector() {
  const messages: LocalAiResponse[] = [];
  return { messages, postMessage: (r: LocalAiResponse) => messages.push(r) };
}

describe("local ai worker handler", () => {
  it("loads with progress then reports loaded", async () => {
    const target = collector();
    const handle = createLocalAiWorkerHandler(target, new FakeLocalEngine({ loadSteps: 2 }));
    await handle({ protocolVersion: 1, type: "load", operationId: "op1", profile: CLASSIFIER_PROFILE });
    expect(target.messages.some((m) => m.type === "progress")).toBe(true);
    expect(target.messages.at(-1)?.type).toBe("loaded");
  });

  it("executes and returns a result", async () => {
    const target = collector();
    const engine = new FakeLocalEngine({ generateOutput: "OUT" });
    const handle = createLocalAiWorkerHandler(target, engine);
    await handle({ protocolVersion: 1, type: "load", operationId: "l", profile: CLASSIFIER_PROFILE });
    await handle({ protocolVersion: 1, type: "execute", operationId: "e", task: "category.classify.v1", prompt: "p", decoding: { temperature: 0, maxOutputTokens: 8 } });
    const result = target.messages.find((m) => m.type === "result");
    expect(result).toMatchObject({ type: "result", output: "OUT" });
  });

  it("cancels an in-flight execute without emitting a late result", async () => {
    const target = collector();
    const engine = new FakeLocalEngine({ generateDelayMs: 50, generateOutput: "LATE" });
    const handle = createLocalAiWorkerHandler(target, engine);
    await handle({ protocolVersion: 1, type: "load", operationId: "l", profile: CLASSIFIER_PROFILE });
    const exec = handle({ protocolVersion: 1, type: "execute", operationId: "e", task: "category.classify.v1", prompt: "p", decoding: { temperature: 0, maxOutputTokens: 8 } });
    await handle({ protocolVersion: 1, type: "cancel", operationId: "e" });
    await exec;
    expect(target.messages.some((m) => m.type === "result")).toBe(false);
    expect(target.messages.some((m) => m.type === "failed" && m.errorCode === "CANCELLED")).toBe(true);
  });

  it("maps a device-lost generate to DEVICE_LOST", async () => {
    const target = collector();
    const handle = createLocalAiWorkerHandler(target, new FakeLocalEngine({ deviceLostOnGenerate: true }));
    await handle({ protocolVersion: 1, type: "load", operationId: "l", profile: CLASSIFIER_PROFILE });
    await handle({ protocolVersion: 1, type: "execute", operationId: "e", task: "category.classify.v1", prompt: "p", decoding: { temperature: 0, maxOutputTokens: 8 } });
    expect(target.messages.some((m) => m.type === "failed" && m.errorCode === "DEVICE_LOST")).toBe(true);
  });

  it("rejects an unsupported protocol version", async () => {
    const target = collector();
    const handle = createLocalAiWorkerHandler(target, new FakeLocalEngine());
    await handle({ protocolVersion: 2, type: "load", operationId: "x" });
    expect(target.messages.at(-1)).toMatchObject({ type: "failed", errorCode: "UNSUPPORTED_PROTOCOL_VERSION" });
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `nvm use 24 && pnpm vitest run packages/ai-local/src/worker-handler.test.ts`
Expected: FAIL (unresolved `./worker-handler`).

- [ ] **Step 5: Implement worker-handler.ts**

Mirror `packages/import-csv/src/worker-handler.ts`: an `operations` Map<string, AbortController>; guard `protocolVersion !== 1` → `UNSUPPORTED_PROTOCOL_VERSION`; dispatch by `type`; `cancel` aborts the controller; `load`/`warmup`/`execute`/`unload`/`dispose` call the engine under a per-operation `AbortController`; on `execute`, after `generate` resolves, emit `result` only if not aborted, else `failed`/`CANCELLED`; catch device-lost → `failed`/`DEVICE_LOST`; other errors → `failed`/`ENGINE_ERROR`; `finally` delete the operation. Load progress posts `progress` messages. Settle exactly once per operation.

```ts
import type { LocalEngine } from "./engine";
import type { LocalAiResponse } from "./protocol";

export interface WorkerResponseTarget {
  postMessage(response: LocalAiResponse): void;
}

export function createLocalAiWorkerHandler(target: WorkerResponseTarget, engine: LocalEngine) {
  const operations = new Map<string, AbortController>();
  const fail = (operationId: string, errorCode: string, message: string) =>
    target.postMessage({ protocolVersion: 1, type: "failed", operationId, errorCode, message });

  return async (message: unknown): Promise<void> => {
    if (!isRecord(message) || message.protocolVersion !== 1 || typeof message.operationId !== "string") {
      fail(readId(message), "UNSUPPORTED_PROTOCOL_VERSION", "Unsupported worker protocol version");
      return;
    }
    const operationId = message.operationId;

    if (message.type === "cancel") {
      operations.get(operationId)?.abort();
      return;
    }

    const controller = new AbortController();
    operations.set(operationId, controller);
    try {
      switch (message.type) {
        case "load": {
          await engine.load(message.profile as never, (fraction) => {
            if (!controller.signal.aborted) {
              target.postMessage({ protocolVersion: 1, type: "progress", operationId, fraction });
            }
          }, controller.signal);
          settle(controller, () => target.postMessage({ protocolVersion: 1, type: "loaded", operationId }), () => fail(operationId, "CANCELLED", "Load cancelled"));
          break;
        }
        case "warmup":
          await engine.warmup(controller.signal);
          target.postMessage({ protocolVersion: 1, type: "loaded", operationId });
          break;
        case "execute": {
          const output = await engine.generate(String(message.prompt), message.decoding as never, controller.signal);
          settle(controller, () => target.postMessage({ protocolVersion: 1, type: "result", operationId, output }), () => fail(operationId, "CANCELLED", "Execution cancelled"));
          break;
        }
        case "unload":
          await engine.unload();
          target.postMessage({ protocolVersion: 1, type: "loaded", operationId });
          break;
        case "dispose":
          await engine.dispose();
          target.postMessage({ protocolVersion: 1, type: "loaded", operationId });
          break;
        default:
          fail(operationId, "UNKNOWN_MESSAGE_TYPE", "Unknown worker message type");
      }
    } catch (error) {
      if (controller.signal.aborted) fail(operationId, "CANCELLED", "Operation cancelled");
      else if (error instanceof Error && /device.*lost/iu.test(error.message)) fail(operationId, "DEVICE_LOST", "GPU device was lost");
      else fail(operationId, "ENGINE_ERROR", "Engine operation failed");
    } finally {
      operations.delete(operationId);
    }
  };
}

function settle(controller: AbortController, ok: () => void, cancelled: () => void): void {
  if (controller.signal.aborted) cancelled();
  else ok();
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function readId(message: unknown): string {
  return isRecord(message) && typeof message.operationId === "string" ? message.operationId : "unknown";
}
```

- [ ] **Step 6: Export + run**

Append to `src/index.ts`:

```ts
export { FakeLocalEngine } from "./fake-engine";
export type { FakeEngineScript } from "./fake-engine";
export { createLocalAiWorkerHandler } from "./worker-handler";
export type { WorkerResponseTarget } from "./worker-handler";
export type { LocalEngine, EngineDecoding } from "./engine";
export type { LocalAiRequest, LocalAiResponse } from "./protocol";
```

Run: `nvm use 24 && pnpm vitest run packages/ai-local/src/worker-handler.test.ts && pnpm --filter @financial-intelligence/ai-local typecheck`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/ai-local/
git commit -m "Add worker protocol, engine interface, fake engine, and handler

Refs #33"
```

---

## Task 3: Model cache + sideload acquisition with integrity

**Files:**
- Create: `src/model-cache.ts`, `src/model-cache.test.ts`
- Create: `src/sideloader.ts`, `src/sideloader.test.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `ModelProfile`, `ModelProfileFile` (Task 1).
- Produces:
  - `const MODEL_CACHE_PREFIX = "financial-intelligence-model-"` (matches the app's `model` namespace).
  - `function readyCacheName(profileId: string): string` → `${PREFIX}${profileId}`; `function stagingCacheName(profileId: string): string` → `${PREFIX}${profileId}-staging`.
  - `interface CacheLike { open(name: string): Promise<CacheStoreLike>; delete(name: string): Promise<boolean>; keys(): Promise<string[]> }` and `interface CacheStoreLike { put(key: string, bytes: ArrayBuffer): Promise<void>; match(key: string): Promise<ArrayBuffer | undefined> }` (thin adapter over Cache Storage so tests inject a fake).
  - `interface SideloadFile { readonly path: string; readonly bytes: ArrayBuffer }`
  - `class SideloadError extends Error` (with `code`)
  - `class ModelSideloader { constructor(cache: CacheLike, digest: (b: ArrayBuffer) => Promise<string>); sideload(profile: ModelProfile, files: readonly SideloadFile[], onProgress?: (done: number, total: number) => void): Promise<void>; isReady(profile): Promise<boolean> }`

- [ ] **Step 1: Write failing model-cache + sideloader tests**

Create `src/model-cache.test.ts` (readyCacheName/stagingCacheName produce `model`-namespace keys) and `src/sideloader.test.ts` covering: happy path publishes all files to the ready cache; a wrong digest rejects with `SideloadError`/`DIGEST_MISMATCH` and leaves the ready cache empty; a missing expected file rejects `MISSING_FILE`; an extra unexpected file rejects `UNEXPECTED_FILE`; staging is cleared after publish; `isReady` true only after full publish. Use an in-memory `CacheLike` fake and a digest fn that hashes bytes deterministically.

```ts
import { describe, expect, it } from "vitest";
import { ModelSideloader, SideloadError, type CacheLike, type CacheStoreLike } from "./sideloader";
import { readyCacheName } from "./model-cache";
import type { ModelProfile } from "./model-profile";

function memoryCache() {
  const stores = new Map<string, Map<string, ArrayBuffer>>();
  const cache: CacheLike = {
    open: (name) => {
      const store = stores.get(name) ?? new Map();
      stores.set(name, store);
      const api: CacheStoreLike = {
        put: (k, b) => { store.set(k, b); return Promise.resolve(); },
        match: (k) => Promise.resolve(store.get(k)),
      };
      return Promise.resolve(api);
    },
    delete: (name) => Promise.resolve(stores.delete(name)),
    keys: () => Promise.resolve([...stores.keys()]),
  };
  return { cache, stores };
}
const bytesOf = (s: string) => new TextEncoder().encode(s).buffer;
const fakeDigest = async (b: ArrayBuffer) => `d-${new TextDecoder().decode(b)}`;
function profile(): ModelProfile {
  return {
    profileId: "p1", runtime: "transformers.js", runtimeVersion: "x", modelRepo: "r", modelRevision: "rev",
    quantization: "q", tokenizerId: "t",
    files: [{ path: "a.onnx", sha256: "d-AAA", byteSize: 3 }, { path: "b.json", sha256: "d-BBB", byteSize: 3 }],
    license: "L", totalByteSize: 6, minCapabilityTier: "recommended", task: "category.classify.v1",
    promptVersion: "1.0.0", schemaVersion: "1.0.0", decoding: { temperature: 0, maxOutputTokens: 8 },
  };
}

describe("ModelSideloader", () => {
  it("publishes verified files and reports ready", async () => {
    const { cache, stores } = memoryCache();
    const loader = new ModelSideloader(cache, fakeDigest);
    await loader.sideload(profile(), [{ path: "a.onnx", bytes: bytesOf("AAA") }, { path: "b.json", bytes: bytesOf("BBB") }]);
    expect(stores.get(readyCacheName("p1"))?.size).toBe(2);
    expect(await loader.isReady(profile())).toBe(true);
  });

  it("rejects a digest mismatch and leaves nothing ready", async () => {
    const { cache, stores } = memoryCache();
    const loader = new ModelSideloader(cache, fakeDigest);
    await expect(
      loader.sideload(profile(), [{ path: "a.onnx", bytes: bytesOf("WRONG") }, { path: "b.json", bytes: bytesOf("BBB") }]),
    ).rejects.toBeInstanceOf(SideloadError);
    expect(stores.get(readyCacheName("p1"))).toBeUndefined();
  });

  it("rejects a missing expected file", async () => {
    const { cache } = memoryCache();
    const loader = new ModelSideloader(cache, fakeDigest);
    await expect(loader.sideload(profile(), [{ path: "a.onnx", bytes: bytesOf("AAA") }])).rejects.toMatchObject({ code: "MISSING_FILE" });
  });

  it("rejects an unexpected file", async () => {
    const { cache } = memoryCache();
    const loader = new ModelSideloader(cache, fakeDigest);
    await expect(
      loader.sideload(profile(), [
        { path: "a.onnx", bytes: bytesOf("AAA") }, { path: "b.json", bytes: bytesOf("BBB") }, { path: "evil.js", bytes: bytesOf("X") },
      ]),
    ).rejects.toMatchObject({ code: "UNEXPECTED_FILE" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `nvm use 24 && pnpm vitest run packages/ai-local/src/sideloader.test.ts`
Expected: FAIL (unresolved modules).

- [ ] **Step 3: Implement model-cache.ts**

```ts
export const MODEL_CACHE_PREFIX = "financial-intelligence-model-";
export function readyCacheName(profileId: string): string {
  return `${MODEL_CACHE_PREFIX}${profileId}`;
}
export function stagingCacheName(profileId: string): string {
  return `${MODEL_CACHE_PREFIX}${profileId}-staging`;
}
```

- [ ] **Step 4: Implement sideloader.ts**

Verify-then-stage-then-publish. Reject unexpected/missing/mismatched files before any publish. Write verified bytes to the staging cache, then copy to the ready cache and delete staging.

```ts
import type { ModelProfile } from "./model-profile";
import { readyCacheName, stagingCacheName } from "./model-cache";

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
  public constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "SideloadError";
  }
}

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
    const expected = new Map(profile.files.map((f) => [f.path, f]));
    for (const file of files) {
      if (!expected.has(file.path)) throw new SideloadError("UNEXPECTED_FILE", `Unexpected file: ${file.path}`);
    }
    const provided = new Map(files.map((f) => [f.path, f]));
    for (const path of expected.keys()) {
      if (!provided.has(path)) throw new SideloadError("MISSING_FILE", `Missing file: ${path}`);
    }

    const staging = await this.cache.open(stagingCacheName(profile.profileId));
    let done = 0;
    for (const spec of profile.files) {
      const file = provided.get(spec.path)!;
      const actual = await this.digest(file.bytes);
      if (actual !== spec.sha256) {
        await this.cache.delete(stagingCacheName(profile.profileId));
        throw new SideloadError("DIGEST_MISMATCH", `Digest mismatch for ${spec.path}`);
      }
      await staging.put(spec.path, file.bytes);
      onProgress?.((done += 1), profile.files.length);
    }

    const ready = await this.cache.open(readyCacheName(profile.profileId));
    for (const spec of profile.files) {
      const bytes = await staging.match(spec.path);
      if (bytes === undefined) throw new SideloadError("STAGING_LOST", `Staged file lost: ${spec.path}`);
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
    return true;
  }
}
```

- [ ] **Step 5: Export + run**

Append to `src/index.ts`:

```ts
export { MODEL_CACHE_PREFIX, readyCacheName, stagingCacheName } from "./model-cache";
export { ModelSideloader, SideloadError } from "./sideloader";
export type { CacheLike, CacheStoreLike, SideloadFile } from "./sideloader";
```

Run: `nvm use 24 && pnpm vitest run packages/ai-local/src/model-cache.test.ts packages/ai-local/src/sideloader.test.ts && pnpm --filter @financial-intelligence/ai-local typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ai-local/
git commit -m "Add model cache keys and sideload acquisition with integrity

Refs #33"
```

---

## Task 4: Provider (worker client) + prompt template + strict validation

**Files:**
- Create: `src/prompt.ts`, `src/prompt.test.ts`
- Create: `src/worker-client.ts`
- Create: `src/provider.ts`, `src/provider.test.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `AiProvider`, `AiProviderProfileIdentity`, `AiResultEnvelope`, `AiTaskRequest`, `ExecuteOptions`, `aiError` from `ai-core`; `validateAiTask` from `schemas`; the protocol + engine (Task 2); `ModelProfile` (Task 1).
- Produces:
  - `function buildClassifyPrompt(payload: unknown, promptVersion: string): string` (uses only minimized fields; no raw data beyond the task payload).
  - `interface LocalWorker { postMessage(m: LocalAiRequest): void; addEventListener(t: "message" | "error", cb: (e: unknown) => void): void; removeEventListener(...): void; terminate(): void }` (structural; real `Worker` satisfies it, tests inject a fake).
  - `function createLocalAiWorker(): Worker` (Vite module worker).
  - `class LocalAiProvider implements AiProvider { constructor(deps: { createWorker: () => LocalWorker; profile: ModelProfile; isReady: () => Promise<boolean> }); ... }` — `execute` posts `execute`, awaits `result`, strict-validates via `validateAiTask` response envelope, returns `{ ok: true, output }` or an `aiError`; unsupported/unready → `unsupported`; cancel via `options.signal` posts `cancel`.

- [ ] **Step 1: Write failing prompt + provider tests**

`src/prompt.test.ts`: `buildClassifyPrompt` includes the descriptor and allowed ids, is deterministic, and does not include any key outside the minimized payload.

`src/provider.test.ts` (fake worker that replies with scripted `LocalAiResponse`s): a valid `result` → `{ ok: true, output }`; a schema-invalid `result` → `{ ok: false, error.code: "invalid_output" }`; a `failed`/`CANCELLED` after abort → `{ ok:false, error.code:"cancelled" }`; not-ready profile → `unsupported`; a `failed`/`DEVICE_LOST` → `resource_exhausted` (or `provider_error`).

```ts
import { describe, expect, it } from "vitest";
import { LocalAiProvider } from "./provider";
import type { LocalAiRequest, LocalAiResponse } from "./protocol";
import { CLASSIFIER_PROFILE } from "./model-profile";

class FakeWorker {
  private listeners: Record<string, ((e: unknown) => void)[]> = {};
  public sent: LocalAiRequest[] = [];
  public reply?: (req: LocalAiRequest) => LocalAiResponse | undefined;
  postMessage(m: LocalAiRequest) {
    this.sent.push(m);
    const response = this.reply?.(m);
    if (response) queueMicrotask(() => this.emit("message", { data: response }));
  }
  addEventListener(t: string, cb: (e: unknown) => void) { (this.listeners[t] ??= []).push(cb); }
  removeEventListener() {}
  terminate() {}
  private emit(t: string, e: unknown) { for (const cb of this.listeners[t] ?? []) cb(e); }
}

const valid = { categoryId: "dining", confidence: 0.9, rationale: "ok" };
const deps = (worker: FakeWorker, ready = true) => ({
  createWorker: () => worker as never,
  profile: { ...CLASSIFIER_PROFILE, files: [{ path: "a", sha256: "x", byteSize: 1 }], task: "category.classify.v1" as const },
  isReady: () => Promise.resolve(ready),
});
const req = { task: "category.classify.v1" as const, payload: { descriptor: "coffee", direction: "outflow", allowedCategoryIds: ["dining"] } };
const opts = () => ({ signal: new AbortController().signal, deadlineMs: 1000 });

describe("LocalAiProvider", () => {
  it("returns a validated suggestion for a good result", async () => {
    const worker = new FakeWorker();
    worker.reply = (m) => m.type === "load" ? { protocolVersion: 1, type: "loaded", operationId: m.operationId }
      : m.type === "execute" ? { protocolVersion: 1, type: "result", operationId: m.operationId, output: JSON.stringify(valid) } : undefined;
    const provider = new LocalAiProvider(deps(worker));
    const result = await provider.execute(req, opts());
    expect(result).toEqual({ ok: true, output: valid });
  });

  it("rejects schema-invalid output", async () => {
    const worker = new FakeWorker();
    worker.reply = (m) => m.type === "load" ? { protocolVersion: 1, type: "loaded", operationId: m.operationId }
      : m.type === "execute" ? { protocolVersion: 1, type: "result", operationId: m.operationId, output: '{"categoryId":123}' } : undefined;
    const provider = new LocalAiProvider(deps(worker));
    const result = await provider.execute(req, opts());
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_output" } });
  });

  it("returns unsupported when the model is not ready", async () => {
    const provider = new LocalAiProvider(deps(new FakeWorker(), false));
    const result = await provider.execute(req, opts());
    expect(result).toMatchObject({ ok: false, error: { code: "unsupported" } });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `nvm use 24 && pnpm vitest run packages/ai-local/src/provider.test.ts`
Expected: FAIL (unresolved `./provider`).

- [ ] **Step 3: Implement prompt.ts, worker-client.ts, provider.ts**

`src/worker-client.ts`:

```ts
export function createLocalAiWorker(): Worker {
  return new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "financial-intelligence-ai-local",
  });
}
```

`src/prompt.ts` — a versioned template that renders only the minimized payload fields as typed JSON with an instruction that source fields are data, not instructions (matches `docs/08` prompt-safety).

`src/provider.ts` — `LocalAiProvider implements AiProvider`: builds an `AiProviderProfileIdentity` from the `ModelProfile` (executionLocation `"local"`, supportedTasks `[profile.task]`); `execute` short-circuits to `unsupported` when `isReady()` is false or the task isn't supported; otherwise ensures the worker is loaded (once), posts an `execute` with the built prompt + decoding, resolves on the matching `result`, runs `validateAiTask` on the parsed output → `{ ok: true, output }` or `aiError("invalid_output", …)`; maps `failed` codes (`CANCELLED`→`cancelled`, `DEVICE_LOST`→`resource_exhausted`, else `provider_error`); wires `options.signal` to post `cancel`. Health returns `{ ok: true }` without touching weights.

- [ ] **Step 4: Export + run**

Append to `src/index.ts`:

```ts
export { buildClassifyPrompt } from "./prompt";
export { createLocalAiWorker } from "./worker-client";
export { LocalAiProvider } from "./provider";
export type { LocalWorker } from "./provider";
```

Run: `nvm use 24 && pnpm vitest run packages/ai-local/src/prompt.test.ts packages/ai-local/src/provider.test.ts && pnpm --filter @financial-intelligence/ai-local typecheck`
Expected: PASS.

- [ ] **Step 5: ai-evaluation registration test**

Create `src/evaluation-integration.test.ts`: build a `LocalAiProvider` backed by a fake worker that returns grounded answers, run it through `ai-evaluation`'s `runEvaluation` + `computeMetrics` + `evaluateGates` over a tiny inline case set, and assert zero grounding/privacy violations. Add `@financial-intelligence/ai-evaluation` as a devDependency of `ai-local` for this test, then `pnpm install && pnpm exec prettier --write pnpm-lock.yaml`.

- [ ] **Step 6: Commit**

```bash
git add packages/ai-local/ pnpm-lock.yaml
git commit -m "Add local AI provider, prompt template, and evaluation integration

Refs #33"
```

---

## Task 5: Real transformers.js engine + worker entry (behind capability gate)

**Files:**
- Create: `src/transformers-engine.ts`, `src/worker.ts`
- Modify: `packages/ai-local/package.json` (add `@huggingface/transformers`), root vitest coverage exclude.

**Interfaces:**
- Produces: `class TransformersLocalEngine implements LocalEngine` — loads the model from the seeded cache (transformers.js configured to use Cache Storage / no remote), `generate` runs constrained decoding and returns raw text. `src/worker.ts` constructs it and wires `createLocalAiWorkerHandler(self, engine)`.

- [ ] **Step 1: Add the runtime dependency**

In `packages/ai-local/package.json` add to `dependencies`: `"@huggingface/transformers": "<pinned version>"`. Verify the exact current version + license (Apache-2.0) before pinning. Run `nvm use 24 && pnpm install && pnpm exec prettier --write pnpm-lock.yaml`, then `pnpm audit --audit-level high`.

- [ ] **Step 2: Implement transformers-engine.ts**

Configure the library for offline/local operation: set `env.allowRemoteModels = false` and `env.allowLocalModels = true` (or the current-API equivalent — verify against the installed version's `env` surface), point its cache resolution at the seeded model cache, select the WebGPU device with WASM fallback per the capability tier, and pin the model to the profile's repo/revision. `generate` applies the profile decoding and returns text. This file imports `@huggingface/transformers` and is worker-only.

- [ ] **Step 3: Implement worker.ts**

```ts
import { createLocalAiWorkerHandler } from "./worker-handler";
import { TransformersLocalEngine } from "./transformers-engine";

const engine = new TransformersLocalEngine();
const handler = createLocalAiWorkerHandler(
  { postMessage: (response) => self.postMessage(response) },
  engine,
);
self.addEventListener("message", (event: MessageEvent) => {
  void handler(event.data);
});
```

- [ ] **Step 4: Exclude runtime-only files from coverage**

In root `vitest.config.ts`, add to `test.coverage.exclude`: `packages/ai-local/src/worker.ts` and `packages/ai-local/src/transformers-engine.ts` (they require WebGPU + real weights and are validated manually, not in CI). Add a comment explaining why.

- [ ] **Step 5: Verify build + boundary hold**

Run: `nvm use 24 && pnpm --filter @financial-intelligence/ai-local typecheck && pnpm build`
Expected: typechecks; Vite bundles the worker. If transformers.js needs specific Vite `optimizeDeps`/worker settings, add them to `apps/web/vite.config.ts` (documented). Do NOT change `_headers` CSP.

- [ ] **Step 6: Commit**

```bash
git add packages/ai-local/ pnpm-lock.yaml vitest.config.ts apps/web/vite.config.ts
git commit -m "Wire real transformers.js engine behind the capability gate

Refs #33"
```

---

## Task 6: Architecture boundary test

**Files:**
- Create: `src/architecture.test.ts`

- [ ] **Step 1: Write the boundary test**

Assert: (a) no non-worker `src/**/*.ts` (exclude `worker.ts` and `transformers-engine.ts`) imports `@huggingface/transformers`; (b) `src/index.ts` (the main-thread barrel) does not transitively re-export the engine module; (c) `package.json` runtime `dependencies` are exactly the three workspace packages plus `@huggingface/transformers`.

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL(".", import.meta.url));
const WORKER_ONLY = new Set(["worker.ts", "transformers-engine.ts"]);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return e.name.endsWith(".ts") && !e.name.endsWith(".test.ts") ? [full] : [];
  });
}

describe("ai-local runtime isolation", () => {
  it("keeps @huggingface/transformers out of every non-worker module", () => {
    for (const file of walk(srcDir)) {
      if (WORKER_ONLY.has(file.split("/").pop()!)) continue;
      expect(readFileSync(file, "utf8"), file).not.toContain("@huggingface/transformers");
    }
  });
});
```

Run: `nvm use 24 && pnpm vitest run packages/ai-local/src/architecture.test.ts`
Expected: PASS.

- [ ] **Step 2: Commit**

```bash
git add packages/ai-local/
git commit -m "Add ai-local runtime-isolation boundary test

Refs #33"
```

---

## Task 7: Settings "Local AI" panel + offline e2e

**Files:**
- Create: `apps/web/src/local-ai.ts`, `apps/web/src/LocalAiPanel.tsx`, `apps/web/src/LocalAiPanel.test.tsx`
- Create: `e2e/ai-local-offline.spec.ts`
- Modify: `apps/web/src/App.tsx` (mount panel), `apps/web/package.json` (add `@financial-intelligence/ai-local`)

**Interfaces:**
- Consumes: `detectCapability`, `CLASSIFIER_PROFILE`, `ModelSideloader`, `LocalAiProvider` from `ai-local`.
- Produces: `LocalAiPanel` React component; `local-ai.ts` glue (`describeCapability()`, `sideloadFromFiles(fileList)`).

- [ ] **Step 1: Add the dependency**

In `apps/web/package.json` add `"@financial-intelligence/ai-local": "workspace:*"`. Run `nvm use 24 && pnpm install && pnpm exec prettier --write pnpm-lock.yaml`.

- [ ] **Step 2: Write the failing panel test**

Create `apps/web/src/LocalAiPanel.test.tsx` (Testing Library + injected fakes): renders the capability tier; shows the pinned size + license **before** any sideload action; a file selection that verifies triggers a "ready" status; a digest mismatch shows an error and no ready status; keyboard focus reaches the select-files control. Inject a fake capability report + a fake sideloader so no worker/WebGPU is needed.

- [ ] **Step 3: Implement local-ai.ts + LocalAiPanel.tsx**

Panel mirrors `StoragePanel.tsx` structure (`useState`/`useEffect`, `Button`, react-aria patterns). It: runs `detectCapability` against the real browser env on mount; shows tier + reasons; renders the profile `totalByteSize` (via a `formatBytes`) and `license` with a disclosure before the action; a "Select model files" control (File System Access `showDirectoryPicker` when available, else `<input type="file" multiple>`); on selection calls the sideloader with progress; shows ready/failed/unsupported states with `role="status"`/`role="alert"`. All strings calm/plain; loading/empty/error/unavailable states covered; reduced-motion + forced-colors safe (reuse existing tokens/classes).

- [ ] **Step 4: Mount in App.tsx**

Add `import { LocalAiPanel } from "./LocalAiPanel";` and render `<LocalAiPanel />` in the Settings section near `<StoragePanel />` (after line ~884).

- [ ] **Step 5: Write the offline e2e**

Create `e2e/ai-local-offline.spec.ts` using `installLocalNetworkGuard(context, LOCAL_ORIGIN)`: seed the model cache with fake profile files via `page.evaluate` (open `financial-intelligence-model-<id>` and `put` small blobs at the profile paths), then drive the panel to a ready state (or directly assert the provider path) and confirm `network.assertClean()` — proving load/execute add no external request. Since real WebGPU generation can't run headless, the spec asserts the **acquisition + no-network** guarantee (the generative path is the maintainer's manual verification). Document this scope in a comment.

- [ ] **Step 6: Run**

Run: `nvm use 24 && pnpm vitest run apps/web/src/LocalAiPanel.test.tsx && pnpm exec playwright test e2e/ai-local-offline.spec.ts --project=chromium`
Expected: PASS. (Full 3-browser run happens in the gate.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/ e2e/ pnpm-lock.yaml
git commit -m "Add Settings Local AI panel and offline no-network e2e

Refs #33"
```

---

## Task 8: ADR-020 + documentation

**Files:**
- Create: `docs/adr/ADR-020-Browser-Local-AI-Runtime.md`
- Modify: `docs/adr/README.md`, `docs/08-AI-ARCHITECTURE.md`, `docs/07-SYSTEM-ARCHITECTURE.md`, `docs/12-SECURITY-AND-PRIVACY.md`, `docs/16-TECHNOLOGY-STACK.md`, `docs/ai-evaluation-baseline.md`, `CHANGELOG.md`, `docs/15-ROADMAP.md`

- [ ] **Step 1: Write ADR-020**

Template from `docs/adr/README.md`, Status: Accepted, Date: 2026-07-21. Context: #33 needs a runtime that can run edge LLMs. Decision: **transformers.js** (ONNX Runtime Web, WebGPU + WASM fallback); **web-llm rejected** because its prebuilt list (verified against its `config.ts`) cannot run Gemma 3n E2B/E4B; **sideload-only acquisition** keeps `connect-src 'self'`; model fully pinned (repo/revision/tokenizer/quantization/per-file SHA-256/license/task+prompt+schema/decoding); worker isolation; capability tiers with no remote fallback; the maintainer-run spike gates the model pin. Consequences: real model choice + #32 numbers recorded after the spike; #34/#35 unaffected; #38 owns lifecycle. Alternatives: web-llm, in-app CDN download, WASM-only, no-AI. Validation: mock capability + sideload/integrity + offline e2e + fake-engine cancellation/device-loss tests in CI; real load/benchmark + #32 evaluation done by the maintainer. Related: ADR-003, ADR-018, ADR-019.

- [ ] **Step 2: ADR index + specs**

- `docs/adr/README.md`: add the ADR-020 line.
- `docs/08-AI-ARCHITECTURE.md` (Browser-local section): concrete provider, sideload, worker, capability, no-network-after-acquisition.
- `docs/07-SYSTEM-ARCHITECTURE.md`: the ai-local worker + model cache namespace usage.
- `docs/12-SECURITY-AND-PRIVACY.md`: sideload keeps `connect-src 'self'`; SHA-256 integrity before use; no model origin.
- `docs/16-TECHNOLOGY-STACK.md`: transformers.js selected as the browser-local runtime (update the "may be evaluated" note).
- `docs/ai-evaluation-baseline.md`: add the local-classifier profile row (measured values `PENDING maintainer spike`).

- [ ] **Step 3: Changelog + roadmap**

- `CHANGELOG.md` Unreleased: add the browser-local provider entry (runtime, sideload, capability, offline, worker; note model pin pending spike).
- `docs/15-ROADMAP.md`: note #33 landed the browser-local provider scaffold + sideload + capability; model profile pinned after the maintainer benchmark.

- [ ] **Step 4: Commit**

```bash
git add docs/ CHANGELOG.md
git commit -m "Add ADR-020 and document the browser-local AI provider

Refs #33"
```

---

## Task 9: Full gate + PR

**Files:** none (verification + PR).

- [ ] **Step 1: Full local gate**

```bash
nvm use 24 && pnpm install --frozen-lockfile && pnpm exec prettier --write pnpm-lock.yaml && \
pnpm typescript:check && pnpm format:check && pnpm lint && pnpm schema:check && \
pnpm typecheck && pnpm test:coverage && pnpm build && \
pnpm security:headers:check -- apps/web/dist/_headers && pnpm audit --audit-level high
```

Expected: all green; `_headers` CSP unchanged (verify `connect-src 'self'` is still present and no model origin was added). Run `pnpm format` then re-check if needed. Confirm lockfile diff vs `origin/main` is minimal.

- [ ] **Step 2: Browser suite (worker/UI/storage change → all three)**

Run: `nvm use 24 && pnpm browser:test`
Expected: the offline e2e passes on Chromium, Firefox, WebKit. Install browsers first if missing (`pnpm exec playwright install`).

- [ ] **Step 3: Push + PR**

```bash
git push -u origin hk/ai-local-33
gh pr create --title "Browser-local AI provider and capability benchmark (#33)" --body-file <completed template>
```

Complete every `.github/pull_request_template.md` section. Key points: privacy/network = **`connect-src 'self'` unchanged, sideload-only, no model origin**; data/migration = none (cache only, no IndexedDB store); a11y/UI = new Settings panel (keyboard/focus/status/reduced-motion/forced-colors/320px validated, screenshots); verification = full gate + note what was NOT run in-sandbox (real WebGPU generation + model download → maintainer spike); limitations = model profile pinned after the maintainer's benchmark, query-planning + lifecycle deferred to later issues/#38. Link `Refs #33` (not `Closes` — the model pin + #32 evaluation complete the issue after the spike) OR `Closes #33` if you consider the scaffold+sideload+capability the issue's deliverable and track the pin separately. Recommend **`Refs #33`** and a short follow-up note that the model pin + evaluation land after the maintainer runs the spike.

- [ ] **Step 4: Watch CI**

Run: `gh pr checks --watch`
Expected: all required checks green. Fix root causes; never force-push/amend. Then stop for maintainer merge.

---

## Self-Review

**Spec coverage:**
- transformers.js runtime, web-llm rejected for Gemma 3n → ADR (Task 8), dep (Task 5). ✅
- `packages/ai-local` implements `ai-core`, runtime worker-isolated → Tasks 1–2, boundary Task 6. ✅
- Worker protocol `load/warmup/execute/cancel/unload/dispose`, one engine, serialized, cancellation/device-loss → Task 2. ✅
- Capability tiers + reason codes, advisory, no-remote-fallback → Task 1. ✅
- Sideload-only, SHA-256 verify, staged publish, model-cache namespace, CSP unchanged → Task 3, e2e Task 7. ✅
- Structured classify via minimizers + versioned template + strict validation → Task 4. ✅
- ai-evaluation registration → Task 4 Step 5. ✅
- Settings UI with size/license disclosure, a11y → Task 7. ✅
- Offline no-network guarantee → Task 7 e2e. ✅
- Full model attributability (pinned profile) → Task 1 (+ maintainer fills digests). ✅
- Mock capability/cache/offline/cancel/resource-pressure/corrupt-artifact/device-loss tests → Tasks 1,2,3,7. ✅

**Placeholder scan:** the `CLASSIFIER_PROFILE` `PENDING_SPIKE` values and the `transformers-engine.ts` env-API details are deliberately deferred to the maintainer spike (documented in the spec + ADR + PR limitations), not plan gaps. `buildClassifyPrompt`/`TransformersLocalEngine` internals are described by contract; their exact bodies are small and the API surface (`env.allowRemoteModels` etc.) is flagged "verify against installed version" because it is genuinely version-specific.

**Type consistency:** `LocalEngine`/`EngineDecoding` identical across Tasks 2/4/5; `LocalAiResponse`/`LocalAiRequest` identical Tasks 2/4/7; `ModelProfile` identical Tasks 1/3/4; `CacheLike`/`SideloadFile` Tasks 3/7; `AiProvider` surface matches ai-core exports verified from its index.

**Gaps intentionally deferred (documented in PR + ADR):** real WebGPU execution + model download + #32 numbers (maintainer spike), the exact model pin, query-planning, and full lifecycle/#38 — all per the approved spec.
