import {
  createAccount,
  createWorkspace,
  parseAccountId,
  parseUtcTimestamp,
  parseWorkspaceId,
  type Account,
  type AccountId,
  type ImportId,
  type StatementImport,
  type Transaction,
  type Workspace,
  type WorkspaceId,
} from "@financial-intelligence/domain";
import { describe, expect, it, vi } from "vitest";

import type { AccountRepository } from "./accounts";
import {
  CommitAcceptedImport,
  ImportCommitCancelledError,
  ImportCommitValidationError,
  RebuildTransactionFingerprints,
  type AtomicImportCommitPlan,
  type ImportCommitRepository,
  type Sha256Digest,
  type TransactionFingerprint,
} from "./imports";
import type { WorkspaceRepository } from "./workspaces";

const WORKSPACE_ID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f1";
const ACCOUNT_ID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2";
const IMPORT_ID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f3";
const TRANSACTION_ID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f4";

describe("CommitAcceptedImport", () => {
  it("builds and commits a deterministic atomic plan with provenance and revision", async () => {
    const fixture = setup();
    const result = await fixture.useCase.execute(command());

    expect(result).toMatchObject({ transactionCount: 1, committedRevision: 2 });
    expect(fixture.commitRepository.commit).toHaveBeenCalledOnce();
    const plan = fixture.commitRepository.plans[0]!;
    expect(plan.expectedWorkspaceRevision).toBe(1);
    expect(plan.workspace.revision).toBe(2);
    expect(plan.imports[0]).toMatchObject({
      id: IMPORT_ID,
      status: "committed",
      source: { retained: false },
      counts: { sourceRows: 1, valid: 1, committed: 1 },
      committedRevision: 2,
    });
    expect(plan.transactions[0]).toMatchObject({
      id: TRANSACTION_ID,
      importId: IMPORT_ID,
      description: "Coffee",
      provenance: {
        parserId: "financial-intelligence/csv",
        sourceLocation: "line:2",
        transformations: ["mapping:1.0.0"],
      },
    });
    expect(plan.transactions[0]?.money.toJSON()).toEqual({ amount: "-4.25", currency: "CAD" });
    expect(plan.fingerprints[0]).toMatchObject({ transactionId: TRANSACTION_ID, version: 1 });
  });

  it("rejects cancellation, invalid currency, and duplicate source IDs before storage", async () => {
    const cancelled = setup();
    await expect(cancelled.useCase.execute(command({ signal: { aborted: true } }))).rejects.toThrow(
      ImportCommitCancelledError,
    );
    expect(cancelled.commitRepository.commit).not.toHaveBeenCalled();

    const currency = setup();
    await expect(
      currency.useCase.execute(command({ candidates: [{ ...candidate(), currency: "USD" }] })),
    ).rejects.toThrow(/currency/i);
    expect(currency.commitRepository.commit).not.toHaveBeenCalled();

    const duplicate = setup();
    await expect(
      duplicate.useCase.execute(
        command({
          sources: [{ ...source(), sourceRows: 2 }],
          candidates: [candidate(), { ...candidate(), postedDate: "2026-07-20" }],
        }),
      ),
    ).rejects.toThrow(/Duplicate source transaction ID/i);
    expect(duplicate.commitRepository.commit).not.toHaveBeenCalled();
  });

  it("rejects incomplete accepted mappings and error-level sources", async () => {
    const incomplete = setup();
    await expect(
      incomplete.useCase.execute(command({ sources: [{ ...source(), sourceRows: 2 }] })),
    ).rejects.toThrow(/Every source row/i);

    const errored = setup();
    await expect(
      errored.useCase.execute(
        command({
          sources: [
            {
              ...source(),
              issues: [{ code: "BAD_ROW", severity: "error", message: "Bad row" }],
            },
          ],
        }),
      ),
    ).rejects.toThrow(ImportCommitValidationError);
  });
});

describe("RebuildTransactionFingerprints", () => {
  it("replaces the derived projection from canonical transactions", async () => {
    const fixture = setup();
    await fixture.useCase.execute(command());
    const plan = fixture.commitRepository.plans[0]!;
    fixture.commitRepository.transactions = [...plan.transactions];
    const count = await new RebuildTransactionFingerprints(
      fixture.commitRepository,
      digest,
    ).execute();
    expect(count).toBe(1);
    expect(fixture.commitRepository.replacedFingerprints).toHaveLength(1);
  });
});

function setup() {
  const workspace = createWorkspace({
    id: parseWorkspaceId(WORKSPACE_ID),
    name: "Household",
    now: parseUtcTimestamp("2026-07-19T20:00:00.000Z"),
  });
  const account = createAccount({
    id: parseAccountId(ACCOUNT_ID),
    workspaceId: workspace.id,
    name: "Everyday",
    type: "checking",
    currency: "CAD",
    now: parseUtcTimestamp("2026-07-19T20:00:00.000Z"),
  });
  const commitRepository = new MemoryImportCommitRepository();
  const ids = [IMPORT_ID, TRANSACTION_ID];
  const useCase = new CommitAcceptedImport(
    commitRepository,
    new MemoryAccountRepository(account),
    new MemoryWorkspaceRepository(workspace),
    { now: () => new Date("2026-07-19T21:00:00.000Z") },
    { generate: () => ids.shift() ?? TRANSACTION_ID },
    digest,
  );
  return { useCase, commitRepository };
}

const digest: Sha256Digest = {
  digest: async (value) => value.length.toString(16).padStart(64, "0"),
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
    accountId: ACCOUNT_ID,
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
    workspaceId: WORKSPACE_ID,
    accountId: ACCOUNT_ID,
    sources: [source()],
    candidates: [candidate()],
    mapping: { dateFormat: "YYYY-MM-DD", amountDirection: "positive-inflow" },
    ...overrides,
  };
}

class MemoryAccountRepository implements AccountRepository {
  public constructor(private readonly account: Account) {}
  public async listByWorkspace(_workspaceId: WorkspaceId): Promise<readonly Account[]> {
    return [this.account];
  }
  public async findById(id: AccountId): Promise<Account | undefined> {
    return id === this.account.id ? this.account : undefined;
  }
  public async save(_account: Account): Promise<void> {}
  public async hasReferences(_id: AccountId): Promise<boolean> {
    return false;
  }
  public async deleteIfUnreferenced(_id: AccountId): Promise<boolean> {
    return true;
  }
}

class MemoryWorkspaceRepository implements WorkspaceRepository {
  public constructor(private readonly workspace: Workspace) {}
  public async list(): Promise<readonly Workspace[]> {
    return [this.workspace];
  }
  public async findById(id: WorkspaceId): Promise<Workspace | undefined> {
    return id === this.workspace.id ? this.workspace : undefined;
  }
  public async save(_workspace: Workspace): Promise<void> {}
}

class MemoryImportCommitRepository implements ImportCommitRepository {
  readonly plans: AtomicImportCommitPlan[] = [];
  transactions: Transaction[] = [];
  replacedFingerprints: readonly TransactionFingerprint[] = [];
  readonly commit = vi.fn(async (plan: AtomicImportCommitPlan) => {
    this.plans.push(plan);
  });
  public async listImportsByAccount(_accountId: AccountId): Promise<readonly StatementImport[]> {
    return [];
  }
  public async listTransactionsByAccount(_accountId: AccountId): Promise<readonly Transaction[]> {
    return this.transactions;
  }
  public async listAllTransactions(): Promise<readonly Transaction[]> {
    return this.transactions;
  }
  public async replaceAllFingerprints(
    fingerprints: readonly TransactionFingerprint[],
  ): Promise<void> {
    this.replacedFingerprints = fingerprints;
  }
  public async deleteFingerprintsByImport(_importId: ImportId): Promise<void> {}
}
