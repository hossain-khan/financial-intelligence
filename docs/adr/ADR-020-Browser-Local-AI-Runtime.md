# ADR-020: Browser-local AI runtime and sideload-only acquisition

- Status: Accepted
- Date: 2026-07-21
- Decision owners: Project maintainers

## Context

Issue #33 implements the optional browser-local AI provider promised by ADR-003. It requires a
maintained in-browser inference runtime and a model-acquisition path that does not weaken the
privacy boundary. The maintainer's target is running small edge LLMs locally (e.g. Google's Gemma 3n
`E2B`/`E4B` "effective 2B/4B" models built for on-device use).

Two runtimes were candidates. `@mlc-ai/web-llm` was evaluated and **rejected**: its prebuilt model
list (verified directly against its `config.ts` — 128 models) tops out at `gemma-2-9b` and
`gemma3-1b` and has **no Gemma 3n E2B/E4B support**. `@huggingface/transformers` (transformers.js,
ONNX Runtime Web) lists Gemma / Gemma2 / Gemma3 / Gemma3n as supported architectures and offers
WebGPU with a WASM/CPU fallback, so it is the only candidate with a path to the required edge models.

The production CSP is `connect-src 'self'`: the app cannot fetch from any external origin, and adding
a model CDN would be a privacy-boundary change.

## Decision

Adopt **`@huggingface/transformers` (transformers.js)** as the browser-local runtime, in a new
`packages/ai-local` that implements `ai-core`'s `AiProvider`. All runtime imports are isolated in a
module worker; the main thread never loads the runtime (enforced by a boundary test). Inference runs
off the UI thread through a versioned `protocolVersion: 1` worker protocol (`load`/`warmup`/
`execute`/`cancel`/`unload`/`dispose`) modeled on the import-csv worker.

**Acquisition is local-file sideload only.** The user obtains the ONNX model files themselves and
selects them from disk; the app SHA-256-verifies each file against the pinned profile, stages them,
and atomically publishes them into the `model` Cache Storage namespace. `connect-src 'self'` is
**unchanged** — the app has no model origin and never fetches weights. transformers.js is configured
with `env.allowRemoteModels = false` and browser cache only, so load/warmup/execute make zero network
requests. In-app CDN download is explicitly deferred to a possible later issue.

**The model is fully pinned** by a `ModelProfile`: repo, immutable revision SHA (never a mutable
alias), tokenizer, quantization, per-file SHA-256 + byte sizes, license, total bytes, minimum
capability tier, and task/prompt/schema/decoding versions. Capability preflight returns
`unsupported | constrained | recommended` with coarse reason codes; WebGPU/engine failure preserves
rules-only mode and never falls back to a remote provider.

**The specific model is pinned after a maintainer-run spike.** WebGPU inference and multi-GB weight
loading cannot run in the implementing agent's environment, so the full slice was built and
CI-verified against a `FakeLocalEngine`; the real transformers.js engine is wired behind the
capability gate but its execution, the model pin, and the #32 evaluation numbers are recorded from
the maintainer's run. The shipped `ModelProfile` carries `PENDING_SPIKE` placeholders and model
selection is disabled in the UI until it is pinned.

## Consequences

- The real model choice (target: a Gemma 3n edge ONNX export; fallback: a known-good smaller ONNX
  instruct model) and its measured #32 results are appended after the spike; the profile digests are
  filled then.
- transformers.js pulls `onnxruntime-node` (a Node-only backend never in the browser bundle), which
  transitively depended on a vulnerable `adm-zip`; a pnpm override bumps it to `>=0.6.0` to keep
  `pnpm audit` clean. The browser build uses `onnxruntime-web` only.
- #34 (self-hosted) and #35 (remote) are unaffected and register into the same `ai-core` contract.
- Full model lifecycle (per-model registry UI, pause/resume, eviction) is #38; query planning is
  enabled only once it passes #32 gates.

## Alternatives considered

- **`@mlc-ai/web-llm`** — rejected: cannot run Gemma 3n E2B/E4B (verified against its config), which
  is the maintainer's target edge-model family.
- **In-app CDN download** (allow-listing huggingface.co/cdn-lfs in `connect-src`) — rejected for this
  issue: it is a privacy-boundary change; sideload keeps `connect-src 'self'` intact.
- **WASM/CPU only** — retained as a conditional fallback if it passes latency/memory gates, not the
  primary path.
- **No AI** — remains the default and a fully supported mode.

## Validation

- Mock capability tiers, sideload happy-path + corrupt/missing/unexpected-file rejection, staged
  publish + cleanup, cancellation, device-loss mapping, and the `ai-evaluation` registration are
  covered in CI via `FakeLocalEngine`.
- An offline Playwright spec proves a seeded model cache + Settings capability preflight make zero
  external requests.
- A runtime-isolation boundary test keeps the runtime out of the main thread.
- Real in-browser load, generation, and the #32 evaluation are performed by the maintainer and
  recorded in the evaluation baseline report.

## Related decisions

- [ADR-003: WebGPU as optional local AI acceleration](ADR-003-Why-WebGPU.md)
- [ADR-018: Provider-neutral AI core, task contracts, and no-AI default](ADR-018-Provider-Neutral-AI-Core.md)
- [ADR-019: AI evaluation harness and release thresholds](ADR-019-AI-Evaluation-Harness.md)
