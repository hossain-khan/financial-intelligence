import { describe, expect, it } from "vitest";

import {
  Money,
  createTransaction,
  parseAccountId,
  parseDateOnly,
  parseImportId,
  parseTransactionId,
  parseUtcTimestamp,
  type RecurringDecisionRecord,
  type Transaction,
} from "@financial-intelligence/domain";

import type { BulkTransactionOperation, TransactionLedgerRepository } from "./transaction-ledger";
import {
  ConfirmRecurringProposalUseCase,
  DismissRecurringProposalUseCase,
  FindRecurringProposalsUseCase,
  MergeRecurringDecisionsUseCase,
  MuteRecurringProposalUseCase,
  ReconcileRecurringDecisionsUseCase,
  SplitRecurringDecisionUseCase,
  type RecurringDecisionRepository,
} from "./recurring";

const NOW = parseUtcTimestamp("2026-07-20T10:00:00Z");
const ACCOUNT_ID = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda111");
const IMPORT_ID = parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda333");

class InMemoryLedgerRepository implements TransactionLedgerRepository {
  private readonly items = new Map<string, Transaction>();
  public constructor(list: readonly Transaction[]) {
    for (const t of list) this.items.set(t.id, t);
  }
  public async list(): Promise<readonly Transaction[]> {
    return Array.from(this.items.values());
  }
  public async listOperationsForTransaction(): Promise<readonly BulkTransactionOperation[]> {
    return [];
  }
  public async applyBulk(): Promise<void> {}
  public async findOperation(): Promise<BulkTransactionOperation | undefined> {
    return undefined;
  }
  public async undoBulk(): Promise<void> {}
}

class InMemoryDecisionRepository implements RecurringDecisionRepository {
  private readonly items = new Map<string, RecurringDecisionRecord>();
  public constructor(initial: readonly RecurringDecisionRecord[] = []) {
    for (const item of initial) this.items.set(item.signature, item);
  }
  public async list(): Promise<readonly RecurringDecisionRecord[]> {
    return Array.from(this.items.values());
  }
  public async findBySignature(signature: string): Promise<RecurringDecisionRecord | undefined> {
    return this.items.get(signature);
  }
  public async save(record: RecurringDecisionRecord): Promise<void> {
    this.items.set(record.signature, record);
  }
  public async saveManyWithEvent(records: readonly RecurringDecisionRecord[]): Promise<void> {
    for (const record of records) this.items.set(record.signature, record);
  }
}

describe("Recurring application use cases", () => {
  it("finds, confirms, dismisses, and mutes recurring proposals", async () => {
    const tx1 = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda001"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-05-15"),
      money: Money.from("-16.99", "CAD"),
      description: "NETFLIX.COM",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "1",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const tx2 = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda002"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-06-15"),
      money: Money.from("-16.99", "CAD"),
      description: "NETFLIX.COM",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "2",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const tx3 = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda003"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-15"),
      money: Money.from("-16.99", "CAD"),
      description: "NETFLIX.COM",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "3",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const ledger = new InMemoryLedgerRepository([tx1, tx2, tx3]);
    const decisions = new InMemoryDecisionRepository();

    const findUseCase = new FindRecurringProposalsUseCase(ledger, decisions);
    const confirmUseCase = new ConfirmRecurringProposalUseCase(
      decisions,
      { now: () => new Date("2026-07-20T10:00:00Z") },
      { generate: () => "018f6b80-0d62-7d2c-9a5c-7f5f59cda888" },
    );
    const dismissUseCase = new DismissRecurringProposalUseCase(
      decisions,
      { now: () => new Date("2026-07-20T10:00:00Z") },
      { generate: () => "018f6b80-0d62-7d2c-9a5c-7f5f59cda999" },
    );
    const muteUseCase = new MuteRecurringProposalUseCase(
      decisions,
      { now: () => new Date("2026-07-20T10:00:00Z") },
      { generate: () => "018f6b80-0d62-7d2c-9a5c-7f5f59cda777" },
    );

    const proposals = await findUseCase.execute();
    expect(proposals).toHaveLength(1);

    const mutedRecord = await muteUseCase.execute(proposals[0]!);
    expect(mutedRecord.status).toBe("muted");

    const confirmedRecord = await confirmUseCase.execute(proposals[0]!);
    expect(confirmedRecord.status).toBe("confirmed");

    const proposalsAfterConfirm = await findUseCase.execute();
    expect(proposalsAfterConfirm).toHaveLength(0);
    const proposalsForSummary = await findUseCase.execute({ includeResolved: true });
    expect(proposalsForSummary).toHaveLength(1);

    const dismissedRecord = await dismissUseCase.execute(proposals[0]!);
    expect(dismissedRecord.status).toBe("dismissed");
  });

  it("merges and splits recurring decisions without losing member identity", async () => {
    const first: RecurringDecisionRecord = {
      id: "018f6b80-0d62-7d2c-9a5c-7f5f59cda801",
      signature: "first",
      name: "Video one",
      status: "confirmed",
      cadence: "monthly",
      memberTransactionIds: ["tx-1", "tx-2"],
      detectorVersion: "recurring-v1",
      updatedAt: NOW,
    };
    const second: RecurringDecisionRecord = {
      ...first,
      id: "018f6b80-0d62-7d2c-9a5c-7f5f59cda802",
      signature: "second",
      name: "Video two",
      memberTransactionIds: ["tx-3", "tx-4"],
    };
    const repository = new InMemoryDecisionRepository([first, second]);
    const generated = [
      "018f6b80-0d62-7d2c-9a5c-7f5f59cda803",
      "018f6b80-0d62-7d2c-9a5c-7f5f59cda804",
      "018f6b80-0d62-7d2c-9a5c-7f5f59cda805",
      "018f6b80-0d62-7d2c-9a5c-7f5f59cda806",
      "018f6b80-0d62-7d2c-9a5c-7f5f59cda807",
    ];
    const ids = { generate: () => generated.shift()! };
    const clock = { now: () => new Date("2026-07-20T10:00:00Z") };
    const merged = await new MergeRecurringDecisionsUseCase(repository, clock, ids).execute(
      ["first", "second"],
      "Video services",
    );
    expect(merged.memberTransactionIds).toEqual(["tx-1", "tx-2", "tx-3", "tx-4"]);
    expect((await repository.findBySignature("first"))?.status).toBe("superseded");

    const children = await new SplitRecurringDecisionUseCase(repository, clock, ids).execute({
      signature: merged.signature,
      groups: [
        { name: "Household", memberTransactionIds: ["tx-1", "tx-3"] },
        { name: "Personal", memberTransactionIds: ["tx-2", "tx-4"] },
      ],
    });
    expect(children.map((item) => item.memberTransactionIds)).toEqual([
      ["tx-1", "tx-3"],
      ["tx-2", "tx-4"],
    ]);
    expect((await repository.findBySignature(merged.signature))?.status).toBe("superseded");
  });

  it("moves detector decisions to explicit review when evidence becomes void", async () => {
    const posted = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda051"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-15"),
      money: Money.from("-16.99", "CAD"),
      description: "VIDEO",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "1",
        original: {},
        transformations: [],
      },
      now: NOW,
    });
    const repository = new InMemoryDecisionRepository([
      {
        id: "018f6b80-0d62-7d2c-9a5c-7f5f59cda852",
        signature: "video:cad:monthly",
        name: "Video",
        status: "confirmed",
        memberTransactionIds: [posted.id],
        detectorVersion: "recurring-v1",
        updatedAt: NOW,
      },
    ]);
    const invalidated = await new ReconcileRecurringDecisionsUseCase(
      new InMemoryLedgerRepository([{ ...posted, status: "void" }]),
      repository,
      { now: () => new Date("2026-07-21T10:00:00Z") },
      { generate: () => "018f6b80-0d62-7d2c-9a5c-7f5f59cda853" },
    ).execute();
    expect(invalidated[0]?.status).toBe("invalidated");
  });
});
