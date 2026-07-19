import "fake-indexeddb/auto";

import {
  CommitAcceptedImport,
  RebuildTransactionFingerprints,
} from "@financial-intelligence/application";
import {
  createAccount,
  createWorkspace,
  parseAccountId,
  parseUtcTimestamp,
  parseWorkspaceId,
} from "@financial-intelligence/domain";
import { afterEach, describe, expect, it } from "vitest";

import {
  FinancialDatabase,
  IndexedDbAccountRepository,
  IndexedDbImportCommitRepository,
  IndexedDbWorkspaceRepository,
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

  it("rejects a source ID already committed to the account without partial writes", async () => {
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
    await expect(
      next.execute(
        command({
          sources: [{ ...source(), sha256: "b".repeat(64) }],
          candidates: [
            {
              ...candidate(),
              provenance: { ...candidate().provenance, sourceFileSha256: "b".repeat(64) },
            },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: "DUPLICATE_SOURCE_ID" });
    expect(await database.imports.count()).toBe(1);
    expect(await database.transactions.count()).toBe(1);
    expect((await database.workspaces.get(fixture.workspace.id))?.revision).toBe(2);
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
