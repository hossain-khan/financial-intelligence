# ADR-021: One-click browser-local model download

- Status: Accepted
- Date: 2026-07-21
- Decision owners: Project maintainers

## Context

ADR-020 chose **sideload-only** acquisition for the browser-local model to keep `connect-src 'self'`
untouched: the user downloaded the model files themselves and selected them from disk. In practice
that friction — find the right files on Hugging Face, download ~3.3 GB, return and pick the folder —
is impractical for adoption. Most users expect to click once and have the model download.

Making that possible requires the app to fetch the weights itself, which means adding the model host
to `connect-src` — a change to the privacy boundary ADR-020 deliberately protected. This ADR makes
that trade explicit and supersedes ADR-020's sideload-only decision.

## Decision

Add **one-click model download** as the primary acquisition path, keeping the app **offline-first
everywhere else**. Sideload is retained as a secondary "advanced: load from files" fallback for
offline/air-gapped users.

- **CSP:** `connect-src` becomes `'self' https://huggingface.co https://*.hf.co`. Hugging Face
  `resolve/` URLs redirect same-origin to `/api/resolve-cache/…`, and weight bytes redirect to a
  **region-specific Xet CDN** under `*.hf.co` (e.g. `us.aws.cdn.hf.co`, `eu.aws.cdn.hf.co`). An
  exact single-host allow-list would break downloads outside that region, so the CDN is scoped to
  the `*.hf.co` wildcard — still Hugging Face infrastructure only, nothing broader. The
  security-headers check asserts this connect-src token set exactly so it cannot be silently widened.
- **App-driven fetch + our verify:** the app fetches each pinned file itself (not via the runtime's
  opaque resolver), streams it into a staging Cache Storage entry while computing an **incremental
  SHA-256** (never buffering a ~1.6 GB file to hash it), checks the digest against the pinned
  profile, and only then atomically publishes to the ready model cache. A mismatch, oversize, or
  cancellation aborts the whole acquisition and deletes staging. Same integrity guarantee as
  sideload.
- **Download-then-lock enforcement:** acquisition is the only code path that touches the network.
  The transformers.js engine sets `env.allowRemoteModels = false` on every load, so model load and
  inference read exclusively from the verified cache and cannot reach the network. An offline e2e
  asserts inference makes zero requests.
- **Sequential, streamed:** files download one at a time, streamed to cache, so memory stays bounded
  on modest-RAM devices (the weight files are ~1.6 GB each).

## Consequences

- Users get a one-click "Download model" flow with per-file + overall progress, a cancel control, a
  cached/ready indicator on return, a resume path for interrupted downloads, and a remove control.
- The privacy promise is preserved in substance: the default path (startup, imports, rules, ledger,
  dashboards, and AI inference) makes zero network requests; only the explicit download contacts the
  allow-listed hosts.
- `*.hf.co` is broader than one exact host; it is bounded to Hugging Face infrastructure and
  reachable only during the explicit download. Documented and enforced by the exact header check.
- Sideload code is retained (demoted), so the fully-offline acquisition option is not lost.

## Alternatives considered

- **Keep sideload-only (ADR-020):** rejected — the manual-download friction is impractical for
  adoption, which is the whole reason for this ADR.
- **Exact single CDN host in `connect-src`:** rejected — the Xet CDN is region-specific, so an exact
  host works for one region and silently breaks downloads elsewhere.
- **Self-host the pinned files on our origin:** would keep `connect-src 'self'`, but we would have to
  host and serve ~3.3 GB and keep it synced to the pinned revision — hosting cost and operational
  burden not justified versus the tightly-scoped HF allow-list.
- **Let the runtime download opaquely and verify after:** rejected — gives up per-file digest
  verification and atomic staged publish; app-driven fetch keeps the integrity guarantee.

## Validation

- `ModelDownloader` unit tests (injected fetch): publishes all files; digest mismatch aborts + cleans
  up; error response → `network`; thrown fetch → `network`; cumulative progress; empty-profile guard.
- Streaming staged-publish + incremental-hash unit tests (`stageVerifiedStream`,
  `publishStagingToReady`).
- The tightened `security:headers:check` asserts the exact connect-src set (verified to reject a
  broadened value).
- The offline e2e proves inference from a seeded cache makes zero external requests.
- Real one-click download and generation on WebGPU are validated manually by the maintainer (out of
  headless CI scope).

## Related decisions

- [ADR-020: Browser-local AI runtime and sideload-only acquisition](ADR-020-Browser-Local-AI-Runtime.md) — superseded by this ADR on the acquisition decision.
- [ADR-018: Provider-neutral AI core](ADR-018-Provider-Neutral-AI-Core.md)
- [ADR-003: WebGPU as optional local AI acceleration](ADR-003-Why-WebGPU.md)
