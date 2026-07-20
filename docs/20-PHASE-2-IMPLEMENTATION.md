# Phase 2 Implementation and Hardening

## Purpose

Describe the implemented Phase 2 behavior, its trust boundaries, the evidence required before the
milestone exits, and the remaining hardening work discovered during the post-merge review.

## Implemented vertical slices

### Merchant memory and deterministic classification

- Merchant aliases are normalized locally and resolve to stable merchant IDs without changing the
  imported description or provenance.
- Saved rules are typed data. Equal-priority, equal-specificity incompatible assignments abstain as
  conflicts; definite identical-predicate conflicts are rejected before activation.
- Import commit loads the current merchant catalog and rule set once. A unique alias is applied
  before rules, then the rule evaluator uses the real account type and decimal-safe amount.
- Applied merchant/category values retain method, classifier version, bounded evidence, decision
  time, and lock state in the canonical transaction document.
- Alias collisions and rule conflicts put the imported transaction into `needsReview`; they are
  never silently resolved.

This makes the repeat-import learning loop real: a reusable correction created during review can
categorize a matching transaction on a later import without an AI provider.

### Review and correction

- The review queue is a rebuildable projection over canonical transaction state, merchant matches,
  and rule evaluation.
- One-off category and merchant corrections use canonical manual classifications and are locked by
  default. Bulk transaction edits have an operation journal and existing undo path.
- Reusable rules are explicit choices and definite conflicts fail before activation.

Creating a reusable rule or alias alongside a correction is not yet one cross-store transaction.
The atomic correction-and-learning journal is tracked as follow-up work and must land before the
Phase 2 exit criteria are considered complete.

### Financial Brain portability

- The Financial Brain remains human-readable JSON and excludes transactions, accounts, statements,
  exact balances, secrets, prompts, and provider responses.
- The schema and runtime share the rule `schemaVersion` and recurring-decision `name` fields.
- Export includes categories, merchants, rules, recurring decisions, and safe preferences. Import
  is byte-bounded before file reading, schema validated, cross-reference checked, previewed, and
  explicit about conflicts and possible semantic duplicates.
- Different stable IDs are never silently collapsed. Recurring decisions participate in preview,
  export, and apply.

Import apply is still implemented through individual repositories and does not yet provide the
single IndexedDB transaction, stale-preview digest/revision check, operation journal, or rollback
required by the final portability contract. That recovery work remains a release blocker.

### Transfers and recurring series

- Transfer and recurring candidates are deterministic derived proposals; source transactions are
  unchanged.
- Confirmed transfer IDs, rather than a category label alone, control cash-flow exclusion.
- Ambiguous transfer proposals cannot be confirmed. Confirmation rechecks current transaction
  status, account, date, and amount and rejects overlap with an existing confirmed link.
- Recurring proposals exclude confirmed transfer members. Resolved recurring decisions are hidden
  from the active review queue but retained in dashboard summaries.

The final transfer uniqueness guarantee still needs an atomic IndexedDB compare-and-write so two
concurrent tabs cannot confirm overlapping proposals.

### Reconciled dashboards

- Merchant, recurring, savings, and money-flow reports are calculated by deterministic analysis
  services and keep currencies separate.
- Report rows and edges carry contributing transaction IDs. Dashboard drilldown passes that exact
  bounded ID set to the ledger, which applies it to both ledger and cash-flow queries.
- Tables expose the same facts used by the visual presentation; model output performs no arithmetic.

## Storage and backup compatibility

Database version 8 contains merchants, classification rules, transfer decisions, and recurring
decisions. Full-workspace backup snapshots now inventory those stores. The existing `1.0.0` backup
reader treats their absence as empty arrays so pre-Phase-2 experimental snapshots remain readable;
new snapshots always write the fields and validate transfer references.

Financial Brain and full-workspace backup remain different formats: Brain is portable learned
knowledge, while backup is an encrypted recovery snapshot.

## Verification map

The maintained test suite covers:

- rule precedence, locked fields, definite activation conflicts, and import-time application;
- canonical merchant classification round trips;
- Brain schema/example synchronization and recurring-decision portability;
- legacy backup compatibility and Phase 2 backup inventory;
- ambiguous/stale transfer rejection and recurring resolved-state visibility;
- exact dashboard-member filtering through analysis and ledger queries;
- existing keyboard, responsive, offline, CSP, schema, migration, and browser gates.

The milestone exits only after the remaining atomicity/recovery follow-ups pass interruption,
multi-tab conflict, rollback, and browser end-to-end tests.

## Related documents

- [Data model](09-DATA-MODEL.md)
- [Learning engine](10-LEARNING-ENGINE.md)
- [Security and privacy](12-SECURITY-AND-PRIVACY.md)
- [Roadmap](15-ROADMAP.md)
- [Cash-flow and filtered export](18-CASH-FLOW-AND-FILTERED-EXPORT.md)
- [Financial Brain schema](../schemas/financial-brain.schema.json)

## Tracked release blockers

- [#72: atomic, stale-safe, reversible learning operations](https://github.com/hossain-khan/financial-intelligence/issues/72)
- [#73: complete transfer and recurring decision lifecycles](https://github.com/hossain-khan/financial-intelligence/issues/73)
- [#74: complete dashboards, shared filters, and revision consistency](https://github.com/hossain-khan/financial-intelligence/issues/74)
