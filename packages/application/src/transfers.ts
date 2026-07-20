import {
  findTransferProposals,
  parseTransferLinkId,
  parseUtcTimestamp,
  type TransferLink,
  type TransferProposal,
  type WorkspaceId,
} from "@financial-intelligence/domain";

import type { AccountRepository } from "./accounts";
import type { TransactionLedgerRepository } from "./transaction-ledger";
import type { ApplicationClock, IdGenerator } from "./workspaces";

export interface TransferDecisionRepository {
  list(): Promise<readonly TransferLink[]>;
  findBySignature(signature: string): Promise<TransferLink | undefined>;
  save(link: TransferLink): Promise<void>;
}

export class FindTransferProposalsUseCase {
  public constructor(
    private readonly ledgerRepository: TransactionLedgerRepository,
    private readonly accountRepository: AccountRepository,
    private readonly decisionRepository: TransferDecisionRepository,
  ) {}

  public async execute(workspaceId?: WorkspaceId): Promise<readonly TransferProposal[]> {
    const transactions = await this.ledgerRepository.list();
    const accounts =
      workspaceId !== undefined ? await this.accountRepository.listByWorkspace(workspaceId) : [];
    const decisions = await this.decisionRepository.list();

    const resolvedSignatures = new Set(
      decisions
        .filter((d: TransferLink) => d.status === "confirmed" || d.status === "rejected")
        .map((d: TransferLink) => d.signature),
    );

    const proposals = findTransferProposals(transactions, accounts);

    return proposals.filter((p) => !resolvedSignatures.has(p.id));
  }
}

export class ConfirmTransferProposalUseCase {
  public constructor(
    private readonly decisionRepository: TransferDecisionRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(proposal: TransferProposal): Promise<TransferLink> {
    const now = parseUtcTimestamp(this.clock.now().toISOString());
    const existing = await this.decisionRepository.findBySignature(proposal.id);

    const link: TransferLink = {
      id: existing?.id ?? parseTransferLinkId(this.ids.generate()),
      signature: proposal.id,
      outflowTransactionId: proposal.outflowTransaction.id,
      inflowTransactionId: proposal.inflowTransaction.id,
      status: "confirmed",
      score: proposal.score,
      evidence: proposal.evidence,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await this.decisionRepository.save(link);
    return link;
  }
}

export class RejectTransferProposalUseCase {
  public constructor(
    private readonly decisionRepository: TransferDecisionRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(proposal: TransferProposal): Promise<TransferLink> {
    const now = parseUtcTimestamp(this.clock.now().toISOString());
    const existing = await this.decisionRepository.findBySignature(proposal.id);

    const link: TransferLink = {
      id: existing?.id ?? parseTransferLinkId(this.ids.generate()),
      signature: proposal.id,
      outflowTransactionId: proposal.outflowTransaction.id,
      inflowTransactionId: proposal.inflowTransaction.id,
      status: "rejected",
      score: proposal.score,
      evidence: proposal.evidence,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await this.decisionRepository.save(link);
    return link;
  }
}

export class UnlinkTransferUseCase {
  public constructor(
    private readonly decisionRepository: TransferDecisionRepository,
    private readonly clock: ApplicationClock,
  ) {}

  public async execute(signature: string): Promise<void> {
    const link = await this.decisionRepository.findBySignature(signature);
    if (link === undefined) {
      throw new Error(`Transfer link with signature '${signature}' was not found`);
    }

    const now = parseUtcTimestamp(this.clock.now().toISOString());
    const unlinked: TransferLink = {
      ...link,
      status: "unlinked",
      updatedAt: now,
    };

    await this.decisionRepository.save(unlinked);
  }
}
