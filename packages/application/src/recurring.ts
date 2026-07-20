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
        .filter((d) => d.status === "confirmed" || d.status === "dismissed" || d.status === "muted")
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
      status: "confirmed",
      updatedAt: now,
    };

    await this.decisionRepository.save(record);
    return record;
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
      status: "dismissed",
      updatedAt: now,
    };

    await this.decisionRepository.save(record);
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
      status: "muted",
      updatedAt: now,
    };

    await this.decisionRepository.save(record);
    return record;
  }
}
