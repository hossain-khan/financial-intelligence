import "fake-indexeddb/auto";

import {
  ApplyBulkTransactionEdit,
  CommitAcceptedImport,
  ListCategories,
  ResolveDuplicate,
  RebuildTransactionFingerprints,
  UndoBulkTransactionEdit,
  UndoDuplicateResolution,
} from "@financial-intelligence/application";
import {
  STARTER_CATEGORY_DEFINITIONS,
  createAccount,
  createWorkspace,
  detectDuplicateCandidates,
  duplicateEvidenceSignature,
  parseAccountId,
  parseAliasId,
  parseMerchantId,
  parseRuleId,
  parseUtcTimestamp,
  parseWorkspaceId,
} from "@financial-intelligence/domain";
import { afterEach, describe, expect, it } from "vitest";

import {
  FinancialDatabase,
  IndexedDbAccountRepository,
  IndexedDbCategoryRepository,
  IndexedDbDuplicateResolutionRepository,
  IndexedDbImportCommitRepository,
  IndexedDbMerchantRepository,
  IndexedDbRuleRepository,
  IndexedDbTransactionLedgerRepository,
  IndexedDbWorkspaceRepository,
  IndexedDbWorkspaceBackupRepository,
} from "./database";

const databases: FinancialDatabase[] = [];

afterEach(async () => {
  await Promise.all(
    databases.splice(0).map(async (database) => {
      database.close();
      await database.delete();
    }),
  );
});

describe("IndexedDbCategoryRepository", () => {
  it("initializes stable starter categories and persists edited labels", async () => {
    const database = new FinancialDatabase(`test-${crypto.randomUUID()}`);
    databases.push(database);
    const repository = new IndexedDbCategoryRepository(database);
    const categories = await new ListCategories(repository, {
      now: () => new Date("2026-07-19T17:00:00.000Z"),
    }).execute();

    expect(categories).toHaveLength(STARTER_CATEGORY_DEFINITIONS.length);
    const groceries = categories.find((category) => category.name === "Groceries")!;
    await repository.save({ ...groceries, name: "Food at home" });
    database.close();

    const reopened = new FinancialDatabase(database.name);
    expect(
      (await new IndexedDbCategoryRepository(reopened).list()).find(
        (category) => category.id === groceries.id,
      )?.name,
    ).toBe("Food at home");
    reopened.close();
  });
});

describe("IndexedDbMerchantRepository & IndexedDbRuleRepository", () => {
  it("persists and retrieves merchants and rules across database reopens", async () => {
    const database = new FinancialDatabase(`test-${crypto.randomUUID()}`);
    databases.push(database);

    const merchants = new IndexedDbMerchantRepository(database);
    const rules = new IndexedDbRuleRepository(database);

    const now = parseUtcTimestamp("2026-07-20T12:00:00.000Z");

    const merchantId = parseMerchantId("019829f0-4da4-7ae0-8a9c-383af22d7d01");
    await merchants.save({
      id: merchantId,
      name: "Tim Hortons",
      aliases: [
        {
          id: parseAliasId("019829f0-4da4-7ae0-8a9c-383af22d7d02"),
          pattern: "tim hortons",
          matchMode: "tokenPrefix",
          normalizerVersion: "1.0.0",
          createdAt: now,
        },
      ],
      archived: false,
      createdAt: now,
      updatedAt: now,
    });

    const ruleId = parseRuleId("019829f0-4da4-7ae0-8a9c-383af22d7d03");
    await rules.save({
      id: ruleId,
      schemaVersion: "1.0.0",
      name: "Tim Hortons Categorization",
      enabled: true,
      priority: 10,
      conditions: [
        { field: "normalizedDescription", operator: "startsWith", value: "tim hortons" },
      ],
      actions: [{ type: "setMerchant", value: merchantId }],
      createdBy: "user",
      createdAt: now,
      updatedAt: now,
    });

    database.close();

    const reopened = new FinancialDatabase(database.name);
    databases.push(reopened);

    const loadedMerchants = await new IndexedDbMerchantRepository(reopened).list();
    expect(loadedMerchants).toHaveLength(1);
    expect(loadedMerchants[0]?.name).toBe("Tim Hortons");

    const loadedRules = await new IndexedDbRuleRepository(reopened).list();
    expect(loadedRules).toHaveLength(1);
    expect(loadedRules[0]?.name).toBe("Tim Hortons Categorization");
  });
});

describe("IndexedDbWorkspaceBackupRepository", () => {
  it("captures one workspace consistently without mutating IndexedDB", async () => {
    const database = new FinancialDatabase(`test-${crypto.randomUUID()}`);
    databases.push(database);
    const workspaces = new IndexedDbWorkspaceRepository(database);
    const accounts = new IndexedDbAccountRepository(database);
    const now = parseUtcTimestamp("2026-07-20T12:00:00.000Z");
    const target = createWorkspace({
      id: parseWorkspaceId("019829f0-4da4-7ae0-8a9c-383af22d7da1"),
      name: "Target",
      now,
    });
    const other = createWorkspace({
      id: parseWorkspaceId("019829f0-4da4-7ae0-8a9c-383af22d7da2"),
      name: "Other",
      now,
    });
    await workspaces.save(target);
    await workspaces.save(other);
    await accounts.save(
      createAccount({
        id: parseAccountId("019829f0-4da4-7ae0-8a9c-383af22d7db1"),
        workspaceId: target.id,
        name: "Chequing",
        type: "checking",
        currency: "CAD",
        now,
      }),
    );
    await accounts.save(
      createAccount({
        id: parseAccountId("019829f0-4da4-7ae0-8a9c-383af22d7db2"),
        workspaceId: other.id,
        name: "Excluded",
        type: "checking",
        currency: "CAD",
        now,
      }),
    );
    const before = await Promise.all([
      database.workspaces.count(),
      database.accounts.count(),
      database.transactions.count(),
    ]);

    const snapshot = await new IndexedDbWorkspaceBackupRepository(database).readSnapshot(
      target.id,
      "2026-07-20T13:00:00.000Z",
    );

    expect(snapshot.workspace).toEqual(target);
    expect(snapshot.accounts.map((account) => account.name)).toEqual(["Chequing"]);
    expect(snapshot.exportedAt).toBe("2026-07-20T13:00:00.000Z");
    expect(
      await Promise.all([
        database.workspaces.count(),
        database.accounts.count(),
        database.transactions.count(),
      ]),
    ).toEqual(before);
  });
});

describe("IndexedDbTransactionLedgerRepository", () => {
  it("applies and atomically undoes canonical bulk edits", async () => {
    const database = new FinancialDatabase(`test-${crypto.randomUUID()}`);
    databases.push(database);
    const fixture = await setupCommit(database);
    await fixture.commit.execute(command());
    const repository = new IndexedDbTransactionLedgerRepository(database);
    const transaction = (await repository.list())[0]!;
    const categoryId = STARTER_CATEGORY_DEFINITIONS[2]!.id;
    const ids = ["018f6b80-0d62-7d2c-9a5c-7f5f59cda2fa"];
    const apply = new ApplyBulkTransactionEdit(
      repository,
      { now: () => new Date("2026-07-19T18:00:00.000Z") },
      { generate: () => ids.shift()! },
    );
    const operation = await apply.execute([transaction.id], {
      category: categoryId,
      reviewState: "reviewed",
      notes: "Confirmed locally",
      tags: ["household"],
    });

    expect((await repository.list())[0]).toMatchObject({
      categoryId,
      reviewState: "reviewed",
      notes: "Confirmed locally",
      tags: ["household"],
    });
    expect((await repository.list())[0]?.classifications.category?.locked).toBe(true);
    expect(await repository.listOperationsForTransaction(transaction.id)).toMatchObject([
      { id: operation.id },
    ]);
    await new UndoBulkTransactionEdit(repository, {
      now: () => new Date("2026-07-19T19:00:00.000Z"),
    }).execute(operation.id);
    expect((await repository.list())[0]).toMatchObject({
      reviewState: "unreviewed",
      tags: [],
    });
    expect((await repository.list())[0]?.categoryId).toBeUndefined();
    expect((await repository.findOperation(operation.id))?.undoneAt).toBe(
      "2026-07-19T19:00:00.000Z",
    );
    expect(await repository.listOperationsForTransaction(transaction.id)).toMatchObject([
      { id: operation.id, undoneAt: "2026-07-19T19:00:00.000Z" },
    ]);
  });
});

describe("IndexedDbDuplicateResolutionRepository", () => {
  it("persists duplicate decisions, applies exclusion, and reverses without losing provenance", async () => {
    const database = new FinancialDatabase(`test-${crypto.randomUUID()}`);
    databases.push(database);
    const fixture = await setupCommit(database);
    await fixture.commit.execute(command());
    const next = createCommitUseCase(
      new IndexedDbImportCommitRepository(database),
      fixture.accounts,
      fixture.workspaces,
      ["018f6b80-0d62-7d2c-9a5c-7f5f59cda2f5", "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f6"],
    );
    await next.execute(
      command({
        sources: [{ ...source(), sha256: "b".repeat(64) }],
        candidates: [
          {
            ...candidate(),
            provenance: { ...candidate().provenance, sourceFileSha256: "b".repeat(64) },
          },
        ],
      }),
    );
    const ledger = new IndexedDbTransactionLedgerRepository(database);
    const [existing, incoming] = await ledger.list();
    const fingerprints = await ledger.listFingerprintsByAccount(fixture.account.id);
    const duplicate = detectDuplicateCandidates({
      existing: [existing!],
      incoming: [incoming!],
      fingerprints,
    })[0]!;
    const repository = new IndexedDbDuplicateResolutionRepository(database);
    const ids = ["018f6b80-0d62-7d2c-9a5c-7f5f59cda2fb", "018f6b80-0d62-7d2c-9a5c-7f5f59cda2fc"];
    const decision = await new ResolveDuplicate(
      repository,
      { now: () => new Date("2026-07-19T20:00:00.000Z") },
      { generate: () => ids.shift()! },
    ).execute({
      candidateId: duplicate.id,
      evidenceSignature: duplicateEvidenceSignature(duplicate),
      action: "keep-existing",
    });

    expect((await ledger.list()).find((value) => value.id === incoming?.id)?.status).toBe("void");
    expect((await ledger.list()).find((value) => value.id === incoming?.id)?.provenance).toEqual(
      incoming?.provenance,
    );
    await new UndoDuplicateResolution(
      repository,
      { now: () => new Date("2026-07-19T21:00:00.000Z") },
      { generate: () => ids.shift()! },
    ).execute(decision.id);
    expect((await ledger.list()).find((value) => value.id === incoming?.id)?.status).toBe("posted");
    expect((await repository.load()).events).toHaveLength(2);
  });
});

describe("IndexedDbWorkspaceRepository", () => {
  it("persists and reloads workspaces", async () => {
    const database = new FinancialDatabase(`test-${crypto.randomUUID()}`);
    databases.push(database);
    const repository = new IndexedDbWorkspaceRepository(database);
    const workspace = createWorkspace({
      id: parseWorkspaceId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f1"),
      name: "Household",
      now: parseUtcTimestamp("2026-07-19T16:00:00.000Z"),
    });

    await repository.save(workspace);

    expect(await repository.list()).toEqual([workspace]);
  });
});

describe("IndexedDbAccountRepository", () => {
  it("persists, reloads, lists, and deletes workspace accounts", async () => {
    const name = `test-${crypto.randomUUID()}`;
    const database = new FinancialDatabase(name);
    databases.push(database);
    const repository = new IndexedDbAccountRepository(database);
    const account = createAccount({
      id: parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2"),
      workspaceId: parseWorkspaceId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f1"),
      name: "Everyday",
      type: "checking",
      currency: "CAD",
      now: parseUtcTimestamp("2026-07-19T16:00:00.000Z"),
    });

    await repository.save(account);
    database.close();

    const reopened = new FinancialDatabase(name);
    const reloadedRepository = new IndexedDbAccountRepository(reopened);
    expect(await reloadedRepository.listByWorkspace(account.workspaceId)).toEqual([account]);
    expect(await reloadedRepository.findById(account.id)).toEqual(account);
    expect(await reloadedRepository.hasReferences(account.id)).toBe(false);

    expect(await reloadedRepository.deleteIfUnreferenced(account.id)).toBe(true);
    expect(await reloadedRepository.findById(account.id)).toBeUndefined();
    reopened.close();
  });
});

describe("IndexedDbImportCommitRepository", () => {
  it("commits imports, transactions, fingerprints, and revision atomically and reloads them", async () => {
    const name = `test-${crypto.randomUUID()}`;
    const database = new FinancialDatabase(name);
    databases.push(database);
    const fixture = await setupCommit(database);

    const result = await fixture.commit.execute(command());
    expect(result).toMatchObject({ transactionCount: 1, committedRevision: 2 });
    expect(await database.transactionFingerprints.count()).toBe(1);
    expect((await database.workspaces.get(fixture.workspace.id))?.revision).toBe(2);
    expect(await fixture.accounts.hasReferences(fixture.account.id)).toBe(true);
    expect(await fixture.accounts.deleteIfUnreferenced(fixture.account.id)).toBe(false);
    expect(JSON.stringify(await database.imports.toArray())).not.toContain("bytes");

    database.close();
    const reopened = new FinancialDatabase(name);
    const repository = new IndexedDbImportCommitRepository(reopened);
    expect(await repository.listImportsByAccount(fixture.account.id)).toHaveLength(1);
    const transactions = await repository.listTransactionsByAccount(fixture.account.id);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.money.toJSON()).toEqual({ amount: "-4.25", currency: "CAD" });
    expect(transactions[0]?.provenance.original).toMatchObject({ amount: "-$4.25" });
    reopened.close();
  });

  it.each([
    "after-imports",
    "after-transactions",
    "after-fingerprints",
    "before-revision",
  ] as const)(
    "rolls back every canonical store when %s fails with quota exhaustion",
    async (stage) => {
      const database = new FinancialDatabase(`test-${crypto.randomUUID()}`);
      databases.push(database);
      const fixture = await setupCommit(database, {
        atStage: (current) => {
          if (current === stage) throw new DOMException("synthetic quota", "QuotaExceededError");
        },
      });

      await expect(fixture.commit.execute(command())).rejects.toMatchObject({
        code: "QUOTA_EXCEEDED",
      });
      expect(await database.imports.count()).toBe(0);
      expect(await database.transactions.count()).toBe(0);
      expect(await database.transactionFingerprints.count()).toBe(0);
      expect((await database.workspaces.get(fixture.workspace.id))?.revision).toBe(1);
    },
  );

  it("rolls back when cancellation arrives during the write transaction", async () => {
    const database = new FinancialDatabase(`test-${crypto.randomUUID()}`);
    databases.push(database);
    const signal = { aborted: false };
    const fixture = await setupCommit(database, {
      atStage: (stage) => {
        if (stage === "after-imports") signal.aborted = true;
      },
    });
    await expect(fixture.commit.execute(command({ signal }))).rejects.toBeDefined();
    expect(await database.imports.count()).toBe(0);
    expect(await database.transactions.count()).toBe(0);
    expect((await database.workspaces.get(fixture.workspace.id))?.revision).toBe(1);
  });

  it("retains repeated source IDs so duplicate evidence can be reviewed without data loss", async () => {
    const database = new FinancialDatabase(`test-${crypto.randomUUID()}`);
    databases.push(database);
    const fixture = await setupCommit(database);
    await fixture.commit.execute(command());
    const next = createCommitUseCase(
      new IndexedDbImportCommitRepository(database),
      fixture.accounts,
      fixture.workspaces,
      ["018f6b80-0d62-7d2c-9a5c-7f5f59cda2f5", "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f6"],
    );
    await next.execute(
      command({
        sources: [{ ...source(), sha256: "b".repeat(64) }],
        candidates: [
          {
            ...candidate(),
            provenance: { ...candidate().provenance, sourceFileSha256: "b".repeat(64) },
          },
        ],
      }),
    );
    expect(await database.imports.count()).toBe(2);
    expect(await database.transactions.count()).toBe(2);
    expect(await database.transactionFingerprints.count()).toBe(2);
    expect((await database.workspaces.get(fixture.workspace.id))?.revision).toBe(3);
  });

  it("deletes and rebuilds the derived fingerprint projection", async () => {
    const database = new FinancialDatabase(`test-${crypto.randomUUID()}`);
    databases.push(database);
    const fixture = await setupCommit(database);
    const result = await fixture.commit.execute(command());
    const repository = new IndexedDbImportCommitRepository(database);
    await repository.deleteFingerprintsByImport(result.imports[0]!.id);
    expect(await database.transactionFingerprints.count()).toBe(0);
    expect(await new RebuildTransactionFingerprints(repository, digest).execute()).toBe(1);
    expect(await database.transactionFingerprints.count()).toBe(1);
  });
});

async function setupCommit(
  database: FinancialDatabase,
  hooks: ConstructorParameters<typeof IndexedDbImportCommitRepository>[1] = {},
) {
  const workspace = createWorkspace({
    id: parseWorkspaceId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f1"),
    name: "Household",
    now: parseUtcTimestamp("2026-07-19T16:00:00.000Z"),
  });
  const account = createAccount({
    id: parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2"),
    workspaceId: workspace.id,
    name: "Everyday",
    type: "checking",
    currency: "CAD",
    now: parseUtcTimestamp("2026-07-19T16:00:00.000Z"),
  });
  const workspaces = new IndexedDbWorkspaceRepository(database);
  const accounts = new IndexedDbAccountRepository(database);
  await workspaces.save(workspace);
  await accounts.save(account);
  const repository = new IndexedDbImportCommitRepository(database, hooks);
  return {
    workspace,
    account,
    workspaces,
    accounts,
    commit: createCommitUseCase(repository, accounts, workspaces, [
      "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f3",
      "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f4",
    ]),
  };
}

function createCommitUseCase(
  repository: IndexedDbImportCommitRepository,
  accounts: IndexedDbAccountRepository,
  workspaces: IndexedDbWorkspaceRepository,
  values: string[],
) {
  return new CommitAcceptedImport(
    repository,
    accounts,
    workspaces,
    { now: () => new Date("2026-07-19T17:00:00.000Z") },
    { generate: () => values.shift() ?? "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f7" },
    digest,
  );
}

const digest = {
  digest: async (value: string) => value.length.toString(16).padStart(64, "0"),
};

function source() {
  return {
    fileName: "statement.csv",
    mediaType: "text/csv",
    byteSize: 100,
    sha256: "a".repeat(64),
    parserId: "financial-intelligence/csv",
    parserVersion: "1.0.0",
    sourceRows: 1,
    issues: [],
  } as const;
}

function candidate() {
  return {
    accountId: "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2",
    postedDate: "2026-07-19",
    description: "Coffee",
    amount: "-4.25",
    currency: "CAD",
    sourceTransactionId: "bank-1",
    provenance: {
      sourceFileSha256: "a".repeat(64),
      sourceLocation: "line:2",
      parserId: "financial-intelligence/csv",
      parserVersion: "1.0.0",
      mappingVersion: "1.0.0",
      original: { postedDate: "2026-07-19", description: "Coffee", amount: "-$4.25" },
    },
  } as const;
}

function command(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f1",
    accountId: "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2",
    sources: [source()],
    candidates: [candidate()],
    mapping: { dateFormat: "YYYY-MM-DD", amountDirection: "positive-inflow" },
    ...overrides,
  };
}
