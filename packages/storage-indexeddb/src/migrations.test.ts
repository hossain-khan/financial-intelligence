import "fake-indexeddb/auto";

import {
  createWorkspace,
  parseUtcTimestamp,
  parseWorkspaceId,
  type Workspace,
} from "@financial-intelligence/domain";
import Dexie from "dexie";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinancialDatabase, openFinancialDatabase } from "./database";
import { CURRENT_DATABASE_VERSION, DATABASE_MIGRATIONS } from "./migrations";
import {
  createVersionOneFixture,
  openUncoordinatedConnection,
  VERSION_ONE_MIGRATION,
} from "./test-helpers";

const names = new Set<string>();

afterEach(async () => {
  await Promise.all([...names].map((name) => Dexie.delete(name)));
  names.clear();
});

describe("database migrations", () => {
  it("keeps a contiguous registry with one source of truth", () => {
    expect(DATABASE_MIGRATIONS.map(({ version }) => version)).toEqual([1, 2, 3]);
    expect(CURRENT_DATABASE_VERSION).toBe(3);
  });

  it("rejects a migration registry with a missing prior version", () => {
    expect(() => new FinancialDatabase(databaseName(), [DATABASE_MIGRATIONS[1]!])).toThrow(
      /contiguous/,
    );
  });

  it("upgrades a v1 fixture, preserves canonical records, and reopens idempotently", async () => {
    const name = databaseName();
    const workspace = fixtureWorkspace();
    await createVersionOneFixture(name, [workspace]);

    const upgraded = await openFinancialDatabase(new FinancialDatabase(name));
    expect(await upgraded.workspaces.toArray()).toEqual([workspace]);
    expect(upgraded.verno).toBe(CURRENT_DATABASE_VERSION);
    expect(upgraded.tables.map(({ name: tableName }) => tableName).sort()).toEqual([
      "accounts",
      "migrationJournal",
      "workspaces",
    ]);
    upgraded.close();

    const reopened = await openFinancialDatabase(new FinancialDatabase(name));
    expect(await reopened.workspaces.toArray()).toEqual([workspace]);
    reopened.close();
  });

  it("aborts a failed native upgrade and preserves the v1 canonical state", async () => {
    const name = databaseName();
    const workspace = fixtureWorkspace();
    await createVersionOneFixture(name, [workspace]);
    const failingMigrations = [
      VERSION_ONE_MIGRATION,
      {
        ...DATABASE_MIGRATIONS[1]!,
        upgrade: () => {
          throw new Error("synthetic migration failure");
        },
      },
    ];

    await expect(
      openFinancialDatabase(new FinancialDatabase(name, failingMigrations)),
    ).rejects.toMatchObject({ code: "MIGRATION_FAILED" });

    const recovered = await openFinancialDatabase(new FinancialDatabase(name));
    expect(await recovered.workspaces.toArray()).toEqual([workspace]);
    recovered.close();
  });

  it("closes a coordinated stale connection during a version change", async () => {
    const name = databaseName();
    await createVersionOneFixture(name, [fixtureWorkspace()]);
    const onStaleConnection = vi.fn();
    const stale = await openFinancialDatabase(
      new FinancialDatabase(name, [VERSION_ONE_MIGRATION], onStaleConnection),
    );

    const current = await openFinancialDatabase(new FinancialDatabase(name));

    expect(onStaleConnection).toHaveBeenCalledOnce();
    expect(stale.isOpen()).toBe(false);
    current.close();
  });

  it("rejects an incompatible downgrade without changing current data", async () => {
    const name = databaseName();
    const workspace = fixtureWorkspace();
    const current = await openFinancialDatabase(new FinancialDatabase(name));
    await current.workspaces.put(workspace);
    current.close();

    await expect(
      openFinancialDatabase(new FinancialDatabase(name, [VERSION_ONE_MIGRATION])),
    ).rejects.toMatchObject({ code: "VERSION_INCOMPATIBLE" });

    const reopened = await openFinancialDatabase(new FinancialDatabase(name));
    expect(await reopened.workspaces.toArray()).toEqual([workspace]);
    reopened.close();
  });

  it("returns an actionable error when an uncoordinated tab blocks an upgrade", async () => {
    const name = databaseName();
    await createVersionOneFixture(name, [fixtureWorkspace()]);
    const uncoordinated = await openUncoordinatedConnection(name);
    const onBlocked = vi.fn();
    const current = new FinancialDatabase(name);

    await expect(
      openFinancialDatabase(current, { blockedTimeoutMs: 0, onBlocked }),
    ).rejects.toMatchObject({ code: "UPGRADE_BLOCKED" });
    expect(onBlocked).toHaveBeenCalledOnce();

    uncoordinated.close();
    current.close();
  });
});

function databaseName(): string {
  const name = `migration-test-${crypto.randomUUID()}`;
  names.add(name);
  return name;
}

function fixtureWorkspace(): Workspace {
  return createWorkspace({
    id: parseWorkspaceId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f1"),
    name: "Migration fixture",
    now: parseUtcTimestamp("2026-07-19T16:00:00.000Z"),
  });
}
