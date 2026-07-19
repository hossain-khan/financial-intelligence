import "fake-indexeddb/auto";

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
