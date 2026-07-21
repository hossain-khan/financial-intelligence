# Browser-local AI provider and capability benchmark (#33)

- Date: 2026-07-21
- Issue: [#33](https://github.com/hossain-khan/financial-intelligence/issues/33)
- Epic: [#16 — Phase 4, Optional AI assistance](https://github.com/hossain-khan/financial-intelligence/issues/16)
- Status: Approved design, pending implementation

## Purpose

Implement a privacy-default in-browser AI provider: capability detection, user-initiated local model
acquisition with integrity verification, off-thread inference, cancellation, and one evaluated
classification profile. The app must run supported tasks **with zero network after acquisition**,
and remain fully usable in rules-only mode on unsupported devices.

## Decisions locked in brainstorming

- **Runtime: `@huggingface/transformers` (transformers.js, ONNX Runtime Web).** `@mlc-ai/web-llm`
  was evaluated and **rejected**: its prebuilt model list (verified against its `config.ts`, 128
  models) tops out at `gemma-2-9b` / `gemma3-1b` and **cannot run the Gemma 3n E2B/E4B edge models**
  the maintainer requires. transformers.js lists Gemma/Gemma2/Gemma3/Gemma3n as supported
  architectures and offers WebGPU with a WASM/CPU fallback.
- **Acquisition: local-file sideload only.** The user obtains the ONNX model files themselves and
  selects them from disk; the app verifies SHA-256 and seeds Cache Storage. **`connect-src 'self'`
  is unchanged** — the app never has a model origin to fetch from, so there is no CSP relaxation and
  no privacy-boundary change. In-app CDN download is explicitly out of scope (a possible later
  issue).
- **Scope: one branch, staged commits** following the issue's delivery order, producing a slice the
  maintainer can actually run a local LLM against.
- **Model pinning happens after a maintainer-run spike.** WebGPU inference and multi-GB weight
  loading cannot run in the implementing agent's sandbox. The full slice is built and CI-verified
  with a **fake runtime**; the **real transformers.js engine is wired but its execution is validated
  by the maintainer** on real hardware, and the model profile + #32 evaluation numbers are recorded
  from that run.

## Scope

In scope:

- New `packages/ai-local` implementing `ai-core`'s `AiProvider`, with the transformers.js runtime
  isolated inside a module worker.
- A typed, versioned worker protocol (modeled on `packages/import-csv`) with `load`, `warmup`,
  `execute`, `cancel`, `unload`, `dispose`; one long-lived engine per profile; serialized inference.
- Capability preflight returning `unsupported | constrained | recommended` with reason codes.
- A `ModelProfile` pinning runtime, model repo/revision, tokenizer, quantization, ONNX file list
  with SHA-256 + byte sizes, license, total bytes, minimum capability tier, task/prompt/schema
  versions, and decoding parameters.
- Sideload acquisition: pick files → verify every digest → stage under an incomplete key → publish
  atomically into the `model` cache namespace.
- Structured `category.classify.v1` execution through `ai-core` minimizers + versioned templates,
  with independent strict `validateAiTask` output validation.
- A minimal accessible Settings "Local AI" panel (capability, sideload with size/license
  disclosure, verification progress, ready/failed status, unload/remove).
- Registration into the `ai-evaluation` harness so the profile can be graded by #32 gates.
- ADR-020 and documentation.

Out of scope (later issues):

- In-app CDN/remote model download and any `connect-src` change.
- Query planning (`query.plan.v1`) — enabled only if it later passes #32 gates.
- Full model lifecycle hardening, per-model registry UI, pause/resume, eviction (#38).
- Self-hosted (#34) and remote (#35) providers.

## Non-goals and invariants

- No remote fallback, ever, without an explicit separate user action. WebGPU/engine failure
  preserves rules-only mode; it never silently reaches a network provider.
- No model download begins without user action and an accurate size/license disclosure.
- No hard-coded claim that one model fits every device; capability tiers gate use.
- Inference runs off the UI thread. The main thread never imports the runtime.
- After acquisition, load/warmup/execute make zero network requests (no lazy shard/tokenizer fetch).
- Model output is untrusted: strict-validated against the task schema regardless of constrained
  decoding.

## Architecture

```text
apps/web (Settings "Local AI" panel; triggers capability preflight + sideload)
  └─► packages/ai-local
        ├─ main-thread entry: AiProvider impl, worker client, sideloader, capability, cache
        └─ module worker: imports @huggingface/transformers, holds the engine  ─► WebGPU / WASM
  ai-local ── imports ──► ai-core (AiProvider, task types, minimizers), domain, schemas
```

- `ai-local` implements `AiProvider` so the router and the `ai-evaluation` harness drive it exactly
  like any other provider.
- **Runtime isolation:** all `@huggingface/transformers` imports live in the worker module only. A
  boundary test asserts the main-thread entry never imports the runtime, and that `domain`/`ai-core`
  never import `ai-local`. (`ai-local` legitimately depends on the runtime, Cache Storage, and
  WebGPU — its boundary is looser than the pure `ai-core`/`ai-evaluation` packages by necessity.)
- **Worker protocol** mirrors `import-csv/worker-handler.ts`: `protocolVersion: 1`, an operations
  map keyed by `operationId`, `cancel` via `AbortController`, progress messages, exactly-once
  settle, unknown-type/duplicate-operation guards.

## Model profile (pinned after the spike)

A checked-in `ModelProfile` (TS + a JSON manifest for the file digests):

```ts
interface ModelProfile {
  readonly profileId: string;
  readonly runtime: "transformers.js";
  readonly runtimeVersion: string;
  readonly modelRepo: string;      // e.g. an onnx-community Gemma 3n/edge export — confirmed by the spike
  readonly modelRevision: string;  // immutable commit SHA, never a mutable tag/alias
  readonly quantization: string;   // e.g. "q4f16"
  readonly tokenizerId: string;
  readonly files: readonly { readonly path: string; readonly sha256: string; readonly byteSize: number }[];
  readonly license: string;
  readonly totalByteSize: number;
  readonly minCapabilityTier: "constrained" | "recommended";
  readonly task: "category.classify.v1";
  readonly promptVersion: string;
  readonly schemaVersion: "1.0.0";
  readonly decoding: { readonly temperature: number; readonly maxOutputTokens: number };
}
```

- The spike confirms which exact repo/revision has browser-loadable ONNX weights. **Target:** a
  Gemma 3n edge export (E2B/E4B). **Fallback if 3n does not load in-browser:** a known-good smaller
  ONNX instruct model, with Gemma 3n recorded as the intended upgrade. The pinned choice and its
  digests land in the profile file only after the maintainer's run.
- `insight.word.v1`/`query.plan.v1` profiles are deferred; classification ships first.

## Capability preflight

`detectCapability(): Promise<CapabilityReport>` → `{ tier: "unsupported" | "constrained" | "recommended", reasons: string[] }`:

- checks secure context, worker support, `navigator.gpu`, adapter acquisition, required
  features/limits, `navigator.storage.estimate()` headroom vs the profile's `totalByteSize`, and an
  empirical warm-up allocation probe;
- advisory only — `load`/`execute` still catch device-loss/OOM at runtime and recover (recreate the
  worker deterministically);
- reason codes are coarse; no high-entropy hardware details enter diagnostics;
- `unsupported` → rules-only preserved. A WASM/CPU fallback is offered only if it passes explicit
  latency/memory gates (measured in the spike); otherwise WebGPU-only.

## Acquisition, integrity, and cache

- `ModelSideloader`: accepts picked `File`s (File System Access `showDirectoryPicker`; `<input
  type="file" multiple webkitdirectory>` fallback). For every file the profile expects: read bytes →
  SHA-256 verify against the pinned digest → reject the entire set on any mismatch or missing file.
- **Staged publish:** verified bytes are written under an incomplete key namespace first; only after
  all files verify does the app atomically publish them under the
  `financial-intelligence-model-<profileId>` keys the runtime will request. Interrupted or corrupt →
  delete the incomplete generation and restart.
- Cache keys live in the existing `model` namespace (`MODEL_PREFIX`, `clearable: true`,
  `apps/web/src/pwa/cache-namespaces.ts`), so #38's per-model removal and the existing StoragePanel
  clear already operate on them. Model assets stay separate from the app shell and canonical
  IndexedDB.
- **Offline guarantee:** reading a `File` and writing/reading Cache Storage are local operations. An
  e2e no-network assertion covers load + warmup + execute with a seeded cache.

## Structured task execution

- Prompts are built only through `ai-core` minimizers and versioned templates. Prefer the runtime's
  JSON-schema / constrained generation when available, but **always** run independent strict
  `validateAiTask` validation on the output — constrained decoding is never trusted alone.
- Bound input records/tokens, maximum output tokens, wall time, batch size, and retries (off by
  default). Temperature defaults to the profile value; all decoding parameters are recorded in the
  evaluation result.
- Classification first. Query planning is enabled only if that exact task/profile passes #32 gates
  (a later change).

## Testability strategy

- **Fake runtime (`FakeLocalEngine`)** implementing the worker's internal engine interface, so the
  worker adapter, cancellation, resource release, capability fallback, sideload, integrity, staged
  publish, cache lifecycle, and device-loss recovery are fully unit/integration tested **without
  WebGPU or real weights**. This keeps CI green in the sandbox.
- **Real engine wired but capability-gated:** the actual transformers.js engine is imported in the
  worker behind the capability check. Its real execution is validated by the maintainer locally and
  recorded as a manual verification step plus the #32 evaluation run. The PR documents exactly what
  was and was not run in-sandbox.

## Settings UI

A minimal accessible "Local AI" panel (reusing StoragePanel / design-system patterns):

- shows the capability tier and reason;
- a "Select model files" control that shows the pinned **size and license before any action**;
- per-file verification progress; ready / failed / unsupported status;
- an unload/remove control (full lifecycle is #38).
- Keyboard operation, visible focus, status announcements, reduced motion, forced colors, and 320px
  reflow are covered; loading/empty/error/unavailable states implemented.

## Data flow

1. Settings triggers `detectCapability()`; the panel renders the tier and the profile's size/license.
2. On user action, `ModelSideloader` reads picked files, verifies digests, and stages + publishes
   them into the model cache.
3. The provider `load`s the worker engine from cache (no network), `warmup`s, then `execute`s a
   `category.classify.v1` request built via `ai-core` minimizers.
4. Output is strict-validated; a validated suggestion + audit flow back through the router. A
   cancel/timeout aborts generation, discards late output, releases buffers, and leaves the worker
   usable or recreatable.

## Error handling

- Missing/corrupt/mismatched files → acquisition rejected before publish; nothing enters the ready
  namespace.
- Device loss / OOM during load or inference → caught, worker recreated deterministically, work
  preserved, user shown options; never a remote fallback.
- Cancel/timeout → generation stopped at the earliest runtime boundary, late output discarded,
  per-request state released, settled exactly once.
- WebGPU/engine unavailable → `unsupported` tier, rules-only preserved.

## Testing

- Mock capability tiers (unsupported/constrained/recommended) and their reason codes.
- Sideload happy path; corrupt, missing, and extra-file rejection; staged-publish atomicity and
  interrupted-generation cleanup; cache lifecycle (publish → present → clear via the model
  namespace).
- Worker cancellation, resource release, and deterministic device-loss recovery (fake engine).
- Offline no-network e2e: load + warmup + execute against a seeded cache make zero requests.
- Dependency-boundary test: runtime stays worker-isolated; main-thread entry runtime-free.
- `ai-evaluation` registration test: the provider (fake engine) runs through the harness and is
  graded by #32 gates.
- Structured-output validation: malformed engine output is rejected without state mutation.

## Documentation impact

- New ADR `docs/adr/ADR-020-Browser-Local-AI-Runtime.md` + index entry: runtime = transformers.js
  (web-llm rejected for lacking Gemma 3n E2B/E4B, verified against its config); sideload-only
  acquisition with `connect-src 'self'` unchanged; pinned-profile model attributability; worker
  isolation; capability tiers + no-remote-fallback policy; the maintainer-run spike gating the model
  pin. Alternatives: web-llm, in-app CDN download, WASM-only. Measured benchmark/#32 numbers appended
  after the maintainer's run.
- `docs/08-AI-ARCHITECTURE.md` (browser-local provider), `docs/07-SYSTEM-ARCHITECTURE.md` (worker +
  model cache), `docs/12-SECURITY-AND-PRIVACY.md` (sideload keeps the network boundary; integrity
  verification), `docs/16-TECHNOLOGY-STACK.md` (transformers.js selected), the ai-evaluation baseline
  report (profile results, filled after the run), `CHANGELOG.md`, `docs/15-ROADMAP.md`,
  `docs/adr/README.md`.

## Delivery order (staged commits)

1. `packages/ai-local` scaffold, `ModelProfile` type + manifest, capability preflight (mock-tested).
2. Worker protocol + adapter with the fake runtime; cancellation/resource/device-loss tests.
3. Sideload acquisition, SHA-256 integrity, staged publish, and model-cache integration.
4. Structured `category.classify.v1` execution via minimizers; strict validation; ai-evaluation
   registration; real transformers.js engine wired behind the capability gate.
5. Settings "Local AI" panel; offline no-network e2e; ADR-020 and docs.

## Acceptance criteria (from #33)

- Supported devices run tasks without network after model acquisition (verified locally by the
  maintainer; the offline e2e proves no-network with a seeded cache).
- Unsupported devices remain usable in rules-only mode.
- Profile passes #32 thresholds (recorded from the maintainer's evaluation run).
- Model/runtime/tokenizer/quantization/digests and task versions are fully attributable via the
  pinned `ModelProfile`.
- No model download begins without user action and an accurate size/license disclosure.
