# Import Pipeline

## Purpose

Specify the safe conversion of untrusted statements into canonical transactions, including preview, provenance, deduplication, atomicity, and recovery.

## Supported formats

### v1 required

- CSV/TSV-like delimited text with interactive mapping.
- OFX and QFX using maintained standard fixtures.

### v1 conditional

- Text-based PDF for explicitly supported layouts/adapters. Implemented for a generic tabular layout
  (issue #26, ADR-013); institution-specific adapters are additive follow-ups.

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

### v1 implementation (issue #25, ADR-012)

The `@financial-intelligence/import-ofx` package implements the shared `StatementParser` contract
with parser id `ofx`. It is isolated from storage and UI and shares the canonical
candidate-validation, duplicate, and atomic-commit pipeline through the format-neutral
`buildCandidatesFromDrafts` helper in `import-core`.

- **Supported dialects:** OFX 1.x SGML with the `OFXHEADER` preamble and unclosed leaf elements, and
  OFX 2.x XML/QFX with an `<OFX>` root. Supported message sets are bank
  (`BANKMSGSRSV1/STMTTRNRS/STMTRS`) and credit-card (`CREDITCARDMSGSRSV1/CCSTMTTRNRS/CCSTMTRS`)
  statement responses.
- **Unsupported sections** (investment, loan, bill-pay, profile/signup, interbank/wire, sign-on)
  produce bounded `UNSUPPORTED_SECTION` warnings, stay visible in the preview, and are never acted
  upon.
- **Security:** DTDs, entity and notation declarations, CDATA sections, non-standard entity
  references, and processing instructions are rejected before tree construction; no external
  resource is ever resolved. Only a documented encoding set is decoded (UTF-8, UTF-16 with BOM,
  Windows-1252/US-ASCII); unknown or contradictory encodings are explicit errors. Byte,
  decoded-character, nesting-depth, element-count, statement, transaction, field-length, issue,
  output, and runtime limits are enforced.
- **Dates and amounts:** OFX timestamps are parsed with a dedicated
  `YYYYMMDDHHMMSS[.fff][offset:zone]` grammar with full calendar/offset validation; the canonical
  date is derived from wall-clock fields and the raw string is preserved. `TRNAMT` is validated as a
  signed decimal and never coerced.
- **Provenance and privacy:** `FITID`, `NAME`, `MEMO`, `TRNTYPE`, `CHECKNUM`, `REFNUM`, `SIC`, and
  the server transaction id are preserved as provenance; `CURDEF` and account type are detected
  metadata; ledger/available balances are statement-level reconciliation values, never transaction
  amounts. Full account and routing numbers are never stored or displayed — only a masked last-four
  hint helps the user select a local account. A statement/account currency mismatch is an error.

## PDF behavior

- Select adapters by bounded text/layout signatures.
- Preserve page and text-span/row references.
- Detect missing pages, repeated headers, wrapped descriptions, and multi-line rows.
- Reject unsupported or low-confidence extraction with guidance; do not invent missing amounts.
- OCR, if later added, is a separate capability with explicit local/remote disclosure and review requirements.

### v1 implementation (issue #26, ADR-013)

The `@financial-intelligence/import-pdf` package implements the shared `StatementParser` contract
with parser id `pdf`. It is isolated from storage and UI and shares the canonical
candidate-validation, duplicate, and atomic-commit pipeline through the format-neutral
`buildCandidatesFromDrafts` helper in `import-core`.

- **Extraction:** Mozilla PDF.js (`pdfjs-dist`, pinned) extracts the text layer only, running in
  main-thread mode inside the import worker (no nested worker, no CDN). The document is opened from
  an in-memory byte array with a hardened configuration (`isEvalSupported: false`,
  `useWorkerFetch: false`, `disableFontFace: true`, `useSystemFonts: false`, CMap/standard-font URLs
  unset), so no page is rendered, no active content executes, and no network request occurs.
- **Bounds and classification:** `%PDF-` content is validated first, then file-byte, page,
  per-page item, item-length, total-text-character, issue, output-row, output-character, and runtime
  limits are enforced. Password-protected/encrypted PDFs are rejected without collecting a password;
  documents with no usable text are classified image-only. All failures explain the next step
  (export CSV/OFX or a text-based PDF).
- **Layout adapters:** A registry selects a unique winning adapter (minimum score plus a margin over
  the runner-up); ties, missing columns, and low coverage return unsupported/ambiguous. v1 ships one
  generic tabular adapter (date / description / signed-amount or debit-credit columns) that handles
  repeated headers/footers, wrapped multi-line descriptions, page continuation, parenthesized/
  trailing-minus amounts, and summary rows, and never invents a missing date, amount, sign, or
  description.
- **Provenance and privacy:** Each row carries `page:N/items:a-b` source locations plus the original
  date, description, and amount text; the parser id/version and adapter id/version are recorded. The
  source PDF is not retained by the preview; PDF bytes are released when the staged session ends.

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

- Choose maintained institution-specific PDF adapter families from user demand and legal
  availability of synthetic fixtures (the generic tabular adapter and framework landed in issue #26).
- Set default size/row limits after browser benchmarks.
- Decide whether spreadsheet import belongs in v1.x via a sandboxed library.
- Decide whether to bundle local CMaps/standard fonts for CJK-heavy PDF statements behind the
  existing no-network guarantee.

## Related documents

- [Functional requirements](05-FUNCTIONAL-REQUIREMENTS.md)
- [Data model](09-DATA-MODEL.md)
- [Import schema](../schemas/import.schema.json)
