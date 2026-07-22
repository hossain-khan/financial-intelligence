import type { Transaction } from "@financial-intelligence/domain";

import type { TransactionLedgerRepository } from "./transaction-ledger";

/**
 * Read the entire canonical ledger in one pass. Unlike `QueryTransactionLedger` (which filters,
 * sorts, and paginates), this returns every transaction with a single repository read — the shape AI
 * eligibility needs. Paginating over the sorting query re-scans the whole ledger per page and blocks
 * the main thread; this avoids that (see the 2026-07-22 hang-fix spec).
 */
export class ListAllTransactions {
  public constructor(private readonly repository: TransactionLedgerRepository) {}

  public execute(): Promise<readonly Transaction[]> {
    return this.repository.list();
  }
}
