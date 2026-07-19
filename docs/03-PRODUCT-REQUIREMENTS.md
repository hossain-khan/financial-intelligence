# Product Requirements

## Purpose

Define the first complete product release and measurable acceptance outcomes.

## Product summary

Financial Intelligence is an installable web application that imports financial statements without bank credentials, normalizes and categorizes transactions, learns from confirmed corrections, and presents explainable analysis. Core processing and storage occur locally. AI is optional and accessed through a replaceable provider layer.

## Release scope

The target described here is **v1.0**. The [roadmap](15-ROADMAP.md) divides it into deliverable milestones.

### Goals

- Make statement-to-insight setup understandable for a non-technical user.
- Reliably re-import overlapping date ranges without silently duplicating records.
- Reduce correction effort over time through transparent deterministic learning.
- Deliver useful dashboards without AI.
- Provide local, self-hosted, and bring-your-own-key AI modes behind consent boundaries.
- Make migration, backup, restore, and deletion first-class workflows.

### Non-goals

- Live bank synchronization or credential storage.
- Payment initiation, investment execution, tax filing, or credit decisions.
- Multi-user real-time collaboration or hosted account sync in v1.0.
- OCR coverage for arbitrary scanned PDFs in the core bundle.
- Financial advice or autonomous changes to the user's finances.

## Core journey

1. The user opens or installs the application and creates a local workspace.
2. The app explains local storage, backup responsibility, and optional AI modes.
3. The user adds an account and drops one or more statements.
4. The app detects formats, previews mappings, validates rows, and flags overlap or errors.
5. The user confirms an atomic import.
6. Rules and known merchant mappings run; optional AI handles eligible uncertain records.
7. The user reviews low-confidence items, confirms corrections, and optionally creates rules.
8. Dashboards update and allow drill-down to supporting transactions and provenance.
9. The user exports a Financial Brain or encrypted backup and can later restore it.

## Product requirements

### Onboarding and workspace

- **PR-001:** The app MUST support use without registration.
- **PR-002:** On first run, the app MUST disclose that browser data may be cleared and offer backup guidance.
- **PR-003:** The app MUST allow creation of accounts without requesting online banking credentials.
- **PR-004:** The app MUST operate in a no-AI mode with all core analysis available.

### Import and data quality

- **PR-010:** The app MUST import CSV, OFX, and QFX and SHOULD import supported text-based PDFs.
- **PR-011:** The app MUST preview detected columns, dates, amount direction, and row-level errors before commit.
- **PR-012:** An import MUST be atomic: cancellation or failure cannot leave partially committed canonical records.
- **PR-013:** The app MUST detect exact duplicates and flag likely duplicates without silently deleting ambiguous records.
- **PR-014:** Every canonical transaction MUST retain provenance and original description.
- **PR-015:** The app MUST provide a downloadable error report for partially parseable files.

### Classification and learning

- **PR-020:** Classification MUST evaluate locked user decisions and deterministic rules before any model.
- **PR-021:** Every inferred category or merchant MUST store method, confidence, and evidence.
- **PR-022:** Users MUST be able to correct one or many records and choose whether the correction creates learning.
- **PR-023:** Rules MUST support preview, precedence, conflict detection, enable/disable, and deletion.
- **PR-024:** Low-confidence and conflicting results MUST appear in a review queue.
- **PR-025:** A model failure MUST NOT prevent manual or rules-based completion.

### Analysis

- **PR-030:** The app MUST calculate income, spending, transfers, and net cash flow without AI.
- **PR-031:** The app MUST provide time, category, merchant, account, recurring-payment, and savings views.
- **PR-032:** Every aggregate MUST support drill-down to its contributing records.
- **PR-033:** Filters MUST behave consistently across dashboard widgets and exported views.
- **PR-034:** Insights MUST cite the comparison period, contributing records, and calculation method.

### AI modes

- **PR-040:** Local AI MUST be preferred when supported and MUST disclose model size and device requirements before download.
- **PR-041:** Remote AI MUST be disabled by default and require destination-specific consent.
- **PR-042:** Before a first remote request, the app MUST preview the classes of fields sent and warn that provider policies apply.
- **PR-043:** Provider adapters MUST expose capability, health, cancellation, and structured-output behavior through one contract.
- **PR-044:** Secrets MUST never appear in exports, logs, prompts shown in diagnostics, or plugin data.
- **PR-045:** Natural-language answers MUST link material numeric claims to deterministic queries over local data.

### Portability and lifecycle

- **PR-050:** Users MUST be able to export transactions in a documented common format.
- **PR-051:** The Financial Brain MUST be human-readable, schema-versioned, mergeable, and exclude raw transactions and secrets.
- **PR-052:** Full backups MUST be encrypted by default and include an integrity check.
- **PR-053:** Restore MUST validate compatibility and show a summary before replacing or merging data.
- **PR-054:** Users MUST be able to delete an import, an account, learned rules, AI settings, or the entire workspace.
- **PR-055:** Data migrations MUST be versioned and tested against the last supported major version.

### Accessibility and resilience

- **PR-060:** Core workflows MUST meet WCAG 2.2 AA and be keyboard operable.
- **PR-061:** Charts MUST have text summaries, data tables, and non-color encodings.
- **PR-062:** Long operations MUST report progress, remain cancelable where safe, and preserve committed data.
- **PR-063:** The app MUST explain unsupported browser capabilities and provide degraded alternatives.

## Success metrics

Metrics are computed locally unless a user explicitly exports diagnostics.

| Metric | v1.0 target |
| --- | --- |
| Supported fixture import success | 100% of maintained fixtures |
| First import completion | Median under 5 minutes in moderated usability tests |
| Repeat correction reduction | At least 60% fewer manual classifications on a comparable third import |
| Duplicate safety | No silent loss in maintained overlap and collision fixtures |
| Dashboard traceability | 100% of displayed aggregates drill down to contributing records |
| Core keyboard completion | 100% of defined critical flows |
| Unexpected network requests in local mode | Zero |

## Release acceptance

v1.0 is acceptable when all MUST requirements have automated or documented evidence, threat-model high risks have mitigations, schemas and examples validate, migration and recovery drills pass, and core journeys pass accessibility and usability review on supported browser/device classes.

## Open questions

- Which browser versions form the first support matrix?
- Is passphrase-only backup sufficient, or should platform key storage be an optional second mechanism?
- Which PDF statement families merit maintained adapters for v1.0?
- What confidence calibration dataset can be distributed without real user data?

## Related documents

- [User stories](04-USER-STORIES.md)
- [Functional requirements](05-FUNCTIONAL-REQUIREMENTS.md)
- [Non-functional requirements](06-NON-FUNCTIONAL-REQUIREMENTS.md)
