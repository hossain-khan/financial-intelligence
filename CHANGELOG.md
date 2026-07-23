# Changelog

All notable changes to this project will be documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases will use [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Interactive Local AI Financial Assistant chat page (`/chat` route in top navigation): enables on-device conversational cash-flow analysis, rule explainability, and spending guidance. Automatically ports the `<LocalAiPanel />` downloader when the browser-local model is not yet ready, includes a non-financial advice privacy disclaimer, starter topic chips, and responsive conversation controls.

- AI suggestions now show phase-aware progress ("Preparing model…" during first-run load, then
  "Analyzing N of M…"), a Cancel control that keeps any suggestions already found, and a
  per-inference deadline so one slow description degrades to an abstention instead of stalling the
  batch; the local model is warmed up once after load (issue #38 slice, browser-local only).
- AI-assisted merchant/category suggestions (issue #36, ADR-022): the transactions page gains an
  optional "AI-assisted suggestions" review section. An explicit "Suggest categories & merchants"
  action runs the on-device model over transactions still unresolved after rules/mappings/heuristics
  (reusing the same precedence oracle as the review queue), then lists proposals with confidence, a
  short rationale, evidence codes, and provenance ("model · on-device"). Accept applies a grounded
  category through the existing atomic correction path with `localAi` provenance and an eligibility
  recheck; "Accept for similar" also creates a narrow deterministic rule so future imports classify
  without the model. Reject records a `(digest, classifier version)` key so the same candidate is
  not re-proposed until the classifier version changes. Nothing auto-applies and deterministic rules
  always take precedence. Suggestions persist in a new additive IndexedDB `aiSuggestions` store
  (schema v11) separately from canonical classifications, holding only bounded provenance — never
  raw prompts or model output. The whole flow is network-free (accept-to-rule repeat-import
  e2e-enforced); CI exercises it with fake/scripted providers, and real on-device generation is
  verified manually. Merchant-label acceptance is deferred to the review-queue path.
- One-click browser-local model download (issue #33, ADR-021, supersedes ADR-020's sideload-only
  stance): the Settings "Local AI" panel now downloads the pinned model in one click — streamed file
  by file, SHA-256-verified against the profile, and published to the clearable `model` cache — with
  per-file + overall progress, a cancel control, a cached/ready indicator (and Remove) on return, a
  resume path for interrupted downloads, and plain-language errors. Manual file load is kept under an
  "Advanced" disclosure for offline/air-gapped users. `connect-src` gains
  `https://huggingface.co https://*.hf.co` (the region-specific Xet weight CDN), contacted only
  during the explicit download; the security-headers check asserts this set exactly. Model load and
  inference run with remote fetching disabled and make zero network requests (offline e2e-enforced).
- Pinned browser-local model profile (issue #33): the `gemma-3n-e2b-q4-classifier-v1` profile pins
  `onnx-community/gemma-3n-E2B-it-ONNX` at an immutable revision with dtype `q4` and per-file SHA-256
  digests, enabling model selection in the Settings "Local AI" panel. The runtime/model spike found
  the `q4f16` export crashes ONNX Runtime Web (a float16/float32 mismatch in Gemma 3n's AltUp block),
  so `q4` is pinned; the engine now reads dtype from the profile. Two output fixes came from the
  spike: the provider strips markdown code fences before parsing the model's JSON, and the output
  token budget was raised (with a one-sentence-rationale prompt) so classifications no longer
  truncate. The sideloader matches picked files by basename so a model's `onnx/` subfolder layout
  loads without manual path juggling. A full #32 corpus evaluation of the pinned model is still
  pending (see the evaluation baseline report).
- Browser-local AI provider scaffold (issue #33, ADR-020): a new
  `@financial-intelligence/ai-local` package implementing `ai-core`'s `AiProvider` with the
  `@huggingface/transformers` (transformers.js / ONNX Runtime Web) runtime isolated in a module
  worker, driven by a versioned `load`/`warmup`/`execute`/`cancel`/`unload`/`dispose` protocol.
  Model acquisition is local-file sideload only — files are SHA-256-verified against a pinned model
  profile, staged, and atomically published into the clearable `model` Cache Storage namespace — so
  `connect-src 'self'` is unchanged and the runtime never reaches the network. Includes a capability
  preflight (`unsupported`/`constrained`/`recommended`), strict schema validation of model output,
  cancellation and GPU device-loss handling, registration into the #32 evaluation harness, a
  Settings "Local AI" panel with a size/license disclosure, and an offline no-network regression.
  WebLLM was rejected because it cannot run the target Gemma 3n edge models. The specific model is
  pinned after a maintainer benchmark; model selection is disabled in the UI until then.
- AI evaluation harness and release thresholds (issue #32, ADR-019): a new
  `@financial-intelligence/ai-evaluation` package that imports only `ai-core` contracts and drives
  providers through the same `AiProvider` interface the app uses. It ships a versioned, SHA-256
  digest-locked synthetic corpus (one JSON file per case) with a fixture linter that rejects
  real-data-shaped content; task-specific metrics (schema-valid/invalid-output rate, accuracy,
  abstention precision/recall, allowed-ID grounding violations, privacy violations, latency
  percentiles) with distinct refusal/timeout/invalid/abstention outcomes; six fake providers
  (perfect, abstaining, malformed, leaky, slow, nondeterministic); an in-process runner with bounded
  concurrency, per-case timeout, and cancellation; a profile-keyed result schema with
  `compareEvalResults` regression comparison and an artifact privacy guard; and a threshold policy
  with hard structural safety gates plus support records (`supported`/`experimental`/`failed`). No
  real provider, model runtime, network access, CLI, or new CI workflow is added; fast fake-provider
  self-tests run in the existing per-PR gate.
- Provider-neutral AI core that opens Phase 4 (issue #31, ADR-018): a dependency-free
  `@financial-intelligence/ai-core` package with one generated versioned task wire schema
  (`schemas/ai-task.schema.json`) covering merchant resolution, category classification, query
  planning, and insight wording; a provider interface plus router that selects only the configured
  profile supporting the exact task version, validates request and response, enforces
  workspace-current allowed IDs, applies a one-shot repair policy, and settles exactly once under an
  `AbortSignal` and deadline; an always-available `NoAiProvider`; immutable suggestion and audit
  values that store redacted digests only, never prompt or response bodies; an application
  provider-config port that seeds and persists a default `kind: none` profile in a new IndexedDB
  `aiProviderProfiles` store (schema v10); and a dependency-boundary test plus a no-network
  regression proving the rules-only default path issues zero AI/model/API requests. No provider
  runtime, model download, or network destination is added; rules-only behavior is unchanged.
- Migration, format-compatibility, and disaster-recovery drills that close Phase 3: a
  machine-readable compatibility registry (in `@financial-intelligence/qualification`) enumerating
  every independently-versioned portable format with a drift test that fails if a live version
  constant diverges; an immutable released-fixture corpus under `test-fixtures/compatibility/`
  (canonical documents, a Financial Brain export, and an encrypted backup) locked by committed
  SHA-256 digests; a version-matrix migration suite proving every supported IndexedDB version (1–9)
  upgrades losslessly and idempotently, aborts a mid-upgrade failure to the prior valid state, and
  fails closed on a too-new database; backup and Brain compatibility drills that reject
  wrong-passphrase, tampered, future-major, and missing-required-section variants against the frozen
  bytes; fresh-profile Playwright recovery drills (restore-as-new, unopenable-database recovery
  screen); a scheduled full-matrix CI workflow with the high-signal integrity and current/previous
  paths blocking per PR; and a compatibility/recovery guide with user playbooks (ADR-017,
  docs/23-COMPATIBILITY-AND-RECOVERY.md).
- Supported-browser, accessibility, and performance qualification harness: a new
  `@financial-intelligence/qualification` package with a deterministic seeded workload generator
  (reconciled decimal-safe totals, content-digest manifest, 1k/10k/50k tiers), a versioned
  `PerfResult` schema that compares only matching environment profiles, and an artifact-privacy guard
  that keeps descriptions/amounts/account labels out of any result. User-visible `performance.measure`
  instrumentation (inert unless `?perf=1`), a Chromium `perf` Playwright project that measures the
  NFR budgets and asserts bounded DOM, a `scripts/check-perf-result.mjs` validator, a non-blocking CI
  `performance` job uploading a bounded artifact, and expanded axe coverage of the ledger, dashboard,
  and backup/restore journeys. Core no-AI qualification passes without WebGPU (ADR-016,
  docs/22-QUALIFICATION-MATRIX.md).
- Production encrypted backup and restore: the workspace-backup payload gains a required
  authenticated manifest (per-section record counts, canonical byte lengths, and SHA-256 digests
  inside the AES-GCM payload) so truncated or tampered backups fail closed before any restore; the
  Argon2id/AES-GCM work runs in a short-lived off-thread worker; and restore stages the decrypted
  snapshot in a temporary database with a quota preflight, shows a metadata-only preview and conflict
  plan, and applies restore-as-new, replace, or a conflict-free merge as one atomic transaction that
  leaves the original workspace intact on failure. Conflicting merges are rejected rather than
  overwritten, abandoned staging databases are cleaned up on startup, and there is no v1 backup
  reader (snapshot format bumped to v2; ADR-015).
- PWA install, offline-update, storage, and cache-lifecycle hardening: an explicit service-worker
  lifecycle state machine that downloads updates in the background and activates only after the user
  confirms at a safe boundary, defers activation while an import, backup, bulk edit, or migration is
  in progress, and coordinates multiple tabs over `BroadcastChannel`; an app-shell navigation
  fallback so core routes open offline with no runtime caching; a Settings storage panel showing
  usage/quota (labelled an estimate) and durable-persistence status, an install affordance with
  Safari/iOS guidance, and a per-namespace cache inventory whose clear action never touches
  IndexedDB, exports, or canonical workspaces; and a startup recovery screen that preserves all data
  and offers retry, diagnostic export, and backup guidance when the local database cannot be opened
  (ADR-014).
- Local text-based PDF statement import: a `pdfjs-dist`-backed extractor running in an isolated
  worker with a hardened no-network, no-eval, no-active-content, no-nested-worker configuration; an
  immutable quantized text-page model; a pure layout-adapter registry with unique/confident adapter
  selection and one generic tabular adapter (date / description / signed-amount or debit-credit,
  handling repeated headers/footers, wrapped multi-line rows, page continuation, and summary rows);
  `page:N/items:a-b` provenance; image-only, password-protected, and unsupported/ambiguous documents
  that fail closed with guidance; and reuse of the shared candidate validation, duplicate review,
  and atomic commit pipeline so PDF, OFX, and CSV records deduplicate via the canonical fingerprint
  (ADR-013).
- Local OFX and QFX statement import: a purpose-built bounded parser for OFX 1.x SGML and OFX 2.x
  XML bank and credit-card statements, a content-signature format dispatcher, account and
  reconciliation preview with masked account hints, and reuse of the existing duplicate review and
  atomic commit pipeline. The parser rejects DTDs, entities, and external references, follows no
  URLs, decodes only documented encodings, enforces structural limits, and shares the canonical
  fingerprint so OFX and CSV records deduplicate against each other (ADR-012).
- Pie-chart dollar favicon, Apple touch icon, and regular/maskable PWA install icons.
- Cloudflare Workers Static Assets reference deployment with a pinned Wrangler toolchain,
  Git-connected production and preview guidance, SPA fallback, security-header reuse, and dry-run
  validation.
- Canonical product design-system guidance for visual tokens, typography, spacing, shared component
  patterns, responsive behavior, accessibility evidence, and reuse-before-invention agent workflow.
- Mandatory documentation impact audits and a pull-request checklist that make each implementation
  PR account for specifications, schemas, ADRs, changelog, roadmap, and compatibility evidence.
- Technology stack plan, engineering guidelines, and ADR-004.
- Initial pnpm workspace and offline React application foundation.
- Initial product, architecture, AI, learning, import, privacy, UX, plugin, and roadmap specifications.
- Versioned JSON Schemas for transactions, merchants, categories, imports, dashboards, AI providers, and the Financial Brain.
- Synthetic examples for statement import, configuration, dashboard layout, and learned knowledge.
- Initial architecture decision records for offline-first operation, IndexedDB persistence, and optional WebGPU inference.
- Accessible local transaction ledger with controlled filters, stable starter categories, provenance and edit-history drill-down, locked manual classifications, and reversible bulk edits.
- Exact and likely duplicate review with deterministic evidence, visible keep/link decisions, durable undo, and four-month overlap coverage.
- Decimal-safe cash-flow summaries grouped by currency, month, account, and category, with shared ledger filters, incomplete-period and unresolved-review disclosures, accessible fact tables, transaction drill-down, and spreadsheet-safe filtered CSV export.
- Experimental versioned full-workspace backups with Argon2id-derived AES-GCM encryption, authenticated metadata, browser download, integrity-checked restore preview, adversarial tests, bounded benchmarks, and no restore mutation path.
- Deterministic merchant aliases and categorization rules with conflict explanations, import-time rule application, review and bulk correction workflows, and canonical classification provenance.
- Versioned Financial Brain export/import preview and merge support for categories, merchants, rules, recurring decisions, safe preferences, schema validation, resource bounds, and possible-duplicate disclosure.
- Deterministic transfer and recurring-series proposals with explicit confirmation/dismissal, transfer-aware cash-flow analysis, and persistent local decisions.
- Accessible merchant, recurring, savings-rate, and money-flow dashboards whose rows and edges drill down to the exact contributing ledger records.
- Phase 2 knowledge stores in encrypted workspace snapshots with backward-compatible reads of pre-Phase-2 experimental snapshots.
- Atomic, stale-safe correction and Financial Brain operations with local before/after journals and conflict-safe undo.
- Transactional transfer confirmation and recurring edit/split/merge/supersession/invalidation history with recoverable undo.
- Revision-consistent dashboard snapshots, shared merchant/tag/review/recurring filters, URL-preserved navigation, accessible charts, and exact ledger drilldown.

### Changed

- Download the browser-local model from a single project-controlled Cloudflare R2 mirror
  (`https://light-llm-storage.gohk.xyz/…`) instead of Hugging Face (ADR-023, supersedes ADR-021's
  download host): faster, more predictable first-run downloads not gated by Hugging Face. `connect-src`
  tightens from `'self' https://huggingface.co https://*.hf.co` to `'self'
  https://light-llm-storage.gohk.xyz` — one exact host, no wildcard — a net reduction in allowed
  network surface. The files, pinned revision provenance, and per-file SHA-256 integrity checks are
  unchanged, so a wrong or compromised mirror still cannot substitute a different model; sideload
  remains the offline fallback.
- Scope 1.0 AI to **browser-local only** in the specs: with self-hosted (#34) and BYOK remote (#35)
  provider adapters descoped, the product/functional requirements, vision, UX guidelines, roadmap,
  AI-architecture, and evaluation baseline now mark self-hosted/remote/BYOK AI as deferred past 1.0.
  The remote-mode guardrails (consent, field preview, key handling) are retained as future
  requirements; no remote code path exists.
- Enable persistent Cloudflare Worker invocation logs at 100% sampling while keeping distributed
  traces disabled and application financial data local.
- Mark Phase 2 complete after its delivery and hardening issues passed repository verification and
  supported-browser qualification; identify Phase 3 as the next planned phase.

### Fixed

- Fix unstyled button styling across the Transactions page by adding the missing `.primary-button` CSS class, explicit disabled button states, and proper button class names for Category "Save label", "Export filtered CSV", and Bulk review "Preview affected count" controls.
- Fix the AI-suggestions "Suggest" action freezing the tab ("Page Unresponsive") when transactions
  were present: eligibility loaded the ledger by paging a sorting query, which re-scanned and
  re-deserialized the entire IndexedDB ledger on the main thread once per page. It now reads the
  ledger once (`ListAllTransactions`). Diagnosed via on-device instrumentation (issue #38 slice).
- Center the local-mode checkmark inside its mint status circle by isolating privacy-seal text styles.
- Keep shared button press behavior compatible with the production style CSP and provide explicit
  non-personal autofill context for encrypted-backup passphrase forms.
- Precompile portable JSON Schema validators during the build so the deployed application starts
  under the production Content Security Policy without unsafe JavaScript evaluation, while retaining
  the narrow WebAssembly compilation permission required by local Argon2id backups.
- Apply saved merchant aliases and deterministic rules during later imports instead of limiting rule evaluation to the review queue.
- Keep confirmed and dismissed recurring decisions visible in recurring summaries.
- Pass exact dashboard contribution IDs into ledger and cash-flow drilldown queries.
- Align Financial Brain rule and recurring-decision runtime fields with the normative JSON Schema.
- Make the dashboard responsive presentation use the application design system instead of an isolated dark HTML treatment.
