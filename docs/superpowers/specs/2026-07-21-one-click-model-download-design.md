# One-click browser-local model download (supersedes sideload-only)

- Date: 2026-07-21
- Issue: [#33](https://github.com/hossain-khan/financial-intelligence/issues/33) follow-up; folds in and closes [#95](https://github.com/hossain-khan/financial-intelligence/issues/95)
- Epic: [#16 — Phase 4, Optional AI assistance](https://github.com/hossain-khan/financial-intelligence/issues/16)
- Status: Approved design, pending implementation

## Purpose

Let a user get the browser-local model running with **one click** — no manual Hugging Face download,
no folder juggling — while keeping the app **offline-first everywhere else**. This deliberately
reverses ADR-020's sideload-only stance: the friction of manual acquisition is not practical for
adoption. A new ADR-021 supersedes that part of ADR-020.

The privacy posture is preserved in substance: the default path stays 100% network-free, the
Hugging Face CDN is reachable **only during an explicit, user-initiated download**, every downloaded
file is SHA-256-verified against the pinned profile before use, and inference runs from cache with
remote fetching structurally disabled.

## Decisions (locked in brainstorming)

- **One-click CDN download is the primary path.** transformers.js is kept (Gemma 3n E2B q4 is already
  verified working; web-llm cannot run it).
- **CSP allow-list is tight:** only the pinned model's download origins are added to `connect-src`,
  nothing broader.
- **Sideload is kept as a secondary "advanced: load from files" fallback** for offline/air-gapped
  users — the existing, tested code is retained but demoted.
- **Enforcement = download-then-verify-then-lock:** the download phase enables remote fetching,
  fetches + verifies + caches, then disables remote fetching for load/inference. Inference cannot
  hit the network.
- **App-driven fetch + our SHA-256 verify:** the app fetches each pinned file itself and verifies it
  against the profile digest, reusing the existing `ModelSideloader` staged-publish path — identical
  integrity guarantee to sideload.

## Scope

In scope:

- ADR-021 superseding ADR-020's sideload-only decision.
- A tight `connect-src` allow-list for the pinned model's download hosts.
- A new `ModelDownloader` in `packages/ai-local` that fetches the pinned files, verifies digests, and
  publishes to the model cache via the existing sideloader path.
- Engine network-lock: remote fetching enabled only during download, disabled for load/inference.
- A one-click download UI in `LocalAiPanel` with accessible progress, cancel, plain-language errors,
  and a ready state — absorbing #95's friendly-flow goals. Sideload demoted to a secondary control.
- Tests (downloader unit, panel states, e2e for allow-listed-download + zero-network-inference, CSP
  header) and docs.

Out of scope:

- Multiple models / model registry / eviction (#38).
- Query planning (`query.plan.v1`).
- A full #32 corpus evaluation of the pinned model (separate, still-pending follow-up).

## Non-goals and invariants

- The default path (startup, imports, rules, ledger, dashboards, and AI inference) issues **zero**
  network requests. Only the explicit "Download model" action contacts the allow-listed hosts.
- No origin other than the pinned model hosts is added to `connect-src`.
- Every downloaded file is SHA-256-verified against the pinned profile before it can be used; a
  mismatch aborts the whole acquisition.
- Model output remains untrusted and strictly validated (unchanged).

## Architecture

```text
LocalAiPanel
  ├─ primary:   [ Download model · 3.3 GB · Gemma Terms ]  → ModelDownloader
  └─ secondary: "Advanced: load from files"                → ModelSideloader (existing)

ModelDownloader (new, packages/ai-local):
  for each profile.files[]:
    fetch(`${host}/${modelRepo}/resolve/${modelRevision}/${path}`)  (streamed, progress)
    → SHA-256 verify vs profile.files[].sha256
  → produce SideloadFile[] → ModelSideloader.sideload(...)  (verify → stage → atomic publish → cleanup)
  → model cache namespace

Engine: remote fetching ON only during download; OFF for load/warmup/execute → inference is offline.
```

- The downloader is framework-independent with an injectable `fetch` for tests; it lives beside the
  sideloader and reuses its staged-publish + digest logic, so no new integrity code is introduced.
- The runtime isolation boundary (worker-only runtime import) is unchanged.

## CSP change

`apps/web/public/_headers`: `connect-src 'self'` becomes
`connect-src 'self' <pinned model hosts>`. The exact hosts are the origins the pinned files resolve
to; Hugging Face `resolve/` URLs 302-redirect to a `cdn-lfs*` host, so both the API origin and the
CDN origin(s) are required. The implementer confirms the real redirect targets for the pinned
revision and allow-lists exactly those, nothing broader. The `security:headers:check` script and CSP
tests are updated to expect exactly this set.

Offline-first is preserved: these origins are contacted only by the explicit download action; the
`env.allowRemoteModels` flag is the runtime enforcement described below.

## ModelDownloader

- `downloadModel(profile, deps)` where `deps = { fetch, cache, digest, onProgress?, signal? }`.
- For each `profile.files[]`: build the CDN URL from `modelRepo` + `modelRevision` + `path`, fetch it
  (streamed where practical, reporting per-file and cumulative byte progress), read bytes, and pass
  the set to `ModelSideloader` which SHA-256-verifies against the profile and stages/publishes
  atomically. A mismatch, a missing file, an over-size response, or an abort cleans up staging and
  fails the whole download.
- Bounds: enforce the profile's declared `byteSize` per file and `totalByteSize` overall as ceilings;
  retry is off by default; `AbortSignal` cancels in flight.
- Errors map to a small typed set (`network`, `digest_mismatch`, `too_large`, `cancelled`,
  `insufficient_storage`) that the UI renders as plain language.

## Engine network-lock enforcement

- The download flow sets `env.allowRemoteModels = true` for the fetch phase only, then restores
  `false` before any `load`. Because acquisition is app-driven `fetch` + our cache publish, the
  runtime itself loads only from the verified cache and never needs remote on for our files; the
  explicit flip is defense-in-depth.
- `load`, `warmup`, and `execute` always run with `allowRemoteModels = false`.
- e2e assertions: (a) the download action contacts only allow-listed hosts; (b) load + inference
  after download make **zero** network requests.

## UI (absorbs #95)

`LocalAiPanel` primary flow:

- capability tier (existing) → a prominent **Download model** button showing size + license **before**
  the click;
- an accessible progress region during download: per-file + overall percentage and byte counts,
  `role="progressbar"` with `aria-valuenow`/`aria-valuetext`, a Cancel button, reduced-motion safe;
- plain-language errors for network failure, digest mismatch ("the downloaded file did not match the
  expected version — try again"), insufficient storage, and cancellation — never raw codes;
- a ready state that tells the user categorization suggestions are now available;
- a secondary, collapsed **"Advanced: load from files"** disclosure wrapping the existing sideload
  path for offline/air-gapped users.

States covered: idle, checking capability, downloading, verifying, ready, failed, unsupported.
Keyboard operation, visible focus, status/progress announcements, 320px reflow, 200% zoom,
reduced-motion, and forced-colors are validated (docs/13-UX-GUIDELINES.md, docs/21-DESIGN-SYSTEM.md).

## Data flow

1. User clicks Download. The panel calls `downloadModel(CLASSIFIER_PROFILE, …)` with remote enabled.
2. Each pinned file is fetched, verified against its digest, and published to the model cache via the
   sideloader path; progress streams to the UI; cancel/failure cleans up.
3. Remote fetching is disabled; the provider loads the engine from the verified cache and runs
   inference offline.
4. A validated suggestion + audit flow back through the router (unchanged).

## Error handling

- Digest mismatch / missing / oversize → acquisition rejected before publish; nothing enters the
  ready cache; UI shows plain-language guidance.
- Network failure or offline during download → clear "couldn't reach the model host" message; the app
  stays fully usable rules-only.
- Cancel → in-flight fetch aborted, staging cleaned up, panel returns to idle.
- Device loss / OOM at inference → unchanged from #33 (worker recreation, no remote fallback).

## Testing

- `ModelDownloader` unit tests with an injected `fetch`: happy path publishes + reports ready;
  digest mismatch aborts and leaves nothing ready; oversize response rejected; cancel aborts and
  cleans up; URL construction matches the pinned repo/revision/path.
- Reuse of `ModelSideloader` publish is already covered by its tests.
- Panel tests for idle/downloading/progress/error/ready states and the advanced-sideload disclosure.
- e2e: download contacts only allow-listed hosts; inference after download makes zero requests
  (extends the existing offline spec).
- CSP header test updated to expect exactly the allow-listed origins.

## Documentation impact

- New ADR `docs/adr/ADR-021-One-Click-Model-Download.md` + index entry; ADR-020 marked
  "Superseded by ADR-021" (its body preserved).
- `docs/12-SECURITY-AND-PRIVACY.md`: the new `connect-src` origins, why the default path is still
  offline, and the download-then-lock enforcement.
- `docs/08-AI-ARCHITECTURE.md`: one-click acquisition as primary, sideload secondary.
- `docs/16-TECHNOLOGY-STACK.md`: note the model CDN is an allow-listed download origin.
- `docs/ai-evaluation-baseline.md`: unchanged findings; note acquisition is now one-click.
- `CHANGELOG.md`, `docs/15-ROADMAP.md`.
- Issue #95 closed as folded into this work (comment + close).

## Delivery order

1. ADR-021 + CSP allow-list + header/CSP tests.
2. `ModelDownloader` + unit tests (reusing the sideloader publish path).
3. Engine network-lock (remote on during download only) + assertions.
4. One-click UI in `LocalAiPanel` with progress/cancel/errors; sideload demoted to secondary.
5. e2e (allow-listed download + zero-network inference) + docs; close #95.

## Acceptance criteria

- One click downloads, verifies, caches, and readies the pinned model with visible progress.
- The app makes zero network requests outside the explicit download action; inference is offline.
- `connect-src` allow-lists only the pinned model hosts; the header check enforces it.
- Every downloaded file is digest-verified; a mismatch aborts acquisition.
- Sideload remains available as a secondary path.
- ADR-021 supersedes ADR-020; #95 is closed as folded in.
