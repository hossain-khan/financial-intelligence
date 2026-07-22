import "fake-indexeddb/auto";

import type { PersistedSuggestion } from "@financial-intelligence/application";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import { FinancialDatabase, IndexedDbAiSuggestionRepository } from "./database";

const names = new Set<string>();
afterEach(async () => {
  await Promise.all([...names].map((n) => Dexie.delete(n)));
  names.clear();
});

function dbName(): string {
  const name = `ai-suggestion-${crypto.randomUUID()}`;
  names.add(name);
  return name;
}

function suggestion(over: Partial<PersistedSuggestion> = {}): PersistedSuggestion {
  return {
    id: crypto.randomUUID(),
    targetTransactionId: "018f6b80-0d62-7d2c-9a5c-7f5f59cda301",
    targetUpdatedAt: "2026-07-20T00:00:00.000Z",
    normalizedDigest: "unknown coffee shop",
    task: "category.classify.v1",
    taskVersion: "1.0.0",
    schemaVersion: "1.0.0",
    promptVersion: "1.0.0",
    minimizerVersion: "1.0.0",
    classifierVersion: "1.0.0",
    proposal: { kind: "category", categoryId: "018f6b80-0d62-7d2c-9a5c-7f5f59cda401" },
    confidence: 0.9,
    evidenceCodes: ["model_category_candidate"],
    rationale: "",
    provider: { profileId: "p", adapterId: "ai-local", reportedModel: "m", executionLocation: "local" },
    requestAuditId: "audit-1",
    status: "pending",
    createdAt: "2026-07-20T00:00:00.000Z",
    expiresAt: "2026-07-21T00:00:00.000Z",
    ...over,
  };
}

describe("IndexedDbAiSuggestionRepository", () => {
  it("saves, lists pending, and finds by id", async () => {
    const repo = new IndexedDbAiSuggestionRepository(new FinancialDatabase(dbName()));
    const pending = suggestion();
    const accepted = suggestion({ status: "accepted" });
    await repo.save(pending);
    await repo.save(accepted);

    expect(await repo.listPending()).toEqual([pending]);
    expect(await repo.findById(pending.id)).toEqual(pending);
    expect(await repo.findById("missing")).toBeUndefined();
  });

  it("updates status without touching the rest of the record", async () => {
    const repo = new IndexedDbAiSuggestionRepository(new FinancialDatabase(dbName()));
    const s = suggestion();
    await repo.save(s);

    await repo.setStatus(s.id, "rejected");
    expect(await repo.findById(s.id)).toEqual({ ...s, status: "rejected" });
    // Setting the status of a missing id is a no-op, not an error.
    await expect(repo.setStatus("missing", "stale")).resolves.toBeUndefined();
  });

  it("reconstructs rejection keys only from rejected records", async () => {
    const repo = new IndexedDbAiSuggestionRepository(new FinancialDatabase(dbName()));
    await repo.save(suggestion({ status: "pending" }));
    await repo.save(
      suggestion({ status: "rejected", normalizedDigest: "tim hortons", classifierVersion: "1.0.0" }),
    );

    expect(await repo.listRejectedKeys()).toEqual(["tim hortons::1.0.0"]);
  });
});
