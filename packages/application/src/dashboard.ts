import {
  analyzeCashFlow,
  analyzeMerchantRanking,
  analyzeMoneyFlow,
  analyzeSavingsRate,
  summarizeRecurringSeries,
  type CashFlowFilter,
  type MerchantRankingReport,
  type MoneyFlowReport,
  type RecurringSummaryReport,
  type SavingsRateReport,
} from "@financial-intelligence/analysis";

import type { CategoryRepository } from "./categories";
import type { MerchantRepository } from "./merchants";
import type { RecurringDecisionRepository } from "./recurring";
import type { TransactionLedgerRepository } from "./transaction-ledger";
import type { TransferDecisionRepository } from "./transfers";
import type { FindRecurringProposalsUseCase } from "./recurring";

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
