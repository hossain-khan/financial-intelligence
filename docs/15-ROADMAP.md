# Roadmap

## Purpose

Sequence delivery by risk-reducing vertical slices. Dates are intentionally absent until a team and capacity exist.

## Planning rules

- Privacy, data integrity, accessibility, and backup are release features, not final hardening phases.
- Each milestone produces an end-to-end demonstrable workflow and migration path.
- A milestone exits on evidence, not feature count.
- Model/provider/plugin choices remain replaceable and require evaluation.

## Phase 0 — Foundations

**Outcome:** Executable architecture and quality gates.

- Choose build framework/tooling and record ADR.
- Establish package boundaries, strict TypeScript, formatting, linting, tests, schema validation, and CI.
- Implement decimal/date/ID value objects and generated schema types.
- Add IndexedDB repository contract, migration harness, worker protocol, and synthetic fixtures.
- Establish accessibility test baseline, production CSP, dependency/SBOM checks, and offline network assertions.

**Exit criteria:** Application shell works offline; domain does not depend on UI/storage; schema examples validate; first migration and recovery test pass.

## Phase 1 — Trustworthy CSV ledger

**Outcome:** A user imports CSV locally and reviews a correct transaction ledger.

- Workspace/account onboarding and storage/backup education.
- CSV intake, mapping, normalization, validation, preview, atomic commit, and error export.
- Transaction list, filters, details, provenance, edit/lock, and import deletion.
- Exact/likely duplicate workflow for overlapping imports.
- Starter categories and manual classification.
- Basic accessible cash-flow/category tables and charts.
- Unencrypted data export plus encrypted full backup/restore spike; finalize crypto ADR before release.

**Exit criteria:** Maintained CSV/overlap/malicious fixtures pass; first-import usability and keyboard flow meet targets; crash/quota tests preserve data.

## Phase 2 — Financial Brain and deterministic learning

**Status: Complete.** The core slices and follow-up hardening for atomic learning, decision
lifecycle recovery, and revision-consistent dashboards are merged. The combined qualification
passed repository verification and the supported Chromium, Firefox, and WebKit browser jobs. See
[Phase 2 implementation and hardening](20-PHASE-2-IMPLEMENTATION.md).

**Outcome:** Returning imports require materially fewer corrections.

- Merchant catalog/aliases, typed rule engine, precedence, conflicts, preview, bulk review, and undo.
- Financial Brain export/import/merge with schemas and compatibility tests.
- Transfer proposals/confirmation and correct cash-flow exclusion.
- Recurring-series detection and review.
- Overview, merchant, recurring, savings, money-flow visualization with accessible alternatives.

**Exit criteria:** Repeat-correction target is met on representative synthetic journeys; Brain round-trip/merge and rule conflict tests pass; every aggregate drills down.

## Phase 3 — Standard formats and resilient PWA

**Status:** Complete. All milestone issues (#25–#30) are merged; the format-contract, migration/
recovery, performance, and WCAG 2.2 AA gates pass across the supported browser matrix.

**Outcome:** Broader statement support and production-grade offline lifecycle.

- OFX/QFX parser adapters and fixtures. **Done** for OFX 1.x SGML and OFX 2.x XML bank and
  credit-card statements (issue #25, ADR-012); investment, loan, bill-pay, and online-banking
  message sets remain out of scope and surface bounded unsupported-section warnings.
- Selected text-PDF adapter(s) based on demand and fixture availability. **Done** for the framework
  and one generic tabular layout (issue #26, ADR-013): PDF.js-backed text extraction runs in an
  isolated worker with a hardened no-network, no-eval, no-active-content configuration; image-only,
  encrypted, and unsupported/ambiguous layouts fail closed with guidance; institution-specific
  layouts remain additive follow-ups.
- Installable PWA, coordinated updates, storage management, model/source cache controls. **Done**
  (issue #27, ADR-014): explicit update lifecycle state machine with multi-tab coordination and
  protected-operation deferral, app-shell navigation fallback, storage estimate/persistence and
  per-namespace cache inventory/clear that never touches canonical data, install affordance with
  Safari/iOS guidance, and a startup recovery screen that preserves data on a failed database open.
  Model and source cache namespaces are declared for #28/#38 but not yet populated.
- Git-connected Cloudflare Workers Static Assets reference deployment with SPA routing, security
  headers, preview versions, and production verification.
- Full backup encryption implementation, restore replacement/merge policy, and recovery
  documentation. **Done** (issue #28, ADR-015): production snapshot v2 with an authenticated
  per-section manifest, worker-isolated Argon2id/AES-GCM, staged temporary-database validation with
  quota preflight, and atomic restore-as-new / replace / conflict-free merge with a metadata-only
  preview. Conflicting merges are rejected (documented v1 limitation) and there is no v1 backup
  reader.
- Published browser support and reference workload benchmarks. **Done** (issue #29, ADR-016): a
  deterministic seeded-workload generator, a versioned performance-result schema with
  environment-profile comparison and an artifact-privacy guard, user-visible timing instrumentation,
  a Chromium perf-smoke Playwright project wired into CI as an informational (non-blocking) job, and
  expanded axe coverage of the ledger, dashboard, and backup/restore journeys. Core no-AI
  qualification passes without WebGPU; capability recording is informational for Phase 4. See
  [Qualification matrix](22-QUALIFICATION-MATRIX.md).

- Migration, format-compatibility, and disaster-recovery drills. **Done** (issue #30, ADR-017): a
  machine-readable compatibility registry with a live-constant drift gate, an immutable released-
  fixture corpus locked by SHA-256 digests, a version-matrix + fault-injection suite proving every
  supported IndexedDB version upgrades losslessly (and aborts to the prior valid state on failure),
  backup/Brain future-major/tamper/missing-section rejection against frozen bytes, fresh-profile
  Playwright recovery drills, and a compatibility/recovery guide with user playbooks. Per-PR blocking
  integrity + current/previous paths; scheduled full matrix. See
  [Compatibility and recovery](23-COMPATIBILITY-AND-RECOVERY.md).

**Exit criteria:** Format contract suite, update/migration/recovery drills, performance and WCAG 2.2 AA gates pass. **Met.**

## Phase 4 — Optional AI assistance

**Outcome:** AI improves uncertain tasks without weakening local correctness.

- Task-based AI core, no-AI adapter, structured validation, evaluation harness. (Core landed in #31: `@financial-intelligence/ai-core` with versioned task schemas, router, `NoAiProvider`, and a persisted `kind: none` default. Evaluation harness landed in #32: `@financial-intelligence/ai-evaluation` with a digest-locked synthetic corpus, task-specific metrics, fake providers, profile-keyed results, and hard safety gates; the browser-local adapter (#33) registers into it.)
- Browser-local provider selected after capability/license/quality benchmarks. (Landed in #33: `@financial-intelligence/ai-local` using transformers.js in a worker, sideload-only acquisition with SHA-256 integrity, capability preflight, and offline execution. The model profile is now pinned to Gemma 3n E2B (ONNX, dtype q4) after a WebGPU spike, acquired by one-click download from allow-listed Hugging Face hosts (ADR-021, superseding ADR-020's sideload-only stance) with sideload as a secondary fallback; a full #32 corpus evaluation of the pinned model is still pending. See ADR-020 and ADR-021.)
- Self-hosted (#34) and BYOK remote provider (#35) adapters. **Descoped.** Maintainer decision: The project remains strictly local-first and privacy-first with zero off-device financial data transmission, relying exclusively on browser-local LLM execution (#33 / #95).
- Merchant/category suggestions and natural-language query planning with deterministic execution. (Merchant/category suggestions landed in #36, ADR-022: an on-device suggestion review section on the transactions page, proposals persisted separately in the `aiSuggestions` store (v11), accept through the atomic correction path with `localAi` provenance and accept-to-rule, rejection memory, and a network-free repeat-import e2e. Review-only — auto-apply is deferred behind a #32 corpus verdict and opt-in. Natural-language query planning (#37) remains.)
- Model management, cancellation, error recovery, and classifier versioning.

**Exit criteria:** Zero silent local-to-remote fallback; evaluation thresholds and invalid-output tests pass; numeric NL answers reproduce from local queries; rules-only mode remains complete.

## Phase 5 — v1.0 hardening

**Outcome:** Stable public release.

- Resolve all MUST requirements and high threat-model risks.
- Compatibility/migration support for prior preview versions.
- Security reporting, supported-version, release-signing, and incident processes.
- Documentation, contributor workflow, demo workspace using only synthetic data.
- Localization architecture and initial locale coverage.

**Exit criteria:** Product release acceptance in the PRD is satisfied with published evidence and no unresolved critical/high security findings.

## Post-v1 candidates

- Additional institution/community import adapters and local OCR.
- Budgets, goals, liabilities, investments, and scenario planning with careful scope.
- Encrypted user-controlled sync that cannot read plaintext.
- Household profiles and merge workflows without mandatory service accounts.
- Plugin SDK and reviewed registry after the permission/isolation model passes security review.
- Mobile packaging only if it preserves export and local-first behavior.

Candidates are not commitments. Tax optimization, automated advice, live bank sync, and payment initiation require separate product/legal/security evaluation and must not enter by incremental scope creep.

## Decision backlog

| Decision | Needed by |
| --- | --- |
| UI/build/test stack | Decided in ADR-004 |
| Browser support matrix | Phase 0/1 |
| Backup KDF/container | Phase 1 completion |
| First PDF layouts | Generic tabular layout decided in ADR-013; institution layouts are follow-ups |
| Local runtime/model/license | Phase 4 |
| Provider adapters and consent text | Phase 4 |
| Plugin sandbox/registry governance | Post-v1 |

## Versioning

- Pre-1.0 application releases may change internal APIs but migrate user data.
- Portable schemas use their own semantic versions and explicit migration support.
- v1.0 promises backward-compatible public contracts within the major version.
- Deprecations state replacement and removal milestone.

## Related documents

- [Product requirements](03-PRODUCT-REQUIREMENTS.md)
- [Non-functional requirements](06-NON-FUNCTIONAL-REQUIREMENTS.md)
- [ADRs](adr/)
