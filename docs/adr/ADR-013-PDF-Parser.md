# ADR-013: Text-based PDF statement import using a hardened, worker-isolated PDF.js

- Status: Accepted
- Date: 2026-07-21
- Decision owners: Project maintainers

## Context

Phase 3 adds text-based PDF statement import (issue #26). Unlike CSV (ADR-005) and OFX (ADR-012),
extracting text from a PDF is not something the project can reasonably reimplement: the format is a
large binary container with compressed content streams, cross-reference tables, multiple font and
encoding schemes, and optional encryption. A purpose-built parser is not viable, so a third-party
PDF engine is required.

PDF is also the most hostile import surface we accept. A PDF can carry document-level JavaScript,
launch/URI actions, embedded files, external references, and font programs that have been used for
remote code execution (for example CVE-2024-4367 in older PDF.js, an `eval`-based font exploit).
The default analysis path must remain fully offline, CSP-safe, and free of active-content execution,
and application-owned bounds, cancellation, provenance, and image-only/unsupported classification
cannot be delegated to the library.

## Decision

Add `packages/import-pdf`, implementing the existing `@financial-intelligence/import-core`
`StatementParser` contract with parser id `pdf` and version `1.0.0`, and mirroring the worker
protocol, cancellation, progress, bundle-size check, and stable error-code patterns of
`packages/import-csv` and `packages/import-ofx`.

Use the maintained Mozilla **PDF.js distribution (`pdfjs-dist`, Apache-2.0), pinned to `6.1.200`**,
for local byte-based text extraction. The decision is constrained as follows:

- **Text-content APIs only.** We call `getDocument`, `getPage`, `getTextContent`, and `getMetadata`.
  We never render pages to a canvas, never instantiate the viewer, and never touch annotations,
  forms, JavaScript/actions, attachments, links, or embedded files. Canonical amounts come from the
  text layer, never from rendered output.
- **Hardened, no-network configuration.** Every document is opened with an in-memory `Uint8Array`
  and `{ isEvalSupported: false, useWorkerFetch: false, disableFontFace: true, useSystemFonts: false,
  stopAtErrors: true }`, with `cMapUrl`/`standardFontDataUrl` left unset so PDF.js has no location
  to fetch from. `isEvalSupported: false` specifically closes the CVE-2024-4367 class of font-eval
  execution as defense in depth (our pinned version is already past the fix).
- **No nested worker, no CDN.** `packages/import-pdf` runs inside its own dedicated Web Worker.
  Rather than let PDF.js spawn a *second* worker (which would fetch a worker script), we assign
  `globalThis.pdfjsWorker` to the dynamically imported worker module so PDF.js runs in main-thread
  ("fake worker") mode within our worker. The `legacy` build is used because it also runs under the
  Node/Vitest test environment; the modern build touches browser globals at module evaluation time.
  PDF.js is left external to our worker bundle and dynamically imported, so its assets are bundled
  locally by Vite and code-split — never loaded from a CDN and never present in the greppable
  forbidden-string budget check.
- **Bounded extraction.** `%PDF-` content is validated before work begins, and file-byte, page,
  per-page text-item, text-item-length, total-text-character, issue, output-row, output-character,
  and runtime limits are enforced, starting from the CSV/OFX 16 MiB envelope. Password-protected or
  encrypted PDFs are rejected without ever collecting or retaining a password. A document with no
  usable text after extraction is classified `IMAGE_ONLY_DOCUMENT` rather than silently empty; OCR
  remains a separate, later, disclosed capability.

Extracted content is normalized into an immutable `PdfTextDocument` of quantized-coordinate text
items (raw positions retained for provenance). Pure `PdfStatementLayoutAdapter`s detect and extract
over that model. A registry selects a **unique** winning adapter: the top score must clear the
adapter's declared minimum and beat the runner-up by a margin, otherwise the document is
`UNSUPPORTED_LAYOUT`. Ties, missing columns, and low text coverage never silently pick an adapter.
v1 ships one generic tabular adapter (date / description / signed-amount or debit-credit columns)
that handles repeated headers/footers, wrapped multi-line descriptions, page continuation, and
summary rows, and never invents a missing date, amount, sign, or description. Rows carry
`page:N/items:a-b` provenance and flow through the same format-neutral `buildCandidatesFromDrafts`
helper, preview, duplicate review, and `CommitAcceptedImport` service as CSV and OFX.

## Consequences

### Positive

- Text-based PDF statements enter the identical canonical pipeline as CSV and OFX and deduplicate
  against them through the shared fingerprint.
- Hostile active content is inert: no eval, no network, no rendering, no nested worker, and the
  offline network-leak Playwright test proves no runtime request.
- The layout-adapter boundary makes adding vetted institution layouts additive, each with its own
  version and synthetic fixture corpus.

### Negative

- A large third-party runtime dependency (`pdfjs-dist`, ~1.2 MB worker) now ships, dynamically
  imported and code-split so it loads only when a PDF is parsed. Its size means the OFX-style
  whole-bundle forbidden-string check cannot cover the vendored source; that guarantee moves to (a)
  keeping PDF.js external to our greppable worker bundle and (b) the browser network-leak test.
- We must track `pdfjs-dist` security advisories and pinned-version upgrades as a high-risk boundary.
- Only the generic tabular layout is supported in v1; other layouts return unsupported with guidance
  rather than a best-effort guess.

## Alternatives considered

- **A purpose-built PDF text extractor (as done for OFX in ADR-012):** rejected. PDF's binary
  container, content-stream compression, font/encoding handling, and encryption make a safe
  from-scratch extractor impractical and far riskier than a maintained, widely-audited engine.
- **Rendering pages and running OCR:** rejected for v1. It would introduce image processing and a
  probabilistic step into the canonical amount path; OCR is deferred as a separate, disclosed
  capability.
- **Letting PDF.js run in its own worker with `workerSrc`:** rejected. It adds a second worker and a
  fetched worker script; running PDF.js in main-thread mode inside our own worker keeps isolation
  while removing that fetch.
- **Bundling CMaps/standard fonts locally:** deferred. They matter only for CJK/glyph coverage;
  leaving the URLs unset keeps the path network-free, and local CMaps can be added behind the same
  no-network guarantee if demand appears.

## Validation

- Synthetic tabular PDF fixtures produce correct canonical candidates through the shared commit path
  with `page:N/items:a-b` provenance and parser id/version.
- Adversarial tests cover image-only, password-protected/encrypted, non-PDF, oversized, page/item/
  text-limit, unsupported-layout, and ambiguous-adapter cases, all failing closed.
- Adapter tests cover repeated headers/footers, wrapped multi-line rows, page-boundary continuation,
  debit/credit vs signed columns, parenthesized/negative amounts, summary-row skipping, and the
  no-invention rule for missing dates/amounts.
- A fixture carrying document JavaScript and a URI-link annotation is shown inert; a spied global
  `fetch` is never called during extraction, and main-thread PDF.js mode is asserted.
- Cross-format tests confirm PDF, OFX, and CSV records deduplicate via the shared fingerprint.
- Chromium, Firefox, and WebKit Playwright import flows run under the local network guard with
  accessibility assertions.

## Related decisions

- [ADR-005](ADR-005-CSV-Parser.md)
- [ADR-012](ADR-012-OFX-Parser.md)
- [ADR-001](ADR-001-Offline-First.md)
- [ADR-010](ADR-010-CSP-Safe-Generated-Validators-And-WebAssembly.md)
- [Import pipeline](../11-IMPORT-PIPELINE.md)
- [Security and privacy](../12-SECURITY-AND-PRIVACY.md)
