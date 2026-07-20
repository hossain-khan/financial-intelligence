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
    private readonly ledgerRepository?: TransactionLedgerRepository,
  ) {}

  public async execute(proposal: TransferProposal): Promise<TransferLink> {
    if (proposal.isAmbiguous) {
      throw new Error("Ambiguous transfer proposals require resolution before confirmation");
    }
    const activeLinks = (await this.decisionRepository.list()).filter(
      (link) => link.status === "confirmed" && link.signature !== proposal.id,
    );
    const proposalTransactionIds = new Set([
      proposal.outflowTransaction.id,
      proposal.inflowTransaction.id,
    ]);
    if (
      activeLinks.some(
        (link) =>
          proposalTransactionIds.has(link.outflowTransactionId) ||
          proposalTransactionIds.has(link.inflowTransactionId),
      )
    ) {
      throw new Error("A transaction is already part of another confirmed transfer");
    }
    if (this.ledgerRepository !== undefined) {
      const current = new Map((await this.ledgerRepository.list()).map((item) => [item.id, item]));
      assertTransferSideUnchanged(
        proposal.outflowTransaction,
        current.get(proposal.outflowTransaction.id),
      );
      assertTransferSideUnchanged(
        proposal.inflowTransaction,
        current.get(proposal.inflowTransaction.id),
      );
    }
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

function assertTransferSideUnchanged(
  proposed: TransferProposal["outflowTransaction"],
  current: TransferProposal["outflowTransaction"] | undefined,
): void {
  if (
    current === undefined ||
    current.status !== "posted" ||
    current.accountId !== proposed.accountId ||
    current.postedDate !== proposed.postedDate ||
    !current.money.equals(proposed.money)
  ) {
    throw new Error("Transfer proposal is stale and must be recomputed");
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
