# Encrypted Backup Spike

## Purpose

Phase 1 proves that a complete local workspace can be exported, encrypted, downloaded, decrypted,
authenticated, and previewed in a browser without writing restored data. This is an experimental
recovery artifact, not a production restore promise.

**Superseded by production restore (Phase 3, issue #28, ADR-015).** The production format is snapshot
v2 with a required authenticated per-section manifest (record counts, canonical byte lengths, SHA-256
digests), worker-isolated cryptography, and a staged atomic restore with restore-as-new / replace /
conflict-free merge modes. There is no v1 snapshot reader. The measurements and threat notes below
remain the baseline; see ADR-015 for the production decision.

## User flow

1. Open **Settings → Create encrypted backup**.
2. Choose a workspace and enter the same passphrase twice. Passphrases must contain at least 12
   characters; the application does not trim or normalize them.
3. The browser takes a consistent read-only IndexedDB snapshot, derives a key, encrypts the UTF-8
   JSON payload, and downloads a `.fintbackup` file.
4. Under **Preview encrypted backup**, choose that file and enter its passphrase.
5. The browser decrypts and validates the payload in memory, then displays only the workspace name,
   revision, export time, and record counts. It does not merge, replace, or otherwise write data.

There is no password recovery. Keep the original data, backup, and passphrase in separate safe
locations. Losing the passphrase makes the backup unrecoverable.

## Snapshot contract

The decrypted payload is UTF-8 JSON with:

- format `financial-intelligence.workspace-backup`;
- version `1.0.0`;
- export time and source IndexedDB schema version;
- one workspace and its accounts;
- canonical statement-import and transaction documents;
- the category taxonomy needed to interpret category IDs;
- transaction edit operations and duplicate-resolution events.

The snapshot intentionally excludes retained source statements (the application does not retain
them), transaction fingerprint indexes, and the migration journal. Fingerprints are derived data;
the migration journal describes a device database rather than portable financial state.

The separate Financial Brain format remains a portable learning/rules document. It is not embedded
or silently merged by this workspace-backup spike.

## CSV and JSON exports

The full-fidelity recovery format is canonical JSON because it preserves identifiers, decimal
amount strings, provenance, classifications, history, and relationships. The transaction ledger's
existing CSV export is a human-oriented, filtered view containing transaction, date, description,
amount, currency, account, category, review/status, source-location, and filter-summary fields. It
is UTF-8 and prefixes spreadsheet formula markers (`=`, `+`, `-`, `@`, tab, and carriage return)
with an apostrophe. CSV is not a restore format.

## Container limits and failure behavior

- Plaintext payload: at most 64 MiB and 250,000 transactions.
- Encrypted file selected in the UI: at most 128 MiB.
- Argon2id parameters are bounded before allocation.
- AES-GCM authenticates the ciphertext and every header field, including salt, nonce, KDF
  parameters, payload metadata, version, and creation time.
- Wrong passphrases and authentication failures return the same generic error and reveal no
  decrypted metadata.
- Malformed, truncated, oversized, or unsupported containers are rejected before any restore
  action. The preview use case has no repository or write port, so interruption and failure cannot
  mutate IndexedDB.

## Recorded measurements

Synthetic measurements were captured on 2026-07-20 using the repository benchmark test on the
development machine. They include serialization, Argon2id derivation, AES-GCM encryption, and JSON
container encoding. They are directional, not browser performance guarantees.

| Case | Transactions | Plaintext | Encrypted container | Elapsed |
|---|---:|---:|---:|---:|
| Small | 1 | 1,872 bytes | 2,984 bytes | 25 ms |
| Typical | 1,000 | 550,122 bytes | 733,986 bytes | 45 ms |
| Bounded large sample | 10,000 | 5,509,127 bytes | 7,345,993 bytes | 225 ms |

Reproduce with:

```sh
pnpm exec vitest run packages/backup/src/benchmark.test.ts --reporter=verbose --disableConsoleIntercept
```

Before production restore is enabled, repeat the matrix on supported low-memory mobile devices and
at the 250,000-transaction bound. Add cancellation/progress handling if measurements show the main
thread can be blocked perceptibly.

## Validation coverage

Automated tests cover valid round trips, wrong passphrases, modified salt, nonce, ciphertext/tag,
and authenticated headers, truncation, unsupported container and payload versions, resource bounds,
workspace isolation, and read-only snapshot behavior. Browser UI testing remains required before
the Phase 3 restore workflow is enabled.

## Related documents

- [ADR-007: Versioned encrypted workspace backup](adr/ADR-007-Encrypted-Workspace-Backup.md)
- [Security and privacy](12-SECURITY-AND-PRIVACY.md)
- [System architecture](07-SYSTEM-ARCHITECTURE.md)
- [Data model](09-DATA-MODEL.md)
