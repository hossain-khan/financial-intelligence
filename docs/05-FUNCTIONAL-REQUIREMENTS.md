# Functional Requirements

## Purpose

Specify testable system behavior. IDs are normative and may be referenced by issues, tests, and release evidence.

## Workspace and accounts

- **FR-001:** Create, rename, archive, and delete a local workspace.
- **FR-002:** Create accounts with ID, display name, type, institution label, currency, and optional masked identifier.
- **FR-003:** Prevent account deletion while records exist unless the user chooses cascade deletion or reassignment.
- **FR-004:** Display local storage use, persistence status when available, and last successful backup date.
- **FR-005:** Export all workspace data; import only after version, integrity, and conflict validation.

## Source intake

- **FR-100:** Accept multiple files by file picker, drag-and-drop, or supported share target.
- **FR-101:** Detect file type using content and extension; treat MIME metadata as advisory.
- **FR-102:** Reject executable, encrypted, excessively large, or unsupported files with actionable messages.
- **FR-103:** Calculate a local source digest and detect previously imported identical files.
- **FR-104:** Keep source-file retention opt-in after successful extraction; provenance remains even if the file is discarded.

## Parsing and mapping

- **FR-110:** Parse CSV with configurable encoding, delimiter, quoting, header row, locale, and date format.
- **FR-111:** Parse standard OFX/QFX transaction and account fields while preserving unknown source fields in bounded provenance metadata.
- **FR-112:** Parse supported text-based PDF layouts in an isolated worker; report unsupported/image-only documents.
- **FR-113:** Map separate debit/credit columns or one signed amount column into a canonical signed amount.
- **FR-114:** Preview source-to-canonical mappings and at least 20 representative rows where available.
- **FR-115:** Validate required date, description, amount, currency/account context, and decimal precision.
- **FR-116:** Export row-level warnings and errors as a sanitized CSV or JSON report.
- **FR-117:** Commit valid rows, import metadata, and fingerprints in one transaction after explicit confirmation.

## Normalization and deduplication

- **FR-120:** Normalize Unicode, surrounding whitespace, line breaks, dates, amounts, and description tokens without overwriting originals.
- **FR-121:** Generate a dataset-scoped fingerprint from normalized stable fields.
- **FR-122:** Mark identical source identifiers or fingerprints as exact duplicates.
- **FR-123:** Rank likely duplicates using account, amount, currency, date window, and description similarity.
- **FR-124:** Allow keep-existing, keep-new, keep-both, and manual-link decisions for ambiguous pairs.
- **FR-125:** Apply remembered duplicate decisions only when their defining evidence still matches.

## Transactions

- **FR-200:** List, paginate/virtualize, filter, sort, and search canonical transactions.
- **FR-201:** Edit description label, merchant, category, notes, tags, review state, and transfer state while preserving audit metadata.
- **FR-202:** Lock user-confirmed fields against automatic overwrite.
- **FR-203:** Support reversible bulk edit for category, merchant, tags, and review status.
- **FR-204:** Show provenance including source import, location, original values, and applied transformations.
- **FR-205:** Exclude voided records from calculations while keeping them auditable.

## Categories and merchants

- **FR-220:** Create, reorder, rename, archive, and nest categories to a bounded depth.
- **FR-221:** Ship editable starter categories identified independently from display labels.
- **FR-222:** Prevent category cycles and explain the effect of archive/delete on historical records.
- **FR-223:** Create and merge merchants while retaining aliases and redirecting references.
- **FR-224:** Normalize merchant aliases and show collision candidates before save.

## Classification

- **FR-300:** Execute precedence: locked decision, exact transaction override, deterministic rules, merchant mapping, heuristic, eligible AI, unclassified.
- **FR-301:** Record classifier ID/version, result, confidence, evidence codes, and timestamp for each inference.
- **FR-302:** Route confidence below configurable thresholds and all conflicts to review.
- **FR-303:** Never invoke AI for a field resolved by a higher-precedence rule.
- **FR-304:** Apply structured-output validation and allowed-category constraints to model responses.
- **FR-305:** Cache model-independent results by redacted task input and classifier version where safe.

## Rules and learning

- **FR-320:** Support conditions on normalized description, merchant, amount/range, account, date/cadence, direction, and existing tags.
- **FR-321:** Support actions for merchant, category, tags, review state, and ignored status; transfer pairing remains separately confirmed.
- **FR-322:** Preview match counts and samples against current records before rule activation.
- **FR-323:** Assign explicit priority and specificity; surface incompatible same-precedence matches as conflicts.
- **FR-324:** Store creation source, last edit, application count, last matched date, and enabled state.
- **FR-325:** Re-evaluate affected records after a rule change without mutating locked decisions.
- **FR-326:** Maintain a bounded, reversible local history of rule and bulk-operation changes.

## Transfers and recurring series

- **FR-340:** Propose transfer pairs using equal/opposite values after currency normalization rules, date proximity, and account distinction.
- **FR-341:** Require confirmation below the auto-match threshold and always allow unlinking.
- **FR-342:** Detect recurring candidates from merchant similarity, cadence stability, and amount tolerance.
- **FR-343:** Track series status as proposed, confirmed, dismissed, or muted.
- **FR-344:** Recompute series incrementally after imports and material merchant changes.

## Dashboards and insights

- **FR-400:** Calculate totals with decimal arithmetic and prevent aggregation across currencies without an explicit exchange-rate source and date.
- **FR-401:** Provide overview, cash-flow, category, merchant, recurring, and savings dashboards.
- **FR-402:** Apply global date, account, currency, category, merchant, and tag filters.
- **FR-403:** Drill every aggregate and insight into a reproducible transaction set.
- **FR-404:** Provide a table and text summary equivalent for each chart.
- **FR-405:** Save dashboard layout and filters using the dashboard schema.
- **FR-406:** Export the current table/query as CSV and a print-friendly report without hidden data.

## Natural-language analysis

- **FR-420:** Translate a question into a validated read-only query plan over allowed metrics and dimensions.
- **FR-421:** Execute arithmetic and filtering locally using the deterministic query engine.
- **FR-422:** Give the model only schema, allowed values, and minimized context necessary for query planning or wording.
- **FR-423:** Display active interpretation, filters, result set link, and uncertainty.
- **FR-424:** Reject mutation, unsupported advice, prompt-injected source text, and queries outside the local dataset.

## AI provider management

- **FR-500:** Configure no-AI, browser-local, self-hosted, and remote provider profiles.
- **FR-501:** Probe endpoint health and capabilities without sending financial records.
- **FR-502:** Estimate download size or remote token/cost range before eligible operations where data is available.
- **FR-503:** Require per-provider consent version and show revocation controls.
- **FR-504:** Store API keys session-only by default; persistent storage requires explicit opt-in and platform-appropriate protection.
- **FR-505:** Support timeout, cancellation, retry with bounded backoff, and structured error states.

## Portability, backup, and deletion

- **FR-600:** Export Financial Brain JSON conforming to `financial-brain.schema.json`.
- **FR-601:** Import Brain data in preview mode, showing additions, duplicates, conflicts, and unsupported versions.
- **FR-602:** Merge by stable IDs and semantic identity; never resolve incompatible rule actions silently.
- **FR-603:** Create encrypted full backups using authenticated encryption and a memory-hard passphrase KDF.
- **FR-604:** Verify backup integrity and schema compatibility before restore mutation.
- **FR-605:** Delete selected imports and recompute derived data without affecting unrelated source records.
- **FR-606:** Delete the workspace from application-controlled stores and explain browser/platform limitations.

## Plugins

- **FR-700:** Install only packages with a valid manifest, compatible API range, integrity metadata, and declared permissions.
- **FR-701:** Obtain explicit grants for transaction fields, writes, exports, network origins, model access, and UI surfaces.
- **FR-702:** Run plugins in an isolated context with capability-based host calls.
- **FR-703:** Record plugin data access and allow revoke, disable, or uninstall.
- **FR-704:** Validate plugin-proposed mutations through the same domain rules as core UI actions.

## Error behavior

- **FR-800:** Errors MUST state what happened, what was preserved, and a safe next action.
- **FR-801:** Logs MUST use structured codes and redact descriptions, account labels, amounts, secrets, source content, and provider payloads by default.
- **FR-802:** Crashes during a staged operation MUST recover to the last committed state.

## Related documents

- [Import pipeline](11-IMPORT-PIPELINE.md)
- [Learning engine](10-LEARNING-ENGINE.md)
- [AI architecture](08-AI-ARCHITECTURE.md)
