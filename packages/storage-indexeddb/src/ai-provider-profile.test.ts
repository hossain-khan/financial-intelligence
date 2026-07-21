import "fake-indexeddb/auto";

import type { AIProviderProfile } from "@financial-intelligence/schemas";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import { FinancialDatabase, IndexedDbAiProviderProfileRepository } from "./database";

const names = new Set<string>();
afterEach(async () => {
  await Promise.all([...names].map((n) => Dexie.delete(n)));
  names.clear();
});

function dbName(): string {
  const name = `ai-${crypto.randomUUID()}`;
  names.add(name);
  return name;
}

function profile(): AIProviderProfile {
  return {
    schemaVersion: "1.0.0",
    id: crypto.randomUUID(),
    name: "No AI",
    kind: "none",
    enabled: false,
    tasks: [],
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
  };
}

describe("IndexedDbAiProviderProfileRepository", () => {
  it("saves and reads back the active profile", async () => {
    const repo = new IndexedDbAiProviderProfileRepository(new FinancialDatabase(dbName()));
    expect(await repo.findActive()).toBeUndefined();
    const p = profile();
    await repo.save(p);
    expect(await repo.findActive()).toEqual(p);
  });
});
