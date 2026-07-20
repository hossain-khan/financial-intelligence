import {
  findRecurringProposals,
  parseRecurringSeriesId,
  parseUtcTimestamp,
  type RecurringDecisionRecord,
  type RecurringProposal,
} from "@financial-intelligence/domain";

import type { TransactionLedgerRepository } from "./transaction-ledger";
import type { TransferDecisionRepository } from "./transfers";
import type { ApplicationClock, IdGenerator } from "./workspaces";

export interface RecurringDecisionRepository {
  list(): Promise<readonly RecurringDecisionRecord[]>;
  findBySignature(signature: string): Promise<RecurringDecisionRecord | undefined>;
  save(record: RecurringDecisionRecord): Promise<void>;
  saveWithEvent?(record: RecurringDecisionRecord, eventId: string, action: string): Promise<void>;
  saveManyWithEvent?(
    records: readonly RecurringDecisionRecord[],
    aggregateId: string,
    eventId: string,
    action: string,
  ): Promise<void>;
  undoLast?(id: string, eventId: string, occurredAt: string): Promise<void>;
}

export class FindRecurringProposalsUseCase {
  public constructor(
    private readonly ledgerRepository: TransactionLedgerRepository,
    private readonly decisionRepository: RecurringDecisionRepository,
    private readonly transferDecisionRepository?: TransferDecisionRepository,
  ) {}

  public async execute(
    options: { readonly includeResolved?: boolean } = {},
  ): Promise<readonly RecurringProposal[]> {
    const transactions = await this.ledgerRepository.list();
    const decisions = await this.decisionRepository.list();

    let excludedTransactionIds: Set<string> | undefined;
    if (this.transferDecisionRepository !== undefined) {
      const transferLinks = await this.transferDecisionRepository.list();
      const confirmedTransfers = transferLinks.filter((l) => l.status === "confirmed");
      excludedTransactionIds = new Set<string>();
      for (const link of confirmedTransfers) {
        excludedTransactionIds.add(link.outflowTransactionId);
        excludedTransactionIds.add(link.inflowTransactionId);
      }
    }

    const resolvedSignatures = new Set(
      decisions
        .filter(
          (d) =>
            d.status === "confirmed" ||
            d.status === "dismissed" ||
            d.status === "muted" ||
            d.status === "superseded",
        )
        .map((d) => d.signature),
    );

    const proposals = findRecurringProposals(transactions, {
      ...(excludedTransactionIds === undefined ? {} : { excludedTransactionIds }),
    });

    return options.includeResolved === true
      ? proposals
      : proposals.filter((p) => !resolvedSignatures.has(p.id));
  }
}

export class ConfirmRecurringProposalUseCase {
  public constructor(
    private readonly decisionRepository: RecurringDecisionRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(proposal: RecurringProposal): Promise<RecurringDecisionRecord> {
    const now = parseUtcTimestamp(this.clock.now().toISOString());
    const existing = await this.decisionRepository.findBySignature(proposal.id);

    const record: RecurringDecisionRecord = {
      id: existing?.id ?? parseRecurringSeriesId(this.ids.generate()),
      signature: proposal.id,
      name: proposal.name,
      ...(proposal.merchantId ? { merchantId: proposal.merchantId } : {}),
      cadence: proposal.cadence,
      memberTransactionIds: proposal.memberTransactions.map(({ id }) => id),
      detectorVersion: "recurring-v1",
      status: "confirmed",
      updatedAt: now,
    };

    if (this.decisionRepository.saveWithEvent !== undefined) {
      await this.decisionRepository.saveWithEvent(record, this.ids.generate(), "confirm");
    } else await this.decisionRepository.save(record);
    return record;
  }
}

export class EditRecurringDecisionUseCase {
  public constructor(
    private readonly repository: RecurringDecisionRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(input: {
    readonly signature: string;
    readonly name?: string;
    readonly cadence?: RecurringDecisionRecord["cadence"];
    readonly toleranceDays?: number;
  }): Promise<RecurringDecisionRecord> {
    const current = await this.repository.findBySignature(input.signature);
    if (current === undefined) throw new Error("Recurring decision was not found");
    if (
      input.toleranceDays !== undefined &&
      (!Number.isInteger(input.toleranceDays) ||
        input.toleranceDays < 0 ||
        input.toleranceDays > 31)
    ) {
      throw new RangeError("Recurring tolerance must be between 0 and 31 days");
    }
    const updated: RecurringDecisionRecord = {
      ...current,
      ...(input.name === undefined ? {} : { name: input.name.trim().slice(0, 120) }),
      ...(input.cadence === undefined ? {} : { cadence: input.cadence }),
      ...(input.toleranceDays === undefined ? {} : { toleranceDays: input.toleranceDays }),
      updatedAt: parseUtcTimestamp(this.clock.now().toISOString()),
    };
    if (this.repository.saveWithEvent !== undefined) {
      await this.repository.saveWithEvent(updated, this.ids.generate(), "edit");
    } else await this.repository.save(updated);
    return updated;
  }
}

export class MergeRecurringDecisionsUseCase {
  public constructor(
    private readonly repository: RecurringDecisionRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(
    signatures: readonly string[],
    name: string,
  ): Promise<RecurringDecisionRecord> {
    if (signatures.length < 2) throw new Error("At least two recurring series are required");
    const decisions = await Promise.all(
      signatures.map((signature) => this.repository.findBySignature(signature)),
    );
    if (decisions.some((decision) => decision === undefined))
      throw new Error("Recurring decision was not found");
    const present = decisions as RecurringDecisionRecord[];
    const now = parseUtcTimestamp(this.clock.now().toISOString());
    const merged: RecurringDecisionRecord = {
      id: parseRecurringSeriesId(this.ids.generate()),
      signature: `merged:${[...signatures].sort().join(":")}`,
      name: name.trim().slice(0, 120),
      status: "confirmed",
      ...(present[0]?.cadence === undefined ? {} : { cadence: present[0].cadence }),
      memberTransactionIds: [
        ...new Set(present.flatMap((item) => item.memberTransactionIds ?? [])),
      ],
      detectorVersion: "user-merged-v1",
      supersedesIds: present.map(({ id }) => id),
      updatedAt: now,
    };
    const records = [
      merged,
      ...present.map((decision) => ({
        ...decision,
        status: "superseded" as const,
        updatedAt: now,
      })),
    ];
    if (this.repository.saveManyWithEvent !== undefined) {
      await this.repository.saveManyWithEvent(records, merged.id, this.ids.generate(), "merge");
    } else {
      for (const record of records) await this.repository.save(record);
    }
    return merged;
  }
}

export class SplitRecurringDecisionUseCase {
  public constructor(
    private readonly repository: RecurringDecisionRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(input: {
    readonly signature: string;
    readonly groups: readonly {
      readonly name: string;
      readonly memberTransactionIds: readonly string[];
    }[];
  }): Promise<readonly RecurringDecisionRecord[]> {
    const current = await this.repository.findBySignature(input.signature);
    if (current === undefined) throw new Error("Recurring decision was not found");
    if (input.groups.length < 2) throw new Error("A split requires at least two groups");
    const originalMembers = new Set(current.memberTransactionIds ?? []);
    const suppliedMembers = input.groups.flatMap(
      ({ memberTransactionIds }) => memberTransactionIds,
    );
    if (
      suppliedMembers.length !== originalMembers.size ||
      new Set(suppliedMembers).size !== suppliedMembers.length ||
      suppliedMembers.some((id) => !originalMembers.has(id))
    ) {
      throw new Error("Split groups must partition every original member exactly once");
    }
    const now = parseUtcTimestamp(this.clock.now().toISOString());
    const children = input.groups.map((group, index): RecurringDecisionRecord => ({
      id: parseRecurringSeriesId(this.ids.generate()),
      signature: `split:${current.id}:${index + 1}`,
      name: group.name.trim().slice(0, 120),
      ...(current.merchantId === undefined ? {} : { merchantId: current.merchantId }),
      ...(current.cadence === undefined ? {} : { cadence: current.cadence }),
      ...(current.toleranceDays === undefined ? {} : { toleranceDays: current.toleranceDays }),
      memberTransactionIds: [...group.memberTransactionIds],
      detectorVersion: "user-split-v1",
      supersedesIds: [current.id],
      status: "confirmed",
      updatedAt: now,
    }));
    const superseded: RecurringDecisionRecord = {
      ...current,
      status: "superseded",
      updatedAt: now,
    };
    if (this.repository.saveManyWithEvent !== undefined) {
      await this.repository.saveManyWithEvent(
        [...children, superseded],
        current.id,
        this.ids.generate(),
        "split",
      );
    } else {
      for (const record of [...children, superseded]) await this.repository.save(record);
    }
    return children;
  }
}

/**
 * Revalidates detector-owned decisions after import or transaction changes. User-authored
 * split/merge decisions remain durable; detector-owned decisions with missing/void members or
 * a changed detector version move to an explicit review state instead of disappearing.
 */
export class ReconcileRecurringDecisionsUseCase {
  public constructor(
    private readonly ledger: TransactionLedgerRepository,
    private readonly repository: RecurringDecisionRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(
    detectorVersion = "recurring-v1",
  ): Promise<readonly RecurringDecisionRecord[]> {
    const [transactions, decisions] = await Promise.all([
      this.ledger.list(),
      this.repository.list(),
    ]);
    const eligible = new Set<string>(
      transactions.filter((item) => item.status === "posted").map(({ id }) => id),
    );
    const now = parseUtcTimestamp(this.clock.now().toISOString());
    const invalidated = decisions
      .filter(
        (decision) =>
          decision.status === "confirmed" &&
          decision.detectorVersion?.startsWith("recurring-") === true &&
          (decision.detectorVersion !== detectorVersion ||
            (decision.memberTransactionIds ?? []).some((id) => !eligible.has(id))),
      )
      .map((decision): RecurringDecisionRecord => ({
        ...decision,
        status: "invalidated",
        updatedAt: now,
      }));
    if (invalidated.length === 0) return [];
    if (this.repository.saveManyWithEvent !== undefined) {
      await this.repository.saveManyWithEvent(
        invalidated,
        `reconcile:${now}`,
        this.ids.generate(),
        "invalidate",
      );
    } else {
      for (const record of invalidated) await this.repository.save(record);
    }
    return invalidated;
  }
}

export class UndoRecurringDecisionUseCase {
  public constructor(
    private readonly repository: RecurringDecisionRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}
  public async execute(id: string): Promise<void> {
    if (this.repository.undoLast === undefined)
      throw new Error("Recurring decision undo is unavailable");
    await this.repository.undoLast(id, this.ids.generate(), this.clock.now().toISOString());
  }
}

export class DismissRecurringProposalUseCase {
  public constructor(
    private readonly decisionRepository: RecurringDecisionRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(proposal: RecurringProposal): Promise<RecurringDecisionRecord> {
    const now = parseUtcTimestamp(this.clock.now().toISOString());
    const existing = await this.decisionRepository.findBySignature(proposal.id);

    const record: RecurringDecisionRecord = {
      id: existing?.id ?? parseRecurringSeriesId(this.ids.generate()),
      signature: proposal.id,
      name: proposal.name,
      ...(proposal.merchantId ? { merchantId: proposal.merchantId } : {}),
      cadence: proposal.cadence,
      memberTransactionIds: proposal.memberTransactions.map(({ id }) => id),
      detectorVersion: "recurring-v1",
      status: "dismissed",
      updatedAt: now,
    };

    if (this.decisionRepository.saveWithEvent !== undefined) {
      await this.decisionRepository.saveWithEvent(record, this.ids.generate(), "dismiss");
    } else await this.decisionRepository.save(record);
    return record;
  }
}

export class MuteRecurringProposalUseCase {
  public constructor(
    private readonly decisionRepository: RecurringDecisionRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(proposal: RecurringProposal): Promise<RecurringDecisionRecord> {
    const now = parseUtcTimestamp(this.clock.now().toISOString());
    const existing = await this.decisionRepository.findBySignature(proposal.id);

    const record: RecurringDecisionRecord = {
      id: existing?.id ?? parseRecurringSeriesId(this.ids.generate()),
      signature: proposal.id,
      name: proposal.name,
      ...(proposal.merchantId ? { merchantId: proposal.merchantId } : {}),
      cadence: proposal.cadence,
      memberTransactionIds: proposal.memberTransactions.map(({ id }) => id),
      detectorVersion: "recurring-v1",
      status: "muted",
      updatedAt: now,
    };

    if (this.decisionRepository.saveWithEvent !== undefined) {
      await this.decisionRepository.saveWithEvent(record, this.ids.generate(), "mute");
    } else await this.decisionRepository.save(record);
    return record;
  }
}
