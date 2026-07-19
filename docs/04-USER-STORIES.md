# User Stories

## Purpose

Describe observable user value and acceptance examples. IDs map to product and functional requirements.

## Epic A: private setup

### US-001 — Start without an account

As a privacy-conscious user, I want to start locally without registration so that evaluation does not expose my identity.

**Acceptance criteria**

- The first useful screen is reachable without network access or authentication.
- Storage and backup limitations are explained in plain language.
- No analytics or model endpoint is contacted in local/no-AI mode.

### US-002 — Configure an account

As a user, I want to name an account and choose its type, currency, and institution label so imported activity has context.

**Acceptance criteria**

- No credentials or full account number are requested.
- Duplicate display names are allowed; stable IDs remain unique.
- Currency cannot be changed after transactions exist without an explicit migration.

## Epic B: import statements

### US-010 — Preview a CSV import

As a user, I want to verify column mappings and parsed values before saving so a format mistake cannot corrupt my history.

**Acceptance criteria**

- Encoding, delimiter, header row, date format, amount model, and account are visible or editable.
- At least representative valid and invalid rows are shown.
- The commit action is disabled for unresolved required-field errors.

### US-011 — Re-import overlapping periods

As a returning user, I want duplicate detection when statements overlap so totals remain correct.

**Acceptance criteria**

- Exact matches are identified separately from likely matches.
- Ambiguous pairs show evidence and allow keeping either or both.
- No source record is silently discarded.

### US-012 — Recover from import errors

As a user, I want actionable row errors and an error report so I can correct the source or mapping.

**Acceptance criteria**

- Each error identifies a source location, rejected value, and reason.
- Canceling or failing leaves no partial committed import.
- A corrected mapping can be retried without selecting the file again during the session.

## Epic C: organize and teach

### US-020 — Understand a classification

As a user, I want to know why a category was chosen so I can trust or correct it.

**Acceptance criteria**

- Method, confidence, and evidence are visible.
- Exact rule matches identify the rule.
- AI explanations do not expose hidden chain-of-thought; they present concise decision evidence.

### US-021 — Correct once or learn a rule

As a user, I want to choose whether an edit applies once or to similar transactions so learning remains under my control.

**Acceptance criteria**

- One-time correction is always available.
- Proposed rule scope and sample matches are previewed.
- Existing conflicting rules are shown before save.

### US-022 — Review uncertain items efficiently

As a user, I want a keyboard-friendly queue and bulk actions so I can resolve uncertainty quickly.

**Acceptance criteria**

- Queue filters include confidence, conflict, account, amount, and date.
- Bulk actions show affected count and remain undoable.
- Locked decisions leave the queue and cannot be overridden automatically.

### US-023 — Identify transfers

As a user with multiple accounts, I want matching internal transfers so spending and income are not double-counted.

**Acceptance criteria**

- Candidates use amount, currency, date window, and description evidence.
- The user can confirm, reject, unlink, or manually pair.
- Confirmed pairs are excluded from income/spending but remain visible.

## Epic D: understand money

### US-030 — Explore monthly cash flow

As a household analyst, I want income, spending, transfers, and net cash flow by month so I can see direction and change.

**Acceptance criteria**

- Totals use decimal-safe arithmetic and state currency.
- Each number drills down to transactions.
- Incomplete periods are clearly marked.

### US-031 — Find recurring costs

As a user, I want likely subscriptions and recurring bills so I can review ongoing commitments.

**Acceptance criteria**

- Cadence, amount range, last occurrence, and confidence are shown.
- Detection does not label a charge as unwanted.
- Users can confirm, dismiss, or mute a series.

### US-032 — Ask a question

As a user, I want to ask a natural-language question and receive a sourced answer so analysis is approachable.

**Acceptance criteria**

- Numeric claims are produced from a local structured query, not model arithmetic.
- The answer shows active filters and links to supporting records.
- Unanswerable or ambiguous questions ask for clarification instead of inventing values.

## Epic E: ownership and recovery

### US-040 — Export learned knowledge

As a user, I want a readable Financial Brain file so I can inspect and move my learning.

**Acceptance criteria**

- Export validates against its declared schema version.
- It excludes transactions, source files, API keys, and secrets.
- The app previews included item counts.

### US-041 — Restore an encrypted backup

As a user moving devices, I want to restore all data from an encrypted backup so I can continue safely.

**Acceptance criteria**

- An incorrect passphrase reveals no workspace contents.
- Integrity and version are checked before mutation.
- Replace and supported merge behaviors show a summary and require confirmation.

### US-042 — Delete my data

As a user, I want granular and complete deletion controls so ownership includes removal.

**Acceptance criteria**

- The consequences and affected counts are shown.
- Complete workspace deletion requires explicit confirmation.
- The app explains that independent exported files are not affected.

## Epic F: power-user extensibility

### US-050 — Use a chosen model endpoint

As a technical user, I want to configure a compatible endpoint so I can use my own infrastructure.

**Acceptance criteria**

- Connection testing does not send transactions.
- The app shows capabilities and which tasks can use the provider.
- Endpoint failures do not block local workflows.

### US-051 — Install a plugin safely

As a technical user, I want to inspect plugin permissions before installation so extensions cannot silently access everything.

**Acceptance criteria**

- Permissions and network destinations are explicit.
- Denied optional permissions degrade the plugin predictably.
- A plugin can be disabled or removed without corrupting core records.

## Related documents

- [Product requirements](03-PRODUCT-REQUIREMENTS.md)
- [UX guidelines](13-UX-GUIDELINES.md)
- [Plugin system](14-PLUGIN-SYSTEM.md)
