# Data Model

## Purpose

Define canonical entities, invariants, identifiers, ownership, portable representations, and relationships.

## Representation conventions

- IDs are opaque, entity-specific UUID types in domain code and canonical lowercase UUID strings in
  portable data. Generate IDs at an application or infrastructure boundary, validate them with the
  matching domain parser, and pass the typed value into domain constructors.
- Timestamps are strict RFC 3339 UTC strings ending in uppercase `Z`. Date-only financial dates use
  strict ISO `YYYY-MM-DD` strings and never pass through `Date`. Offset timestamps, impossible dates,
  leap seconds, lowercase separators, and calendar year `0000` are rejected at the domain boundary.
- Timestamp fractional-second precision is preserved exactly during parsing and serialization.
- Monetary values are decimal strings. Canonical transaction amount is signed: positive is inflow to the account, negative is outflow.
- Currency uses uppercase ISO 4217 codes when one exists; non-standard assets require a namespaced future extension.
- Display locale never changes stored dates or decimals.
- Optional means semantically absent; do not use empty-string sentinels.
- Portable documents declare `schemaVersion` and preserve stable IDs.

The seven root JSON Schemas in `/schemas` are the source of truth for portable TypeScript shapes.
Generated types live under `packages/schemas/src/generated`; edit the schemas and run
`pnpm schema:generate` rather than editing generated files. `pnpm schema:check` fails when generated
artifacts are missing or stale.

## Entity overview

```text
Workspace
 ├─ Accounts
 │   └─ Transactions ── Import
 │         ├─ Merchant
 │         ├─ Category
 │         ├─ Classifications
 │         └─ TransferLink ── Transaction
 ├─ Categories (hierarchy)
 ├─ Merchants ── Aliases
 ├─ Rules ── Conditions + Actions
 ├─ RecurringSeries ── Transactions
 ├─ Dashboards
 └─ ProviderProfiles
```

## Workspace

Local root aggregate containing ID, name, base/display preferences, created/updated timestamps, database revision, and schema version. A browser profile may contain multiple isolated workspaces. A workspace is not an online account.

## Account

Fields: `id`, `name`, `type`, `institutionLabel?`, `maskedIdentifier?`, `currency`, `archived`, timestamps. Types initially include checking, savings, credit card, cash, loan, investment, and other. Account identifiers are display-only and never credentials.

Invariant: a transaction belongs to exactly one account. Cross-currency totals require an explicit conversion policy; account currency cannot be casually rewritten after records exist.

## Transaction

The canonical portable subset is defined by [transaction.schema.json](../schemas/transaction.schema.json).

Key fields:

- identity/context: `id`, `accountId`, `importId`;
- facts: `postedDate`, optional `transactionDate`, signed `amount`, `currency`;
- source: `description`, optional source transaction ID, provenance location/original fields;
- organization: optional `merchantId`, `categoryId`, tags, notes;
- state: pending/posted/void, review state, optional transfer link;
- inference metadata: per-field classification method, confidence, evidence, classifier version;
- lifecycle: created/updated timestamps.

Invariants:

- Amount parses as a finite decimal; zero is allowed only when source format legitimately represents it and is flagged.
- Account and transaction currency normally match.
- A confirmed transfer link connects distinct owned accounts and equal/opposite economic value under the selected currency policy.
- Locked fields cannot be changed by automatic classification.
- Deleting an import deletes only transactions sourced solely from it and rebuilds derived state.

## Import

Defined by [import.schema.json](../schemas/import.schema.json). Stores file metadata and digest, parser/version, account, status, mappings, counts, warnings/errors, timestamps, and committed revision. Source bytes are separate and optional.

Import states: `staged`, `ready`, `committing`, `committed`, `failed`, `cancelled`, `deleted`. Only committed imports own canonical transactions.

## Category

Defined by [category.schema.json](../schemas/category.schema.json). A stable ID, name, optional parent, kind (`income`, `expense`, `transfer`, `other`), icon/color display hints, order, archived state, and timestamps.

Invariants: no parent cycles; bounded depth; deleting or merging requires explicit handling of references. Starter category IDs should remain stable even when names are localized or changed.

## Merchant

Defined by [merchant.schema.json](../schemas/merchant.schema.json). Contains canonical display name, aliases with matching modes, optional website/domain hint, archived state, and timestamps. Aliases store normalized patterns, not whole transaction histories.

Merchant merge creates a redirect from retired ID to surviving ID so old portable references can migrate.

## Classification

Value object attached per inferred field:

- `valueId` or typed value;
- `method`: user, rule, merchant mapping, heuristic, local AI, remote AI, imported;
- `classifierId` and `classifierVersion`;
- `confidence` from 0 to 1;
- bounded evidence codes/references;
- `locked` and timestamps.

User-confirmed values have highest precedence. Confidence is omitted for direct facts/user decisions when it would imply false uncertainty.

## Rule

Fields: ID, name, enabled, priority, ordered conditions, ordered actions, creation source, stats, and timestamps. Conditions are typed predicates rather than executable expressions. Regex support, if added, must use a safe engine and bounded input. Actions set only allowed fields.

Rules are part of the Financial Brain. Application history and current match counts are local operational data and need not be portable.

## Correction

Audit record of prior value, new value, actor (`user` or migration), scope (single/bulk), optional resulting rule ID, operation ID, and timestamp. Corrections support undo and learning evaluation; portable Brain export includes reusable learning, not a transaction-level correction log.

## Transfer link

Connects two transaction IDs with status, matching evidence, confidence if proposed, and confirmation timestamp. The link, not the category alone, determines exclusion from income/spending totals.

## Recurring series

Stores ID, signature, name, optional merchant, cadence and bounded tolerance, durable member
transaction IDs, detector version, status, superseded record IDs, and update time. Operational
statuses include `superseded` and `invalidated`; those states preserve explanation and recovery but
are excluded from portable Brain JSON. Split/merge never changes source transactions.

## Operation journals

`learningOperations` records the expected revision, input digest, kind, and exact bounded
before/after changes for transactions, categories, merchants, rules, and recurring decisions.
`decisionEvents` records transfer or recurring confirm/reject/edit/split/merge/unlink/invalidate/undo
events. Both are sensitive local operational state, included in full encrypted backup, and excluded
from Financial Brain export.

## Dashboard

Defined by [dashboard.schema.json](../schemas/dashboard.schema.json). Stores layout, widget types, titles, normalized filter definitions, and accessibility/display preferences. Widgets reference query configurations rather than snapshot values.

## AI provider profile

Defined by [ai-provider.schema.json](../schemas/ai-provider.schema.json). Stores provider kind, endpoint origin where applicable, model/task configuration, consent metadata, and optional secret reference. It never contains an API key.

## Financial Brain

Defined by [financial-brain.schema.json](../schemas/financial-brain.schema.json). Includes metadata, categories, merchants, rules, recurring decisions, and safe preferences. It excludes:

- accounts and raw transactions;
- source files and row-level provenance;
- exact balances and budgets containing sensitive numeric targets in v1;
- API keys/secret values;
- model prompts/responses, embeddings, and diagnostics.

## Derived data

Monthly/category/merchant aggregates, search indexes, duplicate candidates, dashboard caches, and most recurring candidates are rebuildable projections. They have a source revision and must never be the sole record of a user-confirmed decision.

A dashboard snapshot is not persisted as canonical data. It is a revision-consistent read of all
stores used by the report and carries an opaque `sourceRevision` for stale-result detection.

## Deletion semantics

- Archive hides an entity from new choices but retains history.
- Delete removes an entity after references are reassigned, cascaded, or explicitly left unclassified.
- Workspace deletion clears application-controlled databases, caches, model assets, and stored secret handles where possible.
- Exported/downloaded files lie outside application control; the UI states this.

## Migration and compatibility

Database migrations and portable schema migrations are distinct. Each migration is versioned, idempotent or journaled, validated, and tested on fixtures. Importers reject unknown future major versions but may preserve unknown fields from compatible minor versions.

## Related documents

- [Learning engine](10-LEARNING-ENGINE.md)
- [Import pipeline](11-IMPORT-PIPELINE.md)
- [Schemas](../schemas/)
