# Glossary

## Purpose

Provide one vocabulary for product copy, schemas, implementation, tests, and agent instructions.

## Terms

**Account** — A user-defined container representing a bank, card, cash, loan, or other financial account. It contains no login credentials.

**AI provider** — A local runtime, self-hosted endpoint, or remote service that can perform a model task through the provider adapter contract.

**Amount** — A decimal monetary magnitude represented as a string in portable JSON to prevent binary floating-point errors. Direction is represented separately or by a normalized signed convention.

**Backup** — A complete restorable snapshot of application data and settings. Unlike a Financial Brain export, it may contain raw transactions and source documents and should be encrypted by default.

**Canonical transaction** — The normalized transaction record used by domain logic after source-specific parsing and mapping.

**Category** — A user-owned label in a hierarchy used to group financial activity. Categories are not merchant identities.

**Classification** — An assignment such as category, merchant, or transfer status, accompanied by method, confidence, and evidence.

**Confidence** — A calibrated number from 0 through 1 expressing uncertainty of an inference. It is not a probability guarantee.

**Correction** — A user change to an inferred or imported value. It does not become a reusable rule unless the user chooses or confirms that effect.

**Dashboard** — A saved arrangement of visualization widgets and filters. It references transactions but does not duplicate them.

**Deduplication fingerprint** — A privacy-preserving digest derived from stable normalized fields and scoped to a local dataset, used as evidence for duplicate detection.

**Deterministic rule** — A versioned condition-and-action record that produces the same result for the same canonical input and rule set.

**Evidence** — Human-readable and machine-readable support for an inference, such as a matched alias, prior correction, or recurring pattern.

**Financial Brain** — A portable, versioned document containing learned merchant mappings, classification rules, categories, preferences, and selected aggregate learning. It excludes raw transaction history and secrets.

**Import** — One atomic attempt to convert a source file into canonical records, with status, mappings, warnings, counts, and provenance.

**Insight** — An evidence-linked observation derived from financial records, such as a category increase. It is not financial advice.

**Local AI** — Model inference performed on the user's device, normally in the browser, without sending inference input to a remote service.

**Merchant** — A canonical counterparty identity with aliases matching statement descriptions.

**Normalization** — Converting source-specific dates, amounts, descriptions, and account fields into canonical representations without losing the original values.

**Plugin** — A separately packaged extension using declared permissions and versioned host APIs. Plugins are not required for the core workflow.

**Posted date** — The date an institution recorded a transaction. This differs from an optional transaction or authorization date.

**Provenance** — Metadata connecting a canonical value to its import, source location, original representation, and transformations.

**Recurring series** — A set of likely related transactions with an estimated cadence and amount range. Detection remains an inference until confirmed.

**Remote AI** — Inference that transmits a disclosed data subset to a network endpoint, including user-operated endpoints.

**Review queue** — A prioritized collection of uncertain, conflicting, or user-requested decisions requiring confirmation.

**Rule conflict** — A case where multiple applicable rules propose incompatible values at the same precedence.

**Source document** — An imported CSV, OFX, QFX, or PDF and its local metadata. Retention is controlled by the user.

**Transfer** — Movement between accounts owned by the same user. Correctly matched transfers are excluded from income and spending totals by default.

**Workspace** — The complete local dataset for one person or household, including accounts, imports, transactions, learning, and preferences.

## Normative language

The terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** indicate requirement strength. Requirement IDs are stable references; changing the meaning of an accepted requirement requires documentation and, when architectural, an ADR.

## Related documents

- [Data model](09-DATA-MODEL.md)
- [Learning engine](10-LEARNING-ENGINE.md)
- [Import pipeline](11-IMPORT-PIPELINE.md)
