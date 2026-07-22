# ADR-023: Project-controlled model download mirror

- Status: Accepted
- Date: 2026-07-22
- Decision owners: Project maintainers

## Context

ADR-021 made one-click model download the primary acquisition path and allow-listed the Hugging Face
hosts (`https://huggingface.co` plus the region-specific Xet weight CDN under `https://*.hf.co`) in
`connect-src`. In practice that path is slow and unreliable: downloads route through Hugging Face's
region-specific Xet CDN, throughput varies, and acquisition can be rate-limited or gated, which is a
poor first-run experience for a ~3 GB model.

The pinned files are byte-for-byte fixed and already integrity-checked by per-file SHA-256 digests in
the model profile, so *where* they are fetched from does not affect *what* is loaded — only speed and
availability. That makes the download host a swappable mirror rather than a trust anchor.

## Decision

Serve the pinned model files from a **single project-controlled Cloudflare R2 mirror** and download
only from it, superseding ADR-021's Hugging Face host allow-list.

- **Mirror:** `https://light-llm-storage.gohk.xyz/gemma-3n-E2B-it-ONNX` holds byte-identical copies of
  the eight pinned `q4` files. It is stored on the model profile as `downloadBaseUrl`; each file is
  fetched from `${downloadBaseUrl}/${file.path}`.
- **CSP:** `connect-src` becomes `'self' https://light-llm-storage.gohk.xyz` — one **exact** host, no
  wildcard. `check-security-headers` asserts this exact token set so it cannot be silently widened.
- **Provenance vs. host are decoupled:** `modelRepo`/`modelRevision` stay in the profile as the record
  of the upstream source (`onnx-community/gemma-3n-E2B-it-ONNX@d3068b2…`); `downloadBaseUrl` is where
  bytes come from. The mirror is populated from that exact upstream revision.
- **Integrity is unchanged and still authoritative:** every downloaded file is streamed through an
  incremental SHA-256 and checked against the profile digest before it is published to the ready
  cache. A wrong, stale, or compromised mirror cannot substitute a different model — verification
  fails closed and staging is discarded, exactly as before.
- **Everything else is unchanged:** download is still the only code path that touches the network;
  the runtime loads and infers from the verified cache with `allowRemoteModels = false`; sideload
  ("Advanced: load from files") remains for offline/air-gapped users.

## Consequences

- Faster, more predictable first-run downloads from infrastructure we control, no longer gated by
  Hugging Face throughput or access controls.
- `connect-src` is **tighter** than before: one exact host instead of `huggingface.co` plus a
  `*.hf.co` wildcard. This is a net reduction in allowed network surface.
- We now operate a mirror: it must stay in sync with the pinned revision and remain available. If it
  is down, download fails with the existing network error and rules-only mode is unaffected; the
  sideload fallback still works. Keeping the mirror's files byte-identical to the pinned digests is an
  operational requirement — a drift is caught by the client's digest check (fails closed), not served.
- The `downloadBaseUrl` field generalizes acquisition, so a future profile can point at a different
  mirror without code changes (only a CSP + header-check update).

## Alternatives considered

- **Keep the Hugging Face hosts (ADR-021):** rejected — the slow, sometimes-gated CDN path is the
  problem this ADR fixes.
- **Allow both HF and the mirror in `connect-src`:** rejected — widens the network surface for no
  benefit; the mirror is authoritative for downloads and HF is no longer contacted at runtime.
- **Wildcard the mirror domain (`*.gohk.xyz`):** rejected — an exact host is the tightest CSP that
  works; there is no region-specific redirect to accommodate (unlike HF's Xet CDN).
- **Bundle weights in the app origin (`connect-src 'self'`):** rejected — hosting ~3 GB in the
  deployed asset bundle is impractical and collides with the Cloudflare asset-size limits; a
  dedicated object-storage mirror is the right tool.

## Validation

- `modelFileUrl` unit test asserts the URL is built from `downloadBaseUrl` (no Hugging Face host).
- `downloadModel` unit tests (injected fetch) still cover publish-all, digest-mismatch abort, network
  error, and progress — unchanged behavior against the new base URL.
- `check-security-headers` asserts the exact `connect-src` token set (`'self'` + the mirror), verified
  to reject any broadened value.
- The offline e2e proves inference from a seeded cache makes zero external requests.
- Real one-click download from the mirror on WebGPU is validated manually by the maintainer (out of
  headless CI scope).

## Related decisions

- [ADR-021: One-click browser-local model download](ADR-021-One-Click-Model-Download.md) — superseded on the download-host decision; the one-click flow, app-driven fetch, streamed staged-publish, and SHA-256 verification are retained.
- [ADR-020: Browser-local AI runtime](ADR-020-Browser-Local-AI-Runtime.md)
- [ADR-018: Provider-neutral AI core](ADR-018-Provider-Neutral-AI-Core.md)
