import { describe, expect, it } from "vitest";

import {
  Money,
  createAccount,
  createTransaction,
  parseAccountId,
  parseDateOnly,
  parseImportId,
  parseTransactionId,
  parseUtcTimestamp,
  parseWorkspaceId,
  type Account,
  type Transaction,
  type TransferLink,
} from "@financial-intelligence/domain";

import type { AccountRepository } from "./accounts";
import type { BulkTransactionOperation, TransactionLedgerRepository } from "./transaction-ledger";
import {
  ConfirmTransferProposalUseCase,
  FindTransferProposalsUseCase,
  RejectTransferProposalUseCase,
  UnlinkTransferUseCase,
  type TransferDecisionRepository,
} from "./transfers";

const NOW = parseUtcTimestamp("2026-07-20T10:00:00Z");
const WORKSPACE_ID = parseWorkspaceId("018f6b80-0d62-7d2c-9a5c-7f5f59cda999");
const ACCOUNT_CHECKING = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda111");
const ACCOUNT_SAVINGS = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda222");
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

class InMemoryAccountRepository implements AccountRepository {
  private readonly items = new Map<string, Account>();
  public constructor(list: readonly Account[]) {
    for (const a of list) this.items.set(a.id, a);
  }
  public async listByWorkspace(): Promise<readonly Account[]> {
    return Array.from(this.items.values());
  }
  public async findById(id: string): Promise<Account | undefined> {
    return this.items.get(id);
  }
  public async save(account: Account): Promise<void> {
    this.items.set(account.id, account);
  }
  public async hasReferences(): Promise<boolean> {
    return false;
  }
  public async deleteIfUnreferenced(): Promise<boolean> {
    return true;
  }
}

class InMemoryDecisionRepository implements TransferDecisionRepository {
  private readonly items = new Map<string, TransferLink>();
  public async list(): Promise<readonly TransferLink[]> {
    return Array.from(this.items.values());
  }
  public async findBySignature(signature: string): Promise<TransferLink | undefined> {
    return this.items.get(signature);
  }
  public async save(link: TransferLink): Promise<void> {
    this.items.set(link.signature, link);
  }
}

describe("Transfer application use cases", () => {
  it("finds, confirms, rejects, and unlinks transfer proposals", async () => {
    const checking = createAccount({
      id: ACCOUNT_CHECKING,
      workspaceId: WORKSPACE_ID,
      name: "Checking",
      type: "checking",
      currency: "CAD",
      now: NOW,
    });
    const savings = createAccount({
      id: ACCOUNT_SAVINGS,
      workspaceId: WORKSPACE_ID,
      name: "Savings",
      type: "savings",
      currency: "CAD",
      now: NOW,
    });

    const txOut = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda001"),
      accountId: ACCOUNT_CHECKING,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-20"),
      money: Money.from("-250.00", "CAD"),
      description: "TRANSFER TO SAVINGS",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "1",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const txIn = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda002"),
      accountId: ACCOUNT_SAVINGS,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-20"),
      money: Money.from("250.00", "CAD"),
      description: "TRANSFER FROM CHECKING",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "2",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const ledger = new InMemoryLedgerRepository([txOut, txIn]);
    const accounts = new InMemoryAccountRepository([checking, savings]);
    const decisions = new InMemoryDecisionRepository();

    const findUseCase = new FindTransferProposalsUseCase(ledger, accounts, decisions);
    const confirmUseCase = new ConfirmTransferProposalUseCase(
      decisions,
      { now: () => new Date("2026-07-20T10:00:00Z") },
      { generate: () => "018f6b80-0d62-7d2c-9a5c-7f5f59cda888" },
      ledger,
    );
    const rejectUseCase = new RejectTransferProposalUseCase(
      decisions,
      { now: () => new Date("2026-07-20T10:00:00Z") },
      { generate: () => "018f6b80-0d62-7d2c-9a5c-7f5f59cda999" },
    );
    const unlinkUseCase = new UnlinkTransferUseCase(decisions, {
      now: () => new Date("2026-07-20T10:00:00Z"),
    });

    const proposals = await findUseCase.execute();
    expect(proposals).toHaveLength(1);
    await expect(confirmUseCase.execute({ ...proposals[0]!, isAmbiguous: true })).rejects.toThrow(
      /ambiguous/i,
    );

    const rejectedLink = await rejectUseCase.execute(proposals[0]!);
    expect(rejectedLink.status).toBe("rejected");

    const proposalsAfterReject = await findUseCase.execute();
    expect(proposalsAfterReject).toHaveLength(0);

    const confirmedLink = await confirmUseCase.execute(proposals[0]!);
    expect(confirmedLink.status).toBe("confirmed");

    await unlinkUseCase.execute(confirmedLink.signature);
    const unlinkedDoc = await decisions.findBySignature(confirmedLink.signature);
    expect(unlinkedDoc?.status).toBe("unlinked");
  });
});
