import { describe, expect, it } from "vitest";

import {
  Money,
  createTransaction,
  parseAccountId,
  parseDateOnly,
  parseImportId,
  parseTransactionId,
  parseUtcTimestamp,
  type DuplicateResolutionEvent,
  type Transaction,
} from "@financial-intelligence/domain";
import {
  FindDuplicateCandidates,
  ListDuplicateResolutions,
  ResolveDuplicate,
  UndoDuplicateResolution,
  type DuplicateResolutionJournal,
  type DuplicateResolutionRepository,
} from "./duplicate-review";

const accountId = parseAccountId("00000000-0000-4000-8000-000000000001");
const now = parseUtcTimestamp("2026-07-19T12:00:00Z");

function transaction(id: string): Transaction {
  return createTransaction({
    id: parseTransactionId(id),
    accountId,
    importId: parseImportId("10000000-0000-4000-8000-000000000001"),
    postedDate: parseDateOnly("2026-07-19"),
    money: Money.from("-4.25", "CAD"),
    description: "Coffee Shop",
    provenance: {
      parserId: "csv",
      parserVersion: "1",
      sourceLocation: "row:1",
      original: {},
      transformations: [],
    },
    now,
  });
}

class MemoryRepository implements DuplicateResolutionRepository {
  public journal: DuplicateResolutionJournal = { version: 0, events: [] };

  public async load(): Promise<DuplicateResolutionJournal> {
    return this.journal;
  }

  public async append(
    expectedVersion: number,
    event: DuplicateResolutionEvent,
  ): Promise<DuplicateResolutionJournal> {
    if (expectedVersion !== this.journal.version) throw new Error("concurrent modification");
    this.journal = {
      version: this.journal.version + 1,
      events: [...this.journal.events, event],
    };
    return this.journal;
  }
}

const clock = { now: () => new Date("2026-07-19T12:00:00.000Z") };

describe("duplicate resolution use cases", () => {
  it("queries account-scoped persisted transactions and fingerprints before matching", async () => {
    const existing = transaction("20000000-0000-4000-8000-000000000001");
    const incoming = transaction("20000000-0000-4000-8000-000000000002");
    const seen: string[] = [];
    const useCase = new FindDuplicateCandidates({
      listTransactionsByAccount: async (queriedAccountId) => {
        seen.push(queriedAccountId);
        return [existing];
      },
      listFingerprintsByAccount: async (queriedAccountId) => {
        seen.push(queriedAccountId);
        return [];
      },
    });
    await expect(useCase.execute(accountId, [incoming])).resolves.toMatchObject([
      { existingTransactionId: existing.id, incomingTransactionId: incoming.id },
    ]);
    expect(seen).toEqual([accountId, accountId]);
  });

  it("records each supported decision with optimistic versioning", async () => {
    const repository = new MemoryRepository();
    let sequence = 0;
    const useCase = new ResolveDuplicate(repository, clock, {
      generate: () => `event-${String(++sequence)}`,
    });
    await expect(
      useCase.execute({ candidateId: "a:b", evidenceSignature: "sig-a", action: "keep-existing" }),
    ).resolves.toMatchObject({
      id: "event-1",
      action: "keep-existing",
      occurredAt: "2026-07-19T12:00:00.000Z",
    });
    await expect(
      useCase.execute({ candidateId: "c:d", evidenceSignature: "sig-c", action: "keep-new" }),
    ).resolves.toMatchObject({
      action: "keep-new",
    });
    await expect(
      useCase.execute({ candidateId: "e:f", evidenceSignature: "sig-e", action: "keep-both" }),
    ).resolves.toMatchObject({
      action: "keep-both",
    });
    await expect(
      useCase.execute({ candidateId: "g:h", evidenceSignature: "sig-g", action: "manual-link" }),
    ).resolves.toMatchObject({ action: "manual-link", evidenceSignature: "sig-g" });
    expect(repository.journal.version).toBe(4);
  });

  it("prevents replacing an active decision without an explicit undo", async () => {
    const repository = new MemoryRepository();
    const useCase = new ResolveDuplicate(repository, clock, { generate: () => "event" });
    await useCase.execute({ candidateId: "a:b", evidenceSignature: "sig", action: "keep-both" });
    await expect(
      useCase.execute({ candidateId: "a:b", evidenceSignature: "sig", action: "keep-new" }),
    ).rejects.toThrow(/already has a decision/u);
  });

  it("undoes an active decision and makes the candidate resolvable again", async () => {
    const repository = new MemoryRepository();
    let sequence = 0;
    const ids = { generate: () => `event-${String(++sequence)}` };
    const resolve = new ResolveDuplicate(repository, clock, ids);
    const undo = new UndoDuplicateResolution(repository, clock, ids);
    const first = await resolve.execute({
      candidateId: "a:b",
      evidenceSignature: "sig",
      action: "keep-existing",
    });
    await expect(undo.execute(first.id)).resolves.toMatchObject({
      type: "undo",
      id: "event-2",
      decisionId: first.id,
    });
    await expect(
      resolve.execute({ candidateId: "a:b", evidenceSignature: "sig", action: "keep-new" }),
    ).resolves.toMatchObject({
      id: "event-3",
    });
    const active = await new ListDuplicateResolutions(repository).execute();
    expect([...active.values()]).toMatchObject([{ id: "event-3", action: "keep-new" }]);
  });

  it("rejects undo for unknown or already-undone decisions", async () => {
    const repository = new MemoryRepository();
    const undo = new UndoDuplicateResolution(repository, clock, { generate: () => "undo" });
    await expect(undo.execute("missing")).rejects.toThrow(/active decision/u);
  });
});
