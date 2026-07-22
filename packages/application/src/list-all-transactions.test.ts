import { describe, expect, it, vi } from "vitest";

import { ListAllTransactions } from "./list-all-transactions";
import type { TransactionLedgerRepository } from "./transaction-ledger";

describe("ListAllTransactions", () => {
  it("returns the full ledger with a single repository read", async () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }] as unknown as Awaited<
      ReturnType<TransactionLedgerRepository["list"]>
    >;
    const list = vi.fn().mockResolvedValue(rows);
    const repository = { list } as unknown as TransactionLedgerRepository;

    const result = await new ListAllTransactions(repository).execute();

    expect(result).toEqual(rows);
    expect(list).toHaveBeenCalledTimes(1);
  });
});
