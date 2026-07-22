import type Dexie from "dexie";
import type { Transaction } from "dexie";

import { StorageError } from "./errors";

export interface DatabaseMigration {
  readonly version: number;
  readonly description: string;
  readonly stores: Readonly<Record<string, string | null>>;
  readonly upgrade?: (transaction: Transaction) => PromiseLike<unknown> | void;
}

const WORKSPACE_SCHEMA = "&id, createdAt, updatedAt";
const MIGRATION_JOURNAL_SCHEMA = "&id, migrationId, status, updatedAt";
const ACCOUNT_SCHEMA =
  "&id, workspaceId, [workspaceId+createdAt], [workspaceId+archived], createdAt, updatedAt";
const IMPORT_SCHEMA =
  "&id, accountId, [accountId+createdAt], source.sha256, status, committedRevision, createdAt";
const TRANSACTION_SCHEMA =
  "&id, accountId, importId, [accountId+postedDate], &[accountId+sourceTransactionId], createdAt";
const REVIEWABLE_TRANSACTION_SCHEMA =
  "&id, accountId, importId, [accountId+postedDate], [accountId+sourceTransactionId], [accountId+currency+amount+postedDate], [accountId+reviewState+postedDate], [accountId+categoryId+postedDate], createdAt";
const TRANSACTION_FINGERPRINT_SCHEMA =
  "&transactionId, accountId, importId, fingerprint, [accountId+fingerprint]";
const CATEGORY_SCHEMA = "&id, kind, order, archived, name, updatedAt";
const TRANSACTION_OPERATION_SCHEMA = "&id, kind, createdAt, undoneAt";
const DUPLICATE_RESOLUTION_SCHEMA = "&id, type, candidateId, occurredAt";
const MERCHANT_SCHEMA = "&id, name, archived, updatedAt";
const CLASSIFICATION_RULE_SCHEMA = "&id, priority, enabled, name, updatedAt";
const TRANSFER_DECISION_SCHEMA = "&id, signature, status, updatedAt";
const RECURRING_DECISION_SCHEMA = "&id, signature, status, updatedAt";
const LEARNING_OPERATION_SCHEMA = "&id, kind, createdAt, undoneAt";
const DECISION_EVENT_SCHEMA = "&id, aggregateType, aggregateId, action, occurredAt";
const AI_PROVIDER_PROFILE_SCHEMA = "&id, kind, enabled, updatedAt";
const AI_SUGGESTION_SCHEMA = "&id, targetTransactionId, status, task, createdAt";

export const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    version: 1,
    description: "Create the canonical workspace store",
    stores: { workspaces: WORKSPACE_SCHEMA },
  },
  {
    version: 2,
    description: "Add resumable migration journals",
    stores: {
      workspaces: WORKSPACE_SCHEMA,
      migrationJournal: MIGRATION_JOURNAL_SCHEMA,
    },
  },
  {
    version: 3,
    description: "Add canonical accounts scoped to workspaces",
    stores: {
      workspaces: WORKSPACE_SCHEMA,
      migrationJournal: MIGRATION_JOURNAL_SCHEMA,
      accounts: ACCOUNT_SCHEMA,
    },
  },
  {
    version: 4,
    description: "Add canonical imports, transactions, and rebuildable fingerprints",
    stores: {
      workspaces: WORKSPACE_SCHEMA,
      migrationJournal: MIGRATION_JOURNAL_SCHEMA,
      accounts: ACCOUNT_SCHEMA,
      imports: IMPORT_SCHEMA,
      transactions: TRANSACTION_SCHEMA,
      transactionFingerprints: TRANSACTION_FINGERPRINT_SCHEMA,
    },
  },
  {
    version: 5,
    description: "Add reviewable ledger, categories, undo history, and duplicate decisions",
    stores: {
      workspaces: WORKSPACE_SCHEMA,
      migrationJournal: MIGRATION_JOURNAL_SCHEMA,
      accounts: ACCOUNT_SCHEMA,
      imports: IMPORT_SCHEMA,
      transactions: REVIEWABLE_TRANSACTION_SCHEMA,
      transactionFingerprints: TRANSACTION_FINGERPRINT_SCHEMA,
      categories: CATEGORY_SCHEMA,
      transactionOperations: TRANSACTION_OPERATION_SCHEMA,
      duplicateResolutionEvents: DUPLICATE_RESOLUTION_SCHEMA,
    },
  },
  {
    version: 6,
    description: "Add merchants and classification rules",
    stores: {
      workspaces: WORKSPACE_SCHEMA,
      migrationJournal: MIGRATION_JOURNAL_SCHEMA,
      accounts: ACCOUNT_SCHEMA,
      imports: IMPORT_SCHEMA,
      transactions: REVIEWABLE_TRANSACTION_SCHEMA,
      transactionFingerprints: TRANSACTION_FINGERPRINT_SCHEMA,
      categories: CATEGORY_SCHEMA,
      transactionOperations: TRANSACTION_OPERATION_SCHEMA,
      duplicateResolutionEvents: DUPLICATE_RESOLUTION_SCHEMA,
      merchants: MERCHANT_SCHEMA,
      classificationRules: CLASSIFICATION_RULE_SCHEMA,
    },
  },
  {
    version: 7,
    description: "Add transfer decisions store",
    stores: {
      workspaces: WORKSPACE_SCHEMA,
      migrationJournal: MIGRATION_JOURNAL_SCHEMA,
      accounts: ACCOUNT_SCHEMA,
      imports: IMPORT_SCHEMA,
      transactions: REVIEWABLE_TRANSACTION_SCHEMA,
      transactionFingerprints: TRANSACTION_FINGERPRINT_SCHEMA,
      categories: CATEGORY_SCHEMA,
      transactionOperations: TRANSACTION_OPERATION_SCHEMA,
      duplicateResolutionEvents: DUPLICATE_RESOLUTION_SCHEMA,
      merchants: MERCHANT_SCHEMA,
      classificationRules: CLASSIFICATION_RULE_SCHEMA,
      transferDecisions: TRANSFER_DECISION_SCHEMA,
    },
  },
  {
    version: 8,
    description: "Add recurring decisions store",
    stores: {
      workspaces: WORKSPACE_SCHEMA,
      migrationJournal: MIGRATION_JOURNAL_SCHEMA,
      accounts: ACCOUNT_SCHEMA,
      imports: IMPORT_SCHEMA,
      transactions: REVIEWABLE_TRANSACTION_SCHEMA,
      transactionFingerprints: TRANSACTION_FINGERPRINT_SCHEMA,
      categories: CATEGORY_SCHEMA,
      transactionOperations: TRANSACTION_OPERATION_SCHEMA,
      duplicateResolutionEvents: DUPLICATE_RESOLUTION_SCHEMA,
      merchants: MERCHANT_SCHEMA,
      classificationRules: CLASSIFICATION_RULE_SCHEMA,
      transferDecisions: TRANSFER_DECISION_SCHEMA,
      recurringDecisions: RECURRING_DECISION_SCHEMA,
    },
  },
  {
    version: 9,
    description: "Add atomic learning and derived-decision operation journals",
    stores: {
      workspaces: WORKSPACE_SCHEMA,
      migrationJournal: MIGRATION_JOURNAL_SCHEMA,
      accounts: ACCOUNT_SCHEMA,
      imports: IMPORT_SCHEMA,
      transactions: REVIEWABLE_TRANSACTION_SCHEMA,
      transactionFingerprints: TRANSACTION_FINGERPRINT_SCHEMA,
      categories: CATEGORY_SCHEMA,
      transactionOperations: TRANSACTION_OPERATION_SCHEMA,
      duplicateResolutionEvents: DUPLICATE_RESOLUTION_SCHEMA,
      merchants: MERCHANT_SCHEMA,
      classificationRules: CLASSIFICATION_RULE_SCHEMA,
      transferDecisions: TRANSFER_DECISION_SCHEMA,
      recurringDecisions: RECURRING_DECISION_SCHEMA,
      learningOperations: LEARNING_OPERATION_SCHEMA,
      decisionEvents: DECISION_EVENT_SCHEMA,
    },
  },
  {
    version: 10,
    description: "Add AI provider profile store",
    stores: {
      workspaces: WORKSPACE_SCHEMA,
      migrationJournal: MIGRATION_JOURNAL_SCHEMA,
      accounts: ACCOUNT_SCHEMA,
      imports: IMPORT_SCHEMA,
      transactions: REVIEWABLE_TRANSACTION_SCHEMA,
      transactionFingerprints: TRANSACTION_FINGERPRINT_SCHEMA,
      categories: CATEGORY_SCHEMA,
      transactionOperations: TRANSACTION_OPERATION_SCHEMA,
      duplicateResolutionEvents: DUPLICATE_RESOLUTION_SCHEMA,
      merchants: MERCHANT_SCHEMA,
      classificationRules: CLASSIFICATION_RULE_SCHEMA,
      transferDecisions: TRANSFER_DECISION_SCHEMA,
      recurringDecisions: RECURRING_DECISION_SCHEMA,
      learningOperations: LEARNING_OPERATION_SCHEMA,
      decisionEvents: DECISION_EVENT_SCHEMA,
      aiProviderProfiles: AI_PROVIDER_PROFILE_SCHEMA,
    },
  },
  {
    version: 11,
    description: "Add AI suggestion store",
    stores: {
      workspaces: WORKSPACE_SCHEMA,
      migrationJournal: MIGRATION_JOURNAL_SCHEMA,
      accounts: ACCOUNT_SCHEMA,
      imports: IMPORT_SCHEMA,
      transactions: REVIEWABLE_TRANSACTION_SCHEMA,
      transactionFingerprints: TRANSACTION_FINGERPRINT_SCHEMA,
      categories: CATEGORY_SCHEMA,
      transactionOperations: TRANSACTION_OPERATION_SCHEMA,
      duplicateResolutionEvents: DUPLICATE_RESOLUTION_SCHEMA,
      merchants: MERCHANT_SCHEMA,
      classificationRules: CLASSIFICATION_RULE_SCHEMA,
      transferDecisions: TRANSFER_DECISION_SCHEMA,
      recurringDecisions: RECURRING_DECISION_SCHEMA,
      learningOperations: LEARNING_OPERATION_SCHEMA,
      decisionEvents: DECISION_EVENT_SCHEMA,
      aiProviderProfiles: AI_PROVIDER_PROFILE_SCHEMA,
      aiSuggestions: AI_SUGGESTION_SCHEMA,
    },
  },
];

export const CURRENT_DATABASE_VERSION = 11;

export function registerDatabaseMigrations(
  database: Dexie,
  migrations: readonly DatabaseMigration[] = DATABASE_MIGRATIONS,
): void {
  assertMigrationRegistry(migrations);

  for (const migration of migrations) {
    const version = database.version(migration.version).stores(migration.stores);

    if (migration.upgrade !== undefined) {
      version.upgrade(async (transaction) => {
        try {
          await migration.upgrade?.(transaction);
        } catch (error) {
          throw new StorageError("MIGRATION_FAILED", { cause: error });
        }
      });
    }
  }
}

function assertMigrationRegistry(migrations: readonly DatabaseMigration[]): void {
  if (migrations.length === 0) {
    throw new TypeError("The database migration registry must not be empty");
  }

  for (const [index, migration] of migrations.entries()) {
    const expectedVersion = index + 1;

    if (migration.version !== expectedVersion) {
      throw new TypeError(
        `Database migration versions must be contiguous: expected ${expectedVersion}, received ${migration.version}`,
      );
    }

    if (migration.description.trim().length === 0) {
      throw new TypeError(`Database migration ${migration.version} requires a description`);
    }
  }
}
