# Changelog

All notable changes to this project will be documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases will use [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

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

- Enable persistent Cloudflare Worker invocation logs at 100% sampling while keeping distributed
  traces disabled and application financial data local.
- Mark Phase 2 complete after its delivery and hardening issues passed repository verification and
  supported-browser qualification; identify Phase 3 as the next planned phase.

### Fixed

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
