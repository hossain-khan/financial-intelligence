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

**Status:** In progress.

**Outcome:** Broader statement support and production-grade offline lifecycle.

- OFX/QFX parser adapters and fixtures. **Done** for OFX 1.x SGML and OFX 2.x XML bank and
  credit-card statements (issue #25, ADR-012); investment, loan, bill-pay, and online-banking
  message sets remain out of scope and surface bounded unsupported-section warnings.
- Selected text-PDF adapter(s) based on demand and fixture availability.
- Installable PWA, coordinated updates, storage management, model/source cache controls.
- Git-connected Cloudflare Workers Static Assets reference deployment with SPA routing, security
  headers, preview versions, and production verification.
- Full backup encryption implementation, restore replacement/merge policy, and recovery documentation.
- Published browser support and reference workload benchmarks.

**Exit criteria:** Format contract suite, update/migration/recovery drills, performance and WCAG 2.2 AA gates pass.

## Phase 4 — Optional AI assistance

**Outcome:** AI improves uncertain tasks without weakening local correctness.

- Task-based AI core, no-AI adapter, structured validation, evaluation harness.
- Browser-local provider selected after capability/license/quality benchmarks.
- Self-hosted and one BYOK provider adapter; disclosure, consent, key handling, cost/resource controls.
- Merchant/category suggestions and natural-language query planning with deterministic execution.
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
| First PDF layouts | Phase 3 |
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
