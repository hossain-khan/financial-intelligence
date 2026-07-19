# Import Pipeline

## Purpose

Specify the safe conversion of untrusted statements into canonical transactions, including preview, provenance, deduplication, atomicity, and recovery.

## Supported formats

### v1 required

- CSV/TSV-like delimited text with interactive mapping.
- OFX and QFX using maintained standard fixtures.

### v1 conditional

- Text-based PDF for explicitly supported layouts/adapters.

Image-only PDFs, password-protected documents, spreadsheets, and direct bank connections are not core v1 formats. The UI must state limitations and recommend a supported export rather than pretending success.

## Pipeline stages

### 1. Intake

- Receive file handle/bytes with explicit user action.
- Enforce count and configurable size limits before expensive parsing.
- Detect content type from magic/content and extension.
- Compute a streaming digest locally.
- Identify identical previously imported sources.
- Create a staged import record; do not retain bytes after the session unless requested.

### 2. Parse in isolation

- Run parser in a dedicated worker with time/memory/output bounds.
- Produce source rows, source locations, detected metadata, parser ID/version, and warnings.
- Never execute macros, scripts, embedded links, attachments, JavaScript, or external resource loads.
- PDF adapters extract text only from supported structures and must not render active content.

### 3. Map

Resolve account, date columns/formats, description, signed amount or debit/credit columns, currency, optional source ID, balance, and status. Mapping presets are keyed by a non-sensitive format signature and parser version—not uploaded institution data.

Amount-direction preview is mandatory. Show at least one inflow and outflow example when available. A balance column may help validation but is not treated as transaction amount.

### 4. Normalize

- Unicode normalization and safe whitespace folding.
- Parse dates using the confirmed format, never ambiguous silent guessing.
- Parse decimal using confirmed locale separators and preserve original.
- Convert debit/credit convention into signed account-perspective amount.
- Normalize description for matching while preserving exact source description.
- Assign canonical IDs and provenance references.

### 5. Validate

Validate required fields, date ranges, finite decimal/precision, currency/account consistency, impossible combinations, duplicate source IDs, and bounded field lengths. Distinguish:

- **Error:** cannot create a trustworthy canonical transaction.
- **Warning:** record can import but needs attention.
- **Information:** detected convention or benign transformation.

### 6. Detect duplicates

Evidence tiers:

1. Same account and source transaction ID: exact candidate.
2. Same dataset-scoped fingerprint: exact candidate.
3. Same account/currency/amount with nearby date and similar description: likely candidate.
4. Transfer-like equal/opposite transactions are not duplicates.

Display existing/new source, dates, amount, descriptions, and evidence. Exact duplicates can default to skip, but the choice remains visible. Likely duplicates require a user decision or import with a review flag.

### 7. Preview

Show source summary, target account, date span, inflow/outflow totals, valid/error/warning/duplicate counts, sample rows, mapping, and source retention choice. Compare totals with statement summary/balances when available, clearly labeling this as reconciliation evidence rather than proof.

### 8. Commit

Create a deterministic commit plan. Within one storage transaction, persist the committed import, accepted transactions, fingerprints, provenance, and revision increment. On quota, cancellation, tab crash, or validation failure before completion, canonical state remains unchanged.

### 9. Enrich

After commit, run deterministic merchant/rule classification, duplicate review, transfer proposals, optional AI tasks, recurring detection, and projection updates. Enrichment may be retried independently and never changes imported facts.

## CSV behavior

- Detect UTF-8 BOM and common encodings supported by the chosen library; require confirmation for uncertain decoding.
- Support quoted delimiters, escaped quotes, embedded newlines, headers, and ignored footer/summary rows.
- Limit cell and row lengths and report truncation only if user explicitly accepts it; default is rejection.
- Save reusable mapping templates locally after successful confirmation.
- Formula-looking cells are plain text; CSV export must mitigate spreadsheet formula injection.

## OFX/QFX behavior

- Support documented SGML and XML variants chosen by implementation scope.
- Prefer institution transaction ID for duplicate evidence but do not assume global uniqueness.
- Preserve posted date and optional user/transaction date distinctly.
- Map transaction type as source metadata, not directly to final category.
- Never follow URLs or perform online-banking requests contained in the file.

## PDF behavior

- Select adapters by bounded text/layout signatures.
- Preserve page and text-span/row references.
- Detect missing pages, repeated headers, wrapped descriptions, and multi-line rows.
- Reject unsupported or low-confidence extraction with guidance; do not invent missing amounts.
- OCR, if later added, is a separate capability with explicit local/remote disclosure and review requirements.

## Provenance

Each canonical record references:

- import ID and parser/version;
- source row number, OFX transaction position/ID, or PDF page/span;
- original date, amount, description, and relevant source fields within size limits;
- normalization/mapping version and warning codes.

Provenance is viewable, included in full backups, and excluded from the Financial Brain.

## Deleting and replacing imports

Deleting an import shows affected transaction and derived-object counts. User-owned corrections tied only to deleted transactions are removed; reusable rules and merchants remain unless separately selected. Replacing an import is modeled as stage new, compare, atomically commit new and delete old, then rebuild derived data.

## Security limits

Limits must be configurable and tested for file bytes, archive nesting if ever supported, pages, rows, columns, field length, parser time, generated records, warnings, and provenance size. Sanitized error messages must not echo entire source rows.

## Test matrix

- locale date/decimal combinations;
- debit/credit and signed amount conventions;
- encoding, quoting, embedded newline, empty/footer rows;
- OFX SGML/XML and missing identifiers;
- supported PDF layouts, wrapped text, repeated headers, image-only files;
- exact/likely duplicates and overlapping four-month imports;
- partial errors, cancellation, worker crash, quota exhaustion;
- malicious HTML/formulas/prompts, oversized fields, external links;
- round-trip provenance and delete/rebuild behavior.

## Open questions

- Choose maintained PDF adapter families from user demand and legal availability of synthetic fixtures.
- Set default size/row limits after browser benchmarks.
- Decide whether spreadsheet import belongs in v1.x via a sandboxed library.

## Related documents

- [Functional requirements](05-FUNCTIONAL-REQUIREMENTS.md)
- [Data model](09-DATA-MODEL.md)
- [Import schema](../schemas/import.schema.json)
