import "fake-indexeddb/auto";

import {
  Money,
  createTransaction,
  createWorkspace,
  parseAccountId,
  parseDateOnly,
  parseImportId,
  parseTransactionId,
  parseUtcTimestamp,
  parseWorkspaceId,
  transactionToCanonical,
  type Workspace,
} from "@financial-intelligence/domain";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import { FinancialDatabase, openFinancialDatabase } from "./database";
import { CURRENT_DATABASE_VERSION, DATABASE_MIGRATIONS } from "./migrations";

const names = new Set<string>();

afterEach(async () => {
  await Promise.all([...names].map((name) => Dexie.delete(name)));
  names.clear();
});

function databaseName(): string {
  const name = `compat-${crypto.randomUUID()}`;
  names.add(name);
  return name;
}

function workspace(): Workspace {
  return createWorkspace({
    id: parseWorkspaceId("018f6b80-0d62-7d2c-9a5c-7f5f59cda801"),
    name: "Compat",
    now: parseUtcTimestamp("2026-01-02T00:00:00.000Z"),
  });
}

function transactionForVersion() {
  return createTransaction({
    id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda804"),
    accountId: parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda802"),
    importId: parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda803"),
    postedDate: parseDateOnly("2026-01-01"),
    money: Money.from("-9.99", "CAD"),
    description: "Compat merchant",
    provenance: {
      parserId: "financial-intelligence/csv",
      parserVersion: "1.0.0",
      sourceLocation: "line:2",
      original: {},
      transformations: [],
    },
    now: parseUtcTimestamp("2026-01-02T00:00:00.000Z"),
  });
}

describe("IndexedDB version matrix", () => {
  // Every supported schema version must upgrade cleanly to the current version and preserve its
  // canonical workspace. Historical versions are materialised by slicing the immutable registry —
  // never by hand-writing an old schema, and never only against freshly-seeded current data.
  it.each(Array.from({ length: CURRENT_DATABASE_VERSION }, (_, index) => index + 1))(
    "upgrades a v%i database to the current version without losing the workspace",
    async (version) => {
      const name = databaseName();
      const priorMigrations = DATABASE_MIGRATIONS.slice(0, version);
      const prior = await openFinancialDatabase(new FinancialDatabase(name, priorMigrations));
      expect(prior.verno).toBe(version);
      await prior.workspaces.put(workspace());
      prior.close();

      const upgraded = await openFinancialDatabase(new FinancialDatabase(name));
      expect(upgraded.verno).toBe(CURRENT_DATABASE_VERSION);
      expect(await upgraded.workspaces.toArray()).toEqual([workspace()]);
      upgraded.close();

      // Reopening is idempotent (no repeated upgrade side effects).
      const reopened = await openFinancialDatabase(new FinancialDatabase(name));
      expect(reopened.verno).toBe(CURRENT_DATABASE_VERSION);
      reopened.close();
    },
  );

  it("preserves transactions written at v4 through the reviewable-ledger upgrade", async () => {
    const name = databaseName();
    const versionFour = await openFinancialDatabase(
      new FinancialDatabase(name, DATABASE_MIGRATIONS.slice(0, 4)),
    );
    const canonical = transactionToCanonical(transactionForVersion());
    await versionFour.transactions.put(canonical);
    versionFour.close();

    const upgraded = await openFinancialDatabase(new FinancialDatabase(name));
    expect(await upgraded.transactions.toArray()).toEqual([canonical]);
    upgraded.close();
  });

  it("fails closed when the on-disk database is newer than this build", async () => {
    const name = databaseName();
    const current = await openFinancialDatabase(new FinancialDatabase(name));
    await current.workspaces.put(workspace());
    current.close();

    // Simulate a future build by opening with only the first migration (older declared version).
    await expect(
      openFinancialDatabase(new FinancialDatabase(name, DATABASE_MIGRATIONS.slice(0, 1))),
    ).rejects.toMatchObject({ code: "VERSION_INCOMPATIBLE" });

    // The newer database and its data remain intact and reopenable by the current build.
    const reopened = await openFinancialDatabase(new FinancialDatabase(name));
    expect(await reopened.workspaces.toArray()).toEqual([workspace()]);
    reopened.close();
  });

  it("aborts a mid-upgrade failure and preserves the prior valid state", async () => {
    const name = databaseName();
    const versionEight = await openFinancialDatabase(
      new FinancialDatabase(name, DATABASE_MIGRATIONS.slice(0, 8)),
    );
    await versionEight.workspaces.put(workspace());
    versionEight.close();

    const failingToCurrent = [
      ...DATABASE_MIGRATIONS.slice(0, 8),
      {
        ...DATABASE_MIGRATIONS[8]!,
        upgrade: () => {
          throw new Error("synthetic v9 failure");
        },
      },
    ];
    await expect(
      openFinancialDatabase(new FinancialDatabase(name, failingToCurrent)),
    ).rejects.toMatchObject({ code: "MIGRATION_FAILED" });

    // Either the old valid state or the new valid state — never a mixture. Here the old state stands.
    const recovered = await openFinancialDatabase(
      new FinancialDatabase(name, DATABASE_MIGRATIONS.slice(0, 8)),
    );
    expect(await recovered.workspaces.toArray()).toEqual([workspace()]);
    expect(recovered.verno).toBe(8);
    recovered.close();
  });
});
