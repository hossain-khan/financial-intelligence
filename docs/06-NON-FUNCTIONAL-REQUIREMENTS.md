# Non-Functional Requirements

## Purpose

Define quality attributes and measurable service levels for a local-first application.

## Supported reference workloads

- **Small:** 5,000 transactions, 20 imports, 5 accounts.
- **Typical:** 50,000 transactions, 200 imports, 20 accounts, 2,000 rules/aliases.
- **Large:** 250,000 transactions, 1,000 imports, 50 accounts, 10,000 rules/aliases.

Reference performance is measured on a currently supported mid-range laptop with a Chromium-class browser; exact hardware/browser versions must be pinned in release evidence.

## Privacy

- **NFR-001:** Local/no-AI mode MUST make zero application-initiated network requests after static assets and user-chosen model assets are installed.
- **NFR-002:** No client/application telemetry, crash upload, advertising, fingerprinting, or
  third-party analytics may be enabled by default. Static-host invocation logging requires explicit
  maintainer approval, a documented retention/data boundary, and must not include custom financial
  or user-authored application log fields.
- **NFR-003:** Sensitive data MUST NOT appear in URLs, service-worker cache keys, console logs, unredacted diagnostics, or notification content.
- **NFR-004:** Exported Financial Brain documents MUST exclude raw transactions, source documents, account numbers, secrets, and model transcripts.

## Security

- **NFR-010:** Treat source files, transaction descriptions, model output, imported JSON, and plugin content as untrusted.
- **NFR-011:** Enforce a restrictive Content Security Policy with no unsafe evaluation in production.
- **NFR-012:** Remote endpoints MUST use secure transport except explicitly confirmed loopback development endpoints.
- **NFR-013:** Backups MUST use authenticated encryption; no plaintext recovery hint may reveal the passphrase.
- **NFR-014:** Dependencies, model assets, plugin packages, and migrations MUST have integrity/provenance controls appropriate to their distribution channel.

## Performance and responsiveness

- **NFR-020:** Initial application shell interaction SHOULD be available within 2 seconds from a warm offline load.
- **NFR-021:** Common filter/sort interactions on the typical dataset SHOULD update visible results within 200 ms.
- **NFR-022:** Dashboard aggregates on the typical dataset SHOULD render within 1 second after filters settle.
- **NFR-023:** CSV parsing on the typical dataset SHOULD sustain at least 10,000 rows/second excluding user review.
- **NFR-024:** Main-thread tasks SHOULD remain below 50 ms; parsing, inference, hashing, and heavy aggregation run in workers.
- **NFR-025:** Lists MUST use bounded rendering so DOM size does not grow linearly with dataset size.

## Reliability and data integrity

- **NFR-030:** Imports, migrations, restore, and bulk changes MUST be atomic or recoverable from a journal.
- **NFR-031:** Monetary calculations MUST use decimal/fixed-point semantics and preserve source precision.
- **NFR-032:** Derived indexes and aggregates MUST be rebuildable from canonical records.
- **NFR-033:** Every backup and portable export MUST include format version, creation time, producing application version, and integrity metadata where applicable.
- **NFR-034:** Automated migration tests MUST cover clean, interrupted, corrupt, and low-quota conditions.

## Accessibility

- **NFR-040:** Supported core journeys MUST conform to WCAG 2.2 AA.
- **NFR-041:** All actions MUST be keyboard accessible with visible focus and logical order.
- **NFR-042:** Charts MUST not rely solely on color and MUST provide an equivalent accessible table and summary.
- **NFR-043:** The UI MUST support 200% text zoom and reflow at 320 CSS pixels without loss of core functionality.
- **NFR-044:** Animation MUST respect reduced-motion preferences; time-limited actions MUST be avoidable.

## Compatibility and adaptability

- **NFR-050:** Publish and test a browser support matrix for every release.
- **NFR-051:** Core no-AI operation MUST not require WebGPU.
- **NFR-052:** Layouts MUST support phone, tablet, and desktop viewports; pointer and touch targets meet accessible sizing guidance.
- **NFR-053:** Locale-aware display MUST remain separate from canonical date and decimal storage.

## Maintainability

- **NFR-060:** Domain, application, infrastructure, and presentation boundaries MUST be enforced by dependency rules.
- **NFR-061:** Public contracts MUST have JSON Schema or TypeScript definitions and compatibility tests.
- **NFR-062:** Critical domain logic SHOULD achieve mutation/branch coverage targets defined when the test harness is selected, not merely line coverage.
- **NFR-063:** Parser fixtures MUST be synthetic or irreversibly sanitized and identify format provenance.
- **NFR-064:** Architecture-changing decisions MUST have ADRs; superseded ADRs remain in history.

## Portability and interoperability

- **NFR-070:** Portable JSON MUST use UTF-8, ISO 8601 timestamps, BCP 47 locale tags, ISO 4217 currency codes where applicable, and decimal strings.
- **NFR-071:** The application MUST preserve unknown non-breaking fields when round-tripping Financial Brain content when feasible.
- **NFR-072:** At least the current and previous major portable format versions MUST have a documented migration path.

## Sustainability

- **NFR-080:** Avoid loading an AI model for deterministic tasks.
- **NFR-081:** Model downloads MUST be user initiated, resumable where supported, and removable.
- **NFR-082:** Incremental recomputation SHOULD replace full-dataset scans after routine edits/imports.

## Verification gates

Each release must include:

- automated offline/network-leak tests;
- import fixture and corruption tests;
- schema/example validation;
- accessibility automation plus manual keyboard and screen-reader review;
- performance results for reference workloads;
- backup/restore and migration drills;
- dependency and production security scans;
- cross-browser smoke tests for the published matrix.

## Related documents

- [System architecture](07-SYSTEM-ARCHITECTURE.md)
- [Security and privacy](12-SECURITY-AND-PRIVACY.md)
- [UX guidelines](13-UX-GUIDELINES.md)
