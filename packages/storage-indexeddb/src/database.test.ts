import "fake-indexeddb/auto";

import {
  createWorkspace,
  parseUtcTimestamp,
  parseWorkspaceId,
} from "@financial-intelligence/domain";
import { afterEach, describe, expect, it } from "vitest";

import { FinancialDatabase, IndexedDbWorkspaceRepository } from "./database";

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
