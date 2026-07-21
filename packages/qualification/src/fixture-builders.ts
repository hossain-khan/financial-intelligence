import {
  FINANCIAL_BRAIN_SCHEMA_VERSION,
  Money,
  createAccount,
  createCommittedImport,
  createTransaction,
  createWorkspace,
  importToCanonical,
  parseAccountId,
  parseBrainId,
  parseDateOnly,
  parseImportId,
  parseTransactionId,
  parseUtcTimestamp,
  parseWorkspaceId,
  serializeFinancialBrain,
  transactionToCanonical,
} from "@financial-intelligence/domain";

/**
 * Deterministic builders for the immutable compatibility fixture corpus. They produce the exact
 * synthetic documents whose bytes are frozen under `test-fixtures/compatibility/`. Kept in the
 * package (not a script) so the same code both writes the released bytes and is available to the
 * immutability test; nothing here derives from real data. Timestamps and IDs are fixed so output is
 * byte-stable.
 */
export const FIXTURE_NOW = "2026-01-02T00:00:00.000Z";
export const FIXTURE_PASSPHRASE = "compatibility fixture passphrase";
const WORKSPACE_ID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda701";
const ACCOUNT_ID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda702";
const IMPORT_ID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda703";
const TX_ID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda704";
const BRAIN_ID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda705";

function now() {
  return parseUtcTimestamp(FIXTURE_NOW);
}

export function fixtureWorkspace() {
  return createWorkspace({ id: parseWorkspaceId(WORKSPACE_ID), name: "Fixture", now: now() });
}

export function fixtureAccount() {
  return createAccount({
    id: parseAccountId(ACCOUNT_ID),
    workspaceId: parseWorkspaceId(WORKSPACE_ID),
    name: "Everyday",
    type: "checking",
    currency: "CAD",
    now: now(),
  });
}

export function fixtureImport() {
  return createCommittedImport({
    id: parseImportId(IMPORT_ID),
    accountId: parseAccountId(ACCOUNT_ID),
    source: {
      fileName: "fixture.csv",
      mediaType: "text/csv",
      byteSize: 80,
      sha256: "0".repeat(64),
    },
    parser: { id: "financial-intelligence/csv", version: "1.0.0" },
    mapping: {},
    counts: {
      sourceRows: 1,
      valid: 1,
      errors: 0,
      warnings: 0,
      exactDuplicates: 0,
      likelyDuplicates: 0,
      committed: 1,
    },
    issues: [],
    committedRevision: 1,
    now: now(),
  });
}

export function fixtureTransaction() {
  return createTransaction({
    id: parseTransactionId(TX_ID),
    accountId: parseAccountId(ACCOUNT_ID),
    importId: parseImportId(IMPORT_ID),
    postedDate: parseDateOnly("2026-01-01"),
    money: Money.from("-12.34", "CAD"),
    description: "Fixture Merchant",
    provenance: {
      parserId: "financial-intelligence/csv",
      parserVersion: "1.0.0",
      sourceLocation: "line:2",
      original: {},
      transformations: ["mapping:1.0.0"],
    },
    now: now(),
  });
}

/** The exact JSON string frozen at `canonical/transaction-1.0.0.json`. */
export function fixtureTransactionJson(): string {
  return `${JSON.stringify(transactionToCanonical(fixtureTransaction()), null, 2)}\n`;
}

/** The exact JSON string frozen at `canonical/import-1.0.0.json`. */
export function fixtureImportJson(): string {
  return `${JSON.stringify(importToCanonical(fixtureImport()), null, 2)}\n`;
}

/** The exact Financial Brain export frozen at `financial-brain/v1.0.0/brain.financial-brain.json`. */
export function fixtureBrainJson(): string {
  return serializeFinancialBrain({
    schemaVersion: FINANCIAL_BRAIN_SCHEMA_VERSION,
    brainId: parseBrainId(BRAIN_ID),
    createdAt: now(),
    updatedAt: now(),
    producer: { application: "Financial Intelligence", version: "0.1.0" },
    categories: [],
    merchants: [],
    rules: [],
    recurringDecisions: [],
    preferences: { locale: "en-US", firstDayOfWeek: "monday", reviewConfidenceThreshold: 0.8 },
  });
}
