# ADR-007: Versioned Encrypted Workspace Backup

- Status: Accepted
- Date: 2026-07-20
- Decision owners: Project maintainers

## Context

Offline-first data is only durable while the browser profile and device remain available. A user
needs a portable full-workspace backup without sending financial data or a passphrase to a service.
The container must detect wrong passwords, corruption, and metadata tampering before any state can
be restored. Browser constraints also require bounded memory and parameters that work without a
native cryptography installation.

The Financial Brain is a different portable contract: it contains learned rules and preferences,
not the canonical transaction ledger. Conflating the two would make recovery and learning merges
ambiguous.

## Decision

Adopt an experimental, versioned JSON envelope for the Phase 1 spike:

- container format `financial-intelligence.encrypted-backup`, version `1.0.0`;
- canonical UTF-8 JSON workspace payload, format
  `financial-intelligence.workspace-backup`, version `1.0.0`;
- Argon2id version 19 through pinned `hash-wasm` 4.12.0, using a random 16-byte salt, 19,456 KiB
  memory, two iterations, parallelism one, and a 32-byte result;
- non-extractable 256-bit AES-GCM key imported through Web Crypto;
- random 12-byte nonce, 128-bit authentication tag, and the entire serialized header supplied as
  AES-GCM additional authenticated data;
- 64 MiB decrypted-payload and 250,000-transaction bounds, plus bounded KDF parameters;
- generic authentication failure, in-memory validation, and metadata-only preview with no write
  port.

The Argon2id settings match OWASP's current minimum option (19 MiB, two iterations, parallelism
one). RFC 9106's memory-constrained recommendation (64 MiB, three iterations, parallelism four) was
considered but not selected for this cross-device browser spike because it requires materially more
memory and parallel execution. Production parameters remain subject to supported-device benchmarks
and an independent cryptographic review.

The JSON envelope is inspectable but contains no plaintext workspace labels or records. Format and
algorithm identifiers are explicit so future readers fail closed on unsupported versions. Any
change to serialization order, header fields, KDF, cipher, or parameter policy requires a new
container version and migration/compatibility fixtures.

No production merge or replace operation is accepted by this decision. Restore is preview-only
until Phase 3 defines conflict handling, atomic temporary-database validation, recovery testing,
and user confirmation.

Primary references:

- <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>
- <https://www.rfc-editor.org/rfc/rfc9106.html>
- <https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt>
- <https://github.com/Daninet/hash-wasm>

## Consequences

### Positive

- Raw financial data and passphrases remain local to the browser.
- Header, ciphertext, and tag corruption is detected before payload details are exposed.
- A memory-hard KDF raises the cost of offline password guessing.
- The snapshot boundary is consistent and read-only; preview cannot mutate application storage.
- Financial Brain evolution remains independent from full-workspace disaster recovery.

### Negative

- There is intentionally no passphrase recovery.
- JSON plus base64url increases file size relative to a binary container.
- Argon2id requires a third-party WASM implementation because Web Crypto does not provide it.
- Current work happens in memory and needs broader device benchmarks before maximum-size production
  use.
- A format marked experimental may need an explicit migration tool rather than indefinite reader
  compatibility.

## Alternatives considered

- **PBKDF2 through Web Crypto:** rejected for new backups because it is not memory-hard and is less
  resistant to parallel password guessing.
- **RFC 9106 64 MiB/three-iteration profile:** deferred pending low-memory browser measurements.
- **scrypt:** rejected because Argon2id is the preferred modern password-hardening candidate and has
  a reviewed browser-capable implementation candidate.
- **AES-CBC plus a separate MAC:** rejected because composition and key separation add avoidable
  implementation risk; AES-GCM provides authenticated encryption in Web Crypto.
- **Unauthenticated metadata:** rejected because an attacker could alter KDF/resource parameters or
  misleading preview metadata.
- **Encrypt the Financial Brain only:** rejected because it does not recover canonical transactions,
  imports, accounts, categories, or edit history.
- **Cloud escrow or password reset:** rejected because it conflicts with offline-first ownership and
  would introduce an external trust boundary.

## Validation

- Unit tests authenticate round trips and reject wrong passwords, modified salt/nonce/header,
  modified ciphertext/tag, truncation, and unsupported versions.
- Snapshot parsing validates UTF-8, resource bounds, identifiers through canonical domain parsers,
  uniqueness, hierarchy, and account/import/transaction relationships.
- IndexedDB tests prove one-workspace isolation and unchanged record counts after snapshot creation.
- Synthetic small, typical, and bounded-large measurements are recorded in the spike guide.
- Production restore remains blocked on an independent crypto review and Phase 3 atomic-restore tests.

## Related decisions

- [ADR-001: Offline-first core architecture](ADR-001-Offline-First.md)
- [ADR-002: IndexedDB as primary browser persistence](ADR-002-Why-IndexedDB.md)
- [Security and privacy](../12-SECURITY-AND-PRIVACY.md)
- [Encrypted backup spike](../19-ENCRYPTED-BACKUP-SPIKE.md)
