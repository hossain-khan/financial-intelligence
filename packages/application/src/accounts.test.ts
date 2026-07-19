import type { Account, AccountId, WorkspaceId } from "@financial-intelligence/domain";
import { describe, expect, it } from "vitest";

import {
  AccountDeletionBlockedError,
  ChangeAccountCurrency,
  CreateAccount,
  ListAccounts,
  RenameAccount,
  RequestAccountDeletion,
  SetAccountArchived,
  type AccountRepository,
} from "./accounts";

class MemoryAccountRepository implements AccountRepository {
  readonly accounts = new Map<AccountId, Account>();
  readonly referenced = new Set<AccountId>();

  async listByWorkspace(workspaceId: WorkspaceId): Promise<readonly Account[]> {
    return [...this.accounts.values()].filter((account) => account.workspaceId === workspaceId);
  }
  async findById(id: AccountId): Promise<Account | undefined> {
    return this.accounts.get(id);
  }
  async save(account: Account): Promise<void> {
    this.accounts.set(account.id, account);
  }
  async hasReferences(id: AccountId): Promise<boolean> {
    return this.referenced.has(id);
  }
  async deleteIfUnreferenced(id: AccountId): Promise<boolean> {
    if (this.referenced.has(id)) {
      return false;
    }
    this.accounts.delete(id);
    return true;
  }
}

const workspaceId = "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f1";
const accountId = "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2";
const clock = { now: () => new Date("2026-07-19T16:00:00.000Z") };
const ids = { generate: () => accountId };

async function create(repository: MemoryAccountRepository) {
  return new CreateAccount(repository, clock, ids).execute({
    workspaceId,
    name: "Everyday",
    type: "checking",
    currency: "CAD",
    maskedIdentifier: "•••• 1234",
  });
}

describe("account use cases", () => {
  it("creates, lists, renames, and archives through the repository port", async () => {
    const repository = new MemoryAccountRepository();
    const account = await create(repository);

    expect(await new ListAccounts(repository).execute(workspaceId)).toEqual([account]);
    expect((await new RenameAccount(repository, clock).execute(accountId, "Bills")).name).toBe(
      "Bills",
    );
    expect(
      (await new SetAccountArchived(repository, clock).execute(accountId, true)).archived,
    ).toBe(true);
  });

  it("blocks currency changes and deletion when references exist", async () => {
    const repository = new MemoryAccountRepository();
    const account = await create(repository);
    repository.referenced.add(account.id);

    await expect(
      new ChangeAccountCurrency(repository, clock).execute(accountId, "USD"),
    ).rejects.toThrow(/currency cannot be changed/i);
    await expect(new RequestAccountDeletion(repository).execute(accountId)).rejects.toThrow(
      AccountDeletionBlockedError,
    );
    expect(repository.accounts.has(account.id)).toBe(true);
  });

  it("deletes an unreferenced account", async () => {
    const repository = new MemoryAccountRepository();
    await create(repository);
    await new RequestAccountDeletion(repository).execute(accountId);
    expect(repository.accounts.size).toBe(0);
  });
});
