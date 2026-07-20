import {
  analyzeCashFlow,
  analyzeMerchantRanking,
  analyzeMoneyFlow,
  analyzeSavingsRate,
  filterCashFlowTransactions,
  summarizeRecurringSeries,
  type CashFlowFilter,
  type MerchantRankingReport,
  type MoneyFlowReport,
  type RecurringSummaryReport,
  type SavingsRateReport,
} from "@financial-intelligence/analysis";
import {
  findRecurringProposals,
  type Category,
  type Merchant,
  type RecurringDecisionRecord,
  type Transaction,
  type TransferLink,
} from "@financial-intelligence/domain";

import type { CategoryRepository } from "./categories";
import type { MerchantRepository } from "./merchants";
import type { RecurringDecisionRepository } from "./recurring";
import type { TransactionLedgerRepository } from "./transaction-ledger";
import type { TransferDecisionRepository } from "./transfers";
import type { FindRecurringProposalsUseCase } from "./recurring";

export interface DashboardSnapshot {
  readonly sourceRevision: string;
  readonly transactions: readonly Transaction[];
  readonly categories: readonly Category[];
  readonly merchants: readonly Merchant[];
  readonly transferDecisions: readonly TransferLink[];
  readonly recurringDecisions: readonly RecurringDecisionRecord[];
}

export interface DashboardSnapshotRepository {
  read(): Promise<DashboardSnapshot>;
}

export interface DashboardReportBundle {
  readonly sourceRevision: string;
  readonly filter: CashFlowFilter;
  readonly merchant: MerchantRankingReport;
  readonly savings: SavingsRateReport;
  readonly recurring: RecurringSummaryReport;
  readonly moneyFlow: MoneyFlowReport;
}

export class QueryDashboardUseCase {
  public constructor(
    private readonly repository: DashboardSnapshotRepository,
    private readonly clock: { now(): Date },
  ) {}

  public async execute(filter: CashFlowFilter = {}): Promise<DashboardReportBundle> {
    const snapshot = await this.repository.read();
    const confirmedTransferTransactionIds = new Set<string>();
    for (const link of snapshot.transferDecisions) {
      if (link.status !== "confirmed") continue;
      confirmedTransferTransactionIds.add(link.outflowTransactionId);
      confirmedTransferTransactionIds.add(link.inflowTransactionId);
    }
    const allRecurringProposals = findRecurringProposals(snapshot.transactions, {
      excludedTransactionIds: confirmedTransferTransactionIds,
    });
    const recurringMemberIds = resolveRecurringMemberIds(
      filter.recurringStatuses,
      allRecurringProposals,
      snapshot.recurringDecisions,
    );
    const effectiveFilter: CashFlowFilter =
      recurringMemberIds === undefined
        ? filter
        : {
            ...filter,
            transactionIds:
              filter.transactionIds === undefined
                ? [...recurringMemberIds]
                : filter.transactionIds.filter((id) => recurringMemberIds.has(id)),
          };
    const cashFlow = analyzeCashFlow({
      transactions: snapshot.transactions,
      categories: snapshot.categories,
      filter: effectiveFilter,
      confirmedTransferTransactionIds,
      asOfDate: this.clock.now().toISOString().slice(0, 10),
    });
    const recurringTransactions = filterCashFlowTransactions(
      snapshot.transactions,
      effectiveFilter,
    );
    const recurringProposals = findRecurringProposals(recurringTransactions, {
      excludedTransactionIds: confirmedTransferTransactionIds,
    });

    return {
      sourceRevision: snapshot.sourceRevision,
      filter: effectiveFilter,
      merchant: analyzeMerchantRanking({
        transactions: snapshot.transactions,
        merchants: snapshot.merchants,
        filter: effectiveFilter,
        confirmedTransferTransactionIds,
      }),
      savings: analyzeSavingsRate(cashFlow),
      recurring: summarizeRecurringSeries(recurringProposals, snapshot.recurringDecisions),
      moneyFlow: analyzeMoneyFlow(cashFlow),
    };
  }
}

function resolveRecurringMemberIds(
  statuses: CashFlowFilter["recurringStatuses"],
  proposals: readonly ReturnType<typeof findRecurringProposals>[number][],
  decisions: readonly RecurringDecisionRecord[],
): ReadonlySet<string> | undefined {
  if (statuses === undefined || statuses.length === 0) return undefined;
  const selected = new Set(statuses);
  const decisionBySignature = new Map(decisions.map((decision) => [decision.signature, decision]));
  const ids = new Set<string>();
  for (const proposal of proposals) {
    const status = decisionBySignature.get(proposal.id)?.status ?? "proposed";
    if (status !== "superseded" && status !== "invalidated" && selected.has(status)) {
      for (const transaction of proposal.memberTransactions) ids.add(transaction.id);
    }
  }
  for (const decision of decisions) {
    if (
      (decision.status === "confirmed" ||
        decision.status === "dismissed" ||
        decision.status === "muted") &&
      selected.has(decision.status)
    ) {
      for (const id of decision.memberTransactionIds ?? []) ids.add(id);
    }
  }
  return ids;
}

export class QueryMerchantRankingUseCase {
  public constructor(
    private readonly ledgerRepository: TransactionLedgerRepository,
    private readonly merchantRepository: MerchantRepository,
    private readonly transferDecisionRepository?: TransferDecisionRepository,
  ) {}

  public async execute(filter?: CashFlowFilter): Promise<MerchantRankingReport> {
    const [transactions, merchants] = await Promise.all([
      this.ledgerRepository.list(),
      this.merchantRepository.list(),
    ]);

    let confirmedTransferTransactionIds: Set<string> | undefined;
    if (this.transferDecisionRepository !== undefined) {
      const transferLinks = await this.transferDecisionRepository.list();
      const confirmedTransfers = transferLinks.filter((l) => l.status === "confirmed");
      confirmedTransferTransactionIds = new Set<string>();
      for (const link of confirmedTransfers) {
        confirmedTransferTransactionIds.add(link.outflowTransactionId);
        confirmedTransferTransactionIds.add(link.inflowTransactionId);
      }
    }

    return analyzeMerchantRanking({
      transactions,
      merchants,
      ...(filter ? { filter } : {}),
      ...(confirmedTransferTransactionIds ? { confirmedTransferTransactionIds } : {}),
    });
  }
}

export class QuerySavingsRateUseCase {
  public constructor(
    private readonly ledgerRepository: TransactionLedgerRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly transferDecisionRepository?: TransferDecisionRepository,
  ) {}

  public async execute(filter?: CashFlowFilter): Promise<SavingsRateReport> {
    const [transactions, categories] = await Promise.all([
      this.ledgerRepository.list(),
      this.categoryRepository.list(),
    ]);

    let confirmedTransferTransactionIds: Set<string> | undefined;
    if (this.transferDecisionRepository !== undefined) {
      const transferLinks = await this.transferDecisionRepository.list();
      const confirmedTransfers = transferLinks.filter((l) => l.status === "confirmed");
      confirmedTransferTransactionIds = new Set<string>();
      for (const link of confirmedTransfers) {
        confirmedTransferTransactionIds.add(link.outflowTransactionId);
        confirmedTransferTransactionIds.add(link.inflowTransactionId);
      }
    }

    const cashFlowReport = analyzeCashFlow({
      transactions,
      categories,
      ...(filter ? { filter } : {}),
      ...(confirmedTransferTransactionIds ? { confirmedTransferTransactionIds } : {}),
      asOfDate: new Date().toISOString().slice(0, 10),
    });

    return analyzeSavingsRate(cashFlowReport);
  }
}

export class QueryRecurringSummaryUseCase {
  public constructor(
    private readonly findRecurringProposalsUseCase: FindRecurringProposalsUseCase,
    private readonly decisionRepository: RecurringDecisionRepository,
  ) {}

  public async execute(): Promise<RecurringSummaryReport> {
    const [proposals, decisions] = await Promise.all([
      this.findRecurringProposalsUseCase.execute({ includeResolved: true }),
      this.decisionRepository.list(),
    ]);

    return summarizeRecurringSeries(proposals, decisions);
  }
}

export class QueryMoneyFlowUseCase {
  public constructor(
    private readonly ledgerRepository: TransactionLedgerRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly transferDecisionRepository?: TransferDecisionRepository,
  ) {}

  public async execute(filter?: CashFlowFilter): Promise<MoneyFlowReport> {
    const [transactions, categories] = await Promise.all([
      this.ledgerRepository.list(),
      this.categoryRepository.list(),
    ]);

    let confirmedTransferTransactionIds: Set<string> | undefined;
    if (this.transferDecisionRepository !== undefined) {
      const transferLinks = await this.transferDecisionRepository.list();
      const confirmedTransfers = transferLinks.filter((l) => l.status === "confirmed");
      confirmedTransferTransactionIds = new Set<string>();
      for (const link of confirmedTransfers) {
        confirmedTransferTransactionIds.add(link.outflowTransactionId);
        confirmedTransferTransactionIds.add(link.inflowTransactionId);
      }
    }

    const cashFlowReport = analyzeCashFlow({
      transactions,
      categories,
      ...(filter ? { filter } : {}),
      ...(confirmedTransferTransactionIds ? { confirmedTransferTransactionIds } : {}),
      asOfDate: new Date().toISOString().slice(0, 10),
    });

    return analyzeMoneyFlow(cashFlowReport);
  }
}
