import type {
  BulkTransactionOperation,
  CashFlowFilter,
  CashFlowReport,
  ReviewQueueQueryResult,
  RuleImpactPreview,
  TransactionLedgerPage,
  TransactionLedgerSortField,
} from "@financial-intelligence/application";
import {
  duplicateEvidenceSignature,
  parseCategoryId,
  parseTransactionId,
  type Account,
  type Category,
  type DuplicateCandidate,
  type DuplicateDecision,
  type ReviewReason,
  type Transaction,
} from "@financial-intelligence/domain";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import type { ApplicationServices } from "./infrastructure";
import { BrainManagementView } from "./BrainManagementView";
import { RecurringReviewSection } from "./RecurringReviewSection";
import { TransferReviewSection } from "./TransferReviewSection";
import type { RecurringProposal, TransferProposal } from "@financial-intelligence/domain";

const EMPTY_PAGE: TransactionLedgerPage = { items: [], total: 0, offset: 0, limit: 50 };
const EMPTY_SUMMARY: CashFlowReport = {
  filter: {},
  filterSummary: "All dates · all accounts · all currencies · all categories",
  mixedCurrencies: false,
  currencies: [],
};

export function TransactionPage({ services }: { readonly services: ApplicationServices }) {
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [accountId, setAccountId] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currency, setCurrency] = useState("");
  const [direction, setDirection] = useState<"" | "inflow" | "outflow">("");
  const [categoryId, setCategoryId] = useState("");
  const [reviewState, setReviewState] = useState("");
  const [sortField, setSortField] = useState<TransactionLedgerSortField>("postedDate");
  const [sortDirection, setSortDirection] = useState<"ascending" | "descending">("descending");
  const [pageIndex, setPageIndex] = useState(0);
  const [page, setPage] = useState<TransactionLedgerPage>(EMPTY_PAGE);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkReviewState, setBulkReviewState] = useState("");
  const [previewCount, setPreviewCount] = useState<number>();
  const [lastOperation, setLastOperation] = useState<BulkTransactionOperation>();
  const [duplicates, setDuplicates] = useState<readonly DuplicateCandidate[]>([]);
  const [decisions, setDecisions] = useState<ReadonlyMap<string, DuplicateDecision>>(new Map());
  const [allTransactions, setAllTransactions] = useState<readonly Transaction[]>([]);
  const [summary, setSummary] = useState<CashFlowReport>(EMPTY_SUMMARY);
  const [proposals, setProposals] = useState<readonly TransferProposal[]>([]);
  const [recurringProposals, setRecurringProposals] = useState<readonly RecurringProposal[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [message, setMessage] = useState<string>();
  const accountInitialized = useRef(false);

  const refresh = useCallback(async () => {
    const workspaces = await services.listWorkspaces.execute();
    const workspace = workspaces[0];
    const loadedAccounts =
      workspace === undefined ? [] : await services.listAccounts.execute(workspace.id);
    const activeAccounts = loadedAccounts.filter((account) => !account.archived);
    const nextAccountId = !accountInitialized.current
      ? (activeAccounts[0]?.id ?? "")
      : accountId === "" || activeAccounts.some((account) => account.id === accountId)
        ? accountId
        : "";
    const availableCurrencies = new Set(
      activeAccounts
        .filter((account) => nextAccountId === "" || account.id === nextAccountId)
        .map((account) => account.currency),
    );
    const nextCurrency = currency === "" || !availableCurrencies.has(currency) ? "" : currency;
    const loadedCategories = await services.listCategories.execute();
    const sharedFilter = createCashFlowFilter(
      nextAccountId,
      nextCurrency,
      categoryId,
      fromDate,
      toDate,
    );
    const [
      loadedPage,
      loadedSummary,
      transactionGroups,
      loadedDecisions,
      loadedProposals,
      loadedRecurring,
    ] = await Promise.all([
      services.queryTransactionLedger.execute({
        filter: {
          ...sharedFilter,
          ...(search.trim() === "" ? {} : { search }),
          ...(reviewState === ""
            ? {}
            : { reviewStates: [reviewState as "unreviewed" | "needsReview" | "reviewed"] }),
          ...(direction === "" ? {} : { directions: [direction] }),
        },
        sort: { field: sortField, direction: sortDirection },
        offset: pageIndex * 50,
        limit: 50,
      }),
      services.queryCashFlowSummary.execute(sharedFilter),
      Promise.all(
        activeAccounts
          .filter((account) => nextAccountId === "" || account.id === nextAccountId)
          .map((account) => services.listTransactions.execute(account.id)),
      ),
      services.listDuplicateResolutions.execute(),
      services.findTransferProposalsUseCase.execute(),
      services.findRecurringProposalsUseCase.execute(),
    ]);
    const transactions = transactionGroups.flat();
    const latestCreatedAt = transactions.reduce(
      (latest, transaction) => (transaction.createdAt > latest ? transaction.createdAt : latest),
      "",
    );
    const incoming = transactions.filter(
      (transaction) => transaction.createdAt === latestCreatedAt,
    );
    const candidates =
      nextAccountId === "" || incoming.length === 0
        ? []
        : await services.findDuplicateCandidates.execute(nextAccountId, incoming);
    setAccounts(activeAccounts);
    setCategories(loadedCategories);
    setAccountId(nextAccountId);
    setCurrency(nextCurrency);
    setPage(loadedPage);
    setSummary(loadedSummary);
    setAllTransactions(transactions);
    setDuplicates(candidates);
    setDecisions(loadedDecisions);
    setProposals(loadedProposals);
    setRecurringProposals(loadedRecurring);
    accountInitialized.current = true;
    setStatus("ready");
  }, [
    accountId,
    categoryId,
    currency,
    direction,
    fromDate,
    pageIndex,
    reviewState,
    search,
    services,
    sortDirection,
    sortField,
    toDate,
  ]);

  useEffect(() => {
    let current = true;
    void refresh().catch(() => {
      if (current) {
        setMessage(
          "The local transaction ledger could not be loaded. Existing data was unchanged.",
        );
        setStatus("error");
      }
    });
    return () => {
      current = false;
    };
  }, [refresh]);

  const applyEdit = useCallback(
    async (
      transactionIds: readonly string[],
      edit: Parameters<ApplicationServices["applyBulkTransactionEdit"]["execute"]>[1],
    ) => {
      setStatus("saving");
      setMessage(undefined);
      try {
        const operation = await services.applyBulkTransactionEdit.execute(transactionIds, edit);
        setLastOperation(operation);
        setSelected(new Set());
        setPreviewCount(undefined);
        await refresh();
        setMessage(
          `Updated ${operation.changes.length} transaction${operation.changes.length === 1 ? "" : "s"}. Undo is available.`,
        );
      } catch (error) {
        setStatus("error");
        setMessage(
          error instanceof Error ? error.message : "The transaction edit could not be saved.",
        );
      }
    },
    [refresh, services],
  );

  const columns = useMemo(() => {
    const helper = createColumnHelper<Transaction>();
    return [
      helper.display({
        id: "select",
        header: "Select",
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.description}`}
            checked={selected.has(row.original.id)}
            onChange={(event) => {
              const next = new Set(selected);
              if (event.currentTarget.checked) next.add(row.original.id);
              else next.delete(row.original.id);
              setSelected(next);
            }}
          />
        ),
      }),
      helper.accessor("postedDate", { header: "Date" }),
      helper.accessor("description", { header: "Description" }),
      helper.display({
        id: "amount",
        header: "Amount",
        cell: ({ row }) => {
          const money = row.original.money.toJSON();
          return `${money.currency} ${money.amount}`;
        },
      }),
      helper.display({
        id: "category",
        header: "Category",
        cell: ({ row }) => (
          <select
            aria-label={`Category for ${row.original.description}`}
            value={row.original.categoryId ?? ""}
            onChange={(event) =>
              void applyEdit([row.original.id], {
                category:
                  event.currentTarget.value === ""
                    ? null
                    : categories.find((category) => category.id === event.currentTarget.value)!.id,
              })
            }
          >
            <option value="">Uncategorized</option>
            {categories
              .filter((category) => !category.archived)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        ),
      }),
      helper.accessor("reviewState", { header: "Review" }),
      helper.accessor("status", { header: "Status" }),
      helper.display({
        id: "details",
        header: "Details",
        cell: ({ row }) => (
          <TransactionDetails
            transaction={row.original}
            onSave={(edit) => applyEdit([row.original.id], edit)}
            onLoadHistory={() => services.listTransactionEditHistory.execute(row.original.id)}
          />
        ),
      }),
    ];
  }, [applyEdit, categories, selected, services]);

  // TanStack Table intentionally owns mutable table methods; rows remain controlled by React state.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: [...page.items],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const pageCount = Math.max(1, Math.ceil(page.total / page.limit));
  const transactionById = new Map(
    allTransactions.map((transaction) => [transaction.id, transaction]),
  );

  const previewBulk = async () => {
    const edit = bulkEdit(bulkCategory, bulkReviewState, categories);
    const preview = await services.previewBulkTransactionEdit.execute([...selected], edit);
    setPreviewCount(preview.affectedCount);
  };

  const sharedFilter = createCashFlowFilter(accountId, currency, categoryId, fromDate, toDate);
  const availableCurrencies = [
    ...new Set(
      accounts
        .filter((account) => accountId === "" || account.id === accountId)
        .map((account) => account.currency),
    ),
  ].sort();
  const exportCurrentQuery = async () => {
    try {
      const exported = await services.exportFilteredTransactions.execute(sharedFilter);
      const url = URL.createObjectURL(new Blob([exported.content], { type: exported.mediaType }));
      const link = document.createElement("a");
      link.href = url;
      link.download = exported.fileName;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`Exported ${exported.rowCount} filtered transactions as a safe UTF-8 CSV file.`);
    } catch {
      setStatus("error");
      setMessage(
        "The filtered transaction export could not be created. Existing data was unchanged.",
      );
    }
  };

  return (
    <div className="transaction-page">
      <section className="import-heading" aria-labelledby="transactions-title">
        <p className="eyebrow">Canonical local ledger</p>
        <h1 id="transactions-title">Review every transaction and trace it to its source.</h1>
        <p className="hero-copy">
          Filters, categories, duplicate decisions, and undo remain entirely on this device.
        </p>
      </section>

      <TransferReviewSection
        proposals={proposals}
        accounts={accounts}
        onConfirm={async (proposal) => {
          await services.confirmTransferProposalUseCase.execute(proposal);
          await refresh();
        }}
        onReject={async (proposal) => {
          await services.rejectTransferProposalUseCase.execute(proposal);
          await refresh();
        }}
      />

      <RecurringReviewSection
        proposals={recurringProposals}
        onConfirm={async (proposal) => {
          await services.confirmRecurringProposalUseCase.execute(proposal);
          await refresh();
        }}
        onDismiss={async (proposal) => {
          await services.dismissRecurringProposalUseCase.execute(proposal);
          await refresh();
        }}
        onMute={async (proposal) => {
          await services.muteRecurringProposalUseCase.execute(proposal);
          await refresh();
        }}
      />

      <section className="import-panel" aria-labelledby="global-filters-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Shared query</p>
            <h2 id="global-filters-title">Summary and ledger filters</h2>
          </div>
        </div>
        <div className="ledger-filters">
          <label>
            Account
            <select
              value={accountId}
              onChange={(event) => {
                setAccountId(event.currentTarget.value);
                setCurrency("");
                setPageIndex(0);
              }}
            >
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.currency}
                </option>
              ))}
            </select>
          </label>
          <label>
            From date
            <input
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.currentTarget.value);
                setPageIndex(0);
              }}
            />
          </label>
          <label>
            To date
            <input
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.currentTarget.value);
                setPageIndex(0);
              }}
            />
          </label>
          <label>
            Currency
            <select
              value={currency}
              onChange={(event) => {
                setCurrency(event.currentTarget.value);
                setPageIndex(0);
              }}
            >
              <option value="">All currencies (kept separate)</option>
              {availableCurrencies.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.currentTarget.value);
                setPageIndex(0);
              }}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setAccountId("");
              setFromDate("");
              setToDate("");
              setCurrency("");
              setCategoryId("");
              setPageIndex(0);
            }}
          >
            Reset shared filters
          </button>
          <button type="button" onClick={() => void exportCurrentQuery()}>
            Export filtered CSV
          </button>
        </div>
      </section>

      <CashFlowSummaryView
        key={JSON.stringify(sharedFilter)}
        report={summary}
        accountById={new Map(accounts.map((account) => [account.id, account]))}
        transactionById={transactionById}
        unresolvedDuplicateCount={
          duplicates.filter((candidate) => !decisions.has(candidate.id)).length
        }
      />

      <DuplicateReview
        candidates={duplicates}
        decisions={decisions}
        transactionById={transactionById}
        onResolve={async (candidate, action) => {
          await services.resolveDuplicate.execute({
            candidateId: candidate.id,
            evidenceSignature: duplicateEvidenceSignature(candidate),
            action,
          });
          await refresh();
          setMessage("Duplicate decision saved. Both source records remain auditable.");
        }}
        onUndo={async (decisionId) => {
          await services.undoDuplicateResolution.execute(decisionId);
          await refresh();
          setMessage("Duplicate decision undone.");
        }}
      />

      <CategorizationReviewQueue services={services} categories={categories} onRefresh={refresh} />

      <BrainManagementView services={services} onRefresh={refresh} />

      <section className="import-panel" aria-labelledby="ledger-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Transactions</p>
            <h2 id="ledger-title">Ledger</h2>
          </div>
          <span className="storage-chip">{page.total} records</span>
        </div>
        <div className="ledger-filters">
          <label>
            Search
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.currentTarget.value);
                setPageIndex(0);
              }}
            />
          </label>
          <label>
            Direction
            <select
              value={direction}
              onChange={(event) => {
                setDirection(event.currentTarget.value as typeof direction);
                setPageIndex(0);
              }}
            >
              <option value="">All</option>
              <option value="inflow">Money in</option>
              <option value="outflow">Money out</option>
            </select>
          </label>
          <label>
            Review state
            <select
              value={reviewState}
              onChange={(event) => {
                setReviewState(event.currentTarget.value);
                setPageIndex(0);
              }}
            >
              <option value="">All</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="needsReview">Needs review</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </label>
          <label>
            Sort
            <select
              value={sortField}
              onChange={(event) =>
                setSortField(event.currentTarget.value as TransactionLedgerSortField)
              }
            >
              <option value="postedDate">Date</option>
              <option value="amount">Amount</option>
              <option value="description">Description</option>
              <option value="reviewState">Review state</option>
            </select>
          </label>
          <label>
            Sort direction
            <select
              value={sortDirection}
              onChange={(event) =>
                setSortDirection(event.currentTarget.value as typeof sortDirection)
              }
            >
              <option value="descending">Descending</option>
              <option value="ascending">Ascending</option>
            </select>
          </label>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setSearch("");
              setDirection("");
              setReviewState("");
              setSortField("postedDate");
              setSortDirection("descending");
              setPageIndex(0);
            }}
          >
            Reset ledger filters
          </button>
        </div>

        {message !== undefined && (
          <p role="status" className={status === "error" ? "error-message" : "mapping-status"}>
            {message}
          </p>
        )}
        {status === "loading" && <p role="status">Loading the local ledger…</p>}
        {status !== "loading" && page.items.length === 0 ? (
          <p>No transactions match these filters.</p>
        ) : (
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Transaction ledger">
            <table>
              <caption>
                Canonical transactions, page {pageIndex + 1} of {pageCount}
              </caption>
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => (
                      <th key={header.id} scope="col">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="preview-actions">
          <button
            type="button"
            disabled={pageIndex === 0}
            onClick={() => setPageIndex((value) => value - 1)}
          >
            Previous page
          </button>
          <span>
            Page {pageIndex + 1} of {pageCount}
          </span>
          <button
            type="button"
            disabled={pageIndex + 1 >= pageCount}
            onClick={() => setPageIndex((value) => value + 1)}
          >
            Next page
          </button>
        </div>
      </section>

      <section className="import-panel" aria-labelledby="bulk-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Reversible action</p>
            <h2 id="bulk-title">Bulk review</h2>
          </div>
          <span className="storage-chip">{selected.size} selected</span>
        </div>
        <div className="bulk-controls">
          <label>
            Assign category
            <select
              value={bulkCategory}
              onChange={(event) => setBulkCategory(event.currentTarget.value)}
            >
              <option value="">No category change</option>
              {categories
                .filter((category) => !category.archived)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Set review state
            <select
              value={bulkReviewState}
              onChange={(event) => setBulkReviewState(event.currentTarget.value)}
            >
              <option value="">No review change</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="needsReview">Needs review</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </label>
          <button
            type="button"
            disabled={selected.size === 0 || (bulkCategory === "" && bulkReviewState === "")}
            onClick={() => void previewBulk()}
          >
            Preview affected count
          </button>
          {previewCount !== undefined && (
            <>
              <span role="status">
                This will change {previewCount} transaction{previewCount === 1 ? "" : "s"}.
              </span>
              <button
                type="button"
                onClick={() =>
                  void applyEdit([...selected], bulkEdit(bulkCategory, bulkReviewState, categories))
                }
              >
                Apply bulk change
              </button>
            </>
          )}
          {lastOperation !== undefined && (
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void services.undoBulkTransactionEdit.execute(lastOperation.id).then(refresh)
              }
            >
              Undo last bulk change
            </button>
          )}
        </div>
      </section>

      <CategoryManager categories={categories} services={services} onChanged={refresh} />
    </div>
  );
}

function CashFlowSummaryView({
  report,
  accountById,
  transactionById,
  unresolvedDuplicateCount,
}: {
  readonly report: CashFlowReport;
  readonly accountById: ReadonlyMap<string, Account>;
  readonly transactionById: ReadonlyMap<string, Transaction>;
  readonly unresolvedDuplicateCount: number;
}) {
  return (
    <section className="import-panel cash-flow-summary" aria-labelledby="cash-flow-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Deterministic facts</p>
          <h2 id="cash-flow-title">Cash-flow summary</h2>
        </div>
        <span className="storage-chip">{report.filterSummary}</span>
      </div>
      {report.mixedCurrencies && (
        <p className="summary-warning" role="status">
          Multiple currencies are shown separately. No exchange rate or cross-currency total is
          implied.
        </p>
      )}
      {unresolvedDuplicateCount > 0 && (
        <p className="summary-warning" role="status">
          {unresolvedDuplicateCount} unresolved duplicate candidate(s) may affect these totals.
          Review the overlap choices below before relying on the summary.
        </p>
      )}
      {report.currencies.length === 0 ? (
        <p>No transactions match the shared summary filters.</p>
      ) : (
        <div className="cash-flow-currencies">
          {report.currencies.map((currencyReport) => {
            const titleId = `cash-flow-${currencyReport.currency.toLowerCase()}`;
            const period = describePeriod(currencyReport.months.map(({ month }) => month));
            return (
              <article key={currencyReport.currency} aria-labelledby={titleId}>
                <div className="summary-context">
                  <h3 id={titleId}>{currencyReport.currency} cash flow</h3>
                  <p>
                    Period: {period} · Currency: {currencyReport.currency} · Filters:{" "}
                    {report.filterSummary}
                  </p>
                </div>
                <div className="metric-grid">
                  <SummaryMetric
                    label="Income"
                    value={currencyReport.income}
                    currency={currencyReport.currency}
                    drilldownTitle={`${currencyReport.currency} income`}
                    transactionIds={currencyReport.incomeTransactionIds}
                    transactionById={transactionById}
                  />
                  <SummaryMetric
                    label="Spending"
                    value={currencyReport.spending}
                    currency={currencyReport.currency}
                    drilldownTitle={`${currencyReport.currency} spending`}
                    transactionIds={currencyReport.spendingTransactionIds}
                    transactionById={transactionById}
                  />
                  <SummaryMetric
                    label="Transfer activity excluded"
                    value={currencyReport.transfers}
                    currency={currencyReport.currency}
                    drilldownTitle={`${currencyReport.currency} excluded transfer activity`}
                    transactionIds={currencyReport.transferTransactionIds}
                    transactionById={transactionById}
                  />
                  <SummaryMetric
                    label="Net cash flow"
                    value={currencyReport.netCashFlow}
                    currency={currencyReport.currency}
                    drilldownTitle={`${currencyReport.currency} net cash flow`}
                    transactionIds={currencyReport.cashFlowTransactionIds}
                    transactionById={transactionById}
                  />
                </div>
                <p className="summary-takeaway">{currencyReport.takeaway}</p>
                {(currencyReport.unresolvedReviewCount > 0 ||
                  currencyReport.excludedVoidCount > 0) && (
                  <p className="summary-warning">
                    {currencyReport.unresolvedReviewCount} included transaction(s) still need
                    review. {currencyReport.excludedVoidCount} void transaction(s) were excluded.
                  </p>
                )}

                <h4>Monthly cash flow</h4>
                <MonthlyCashFlowChart report={currencyReport} />
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label={`${currencyReport.currency} monthly cash-flow data`}
                >
                  <table>
                    <caption>
                      Monthly cash flow · {period} · {currencyReport.currency} ·{" "}
                      {report.filterSummary}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Month</th>
                        <th scope="col">Period status</th>
                        <th scope="col">Income</th>
                        <th scope="col">Spending</th>
                        <th scope="col">Transfers excluded</th>
                        <th scope="col">Net cash flow</th>
                        <th scope="col">Records</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currencyReport.months.map((month) => (
                        <tr key={month.month}>
                          <th scope="row">{month.month}</th>
                          <td>{month.incomplete ? "Incomplete" : "Complete"}</td>
                          <td>{formatAmount(currencyReport.currency, month.income)}</td>
                          <td>{formatAmount(currencyReport.currency, month.spending)}</td>
                          <td>{formatAmount(currencyReport.currency, month.transfers)}</td>
                          <td>{formatAmount(currencyReport.currency, month.netCashFlow)}</td>
                          <td>
                            <TransactionDrilldownDisclosure
                              title={`${month.month} ${currencyReport.currency} cash flow`}
                              transactionIds={month.transactionIds}
                              transactionById={transactionById}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h4>Cash flow by account</h4>
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label={`${currencyReport.currency} account cash-flow data`}
                >
                  <table>
                    <caption>
                      Account cash flow · {period} · {currencyReport.currency} ·{" "}
                      {report.filterSummary}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Account</th>
                        <th scope="col">Income</th>
                        <th scope="col">Spending</th>
                        <th scope="col">Transfers excluded</th>
                        <th scope="col">Net cash flow</th>
                        <th scope="col">Records</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currencyReport.accounts.map((account) => (
                        <tr key={account.accountId}>
                          <th scope="row">
                            {accountById.get(account.accountId)?.name ?? "Unknown account"}
                          </th>
                          <td>{formatAmount(currencyReport.currency, account.income)}</td>
                          <td>{formatAmount(currencyReport.currency, account.spending)}</td>
                          <td>{formatAmount(currencyReport.currency, account.transfers)}</td>
                          <td>{formatAmount(currencyReport.currency, account.netCashFlow)}</td>
                          <td>
                            <TransactionDrilldownDisclosure
                              title={`${accountById.get(account.accountId)?.name ?? "Unknown account"} cash flow in ${currencyReport.currency}`}
                              transactionIds={account.transactionIds}
                              transactionById={transactionById}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h4>Spending by category</h4>
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label={`${currencyReport.currency} category spending data`}
                >
                  <table>
                    <caption>
                      Category spending · {period} · {currencyReport.currency} ·{" "}
                      {report.filterSummary}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Category</th>
                        <th scope="col">Spending</th>
                        <th scope="col">Records</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currencyReport.categories.map((category) => (
                        <tr key={category.categoryId ?? "uncategorized"}>
                          <th scope="row">{category.categoryName}</th>
                          <td>{formatAmount(currencyReport.currency, category.spending)}</td>
                          <td>
                            <TransactionDrilldownDisclosure
                              title={`${category.categoryName} spending in ${currencyReport.currency}`}
                              transactionIds={category.transactionIds}
                              transactionById={transactionById}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SummaryMetric({
  label,
  value,
  currency,
  drilldownTitle,
  transactionIds,
  transactionById,
}: {
  readonly label: string;
  readonly value: string;
  readonly currency: string;
  readonly drilldownTitle: string;
  readonly transactionIds: readonly string[];
  readonly transactionById: ReadonlyMap<string, Transaction>;
}) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{formatAmount(currency, value)}</strong>
      <TransactionDrilldownDisclosure
        title={drilldownTitle}
        transactionIds={transactionIds}
        transactionById={transactionById}
        compact
      />
    </div>
  );
}

function TransactionDrilldownDisclosure({
  title,
  transactionIds,
  transactionById,
  compact = false,
}: {
  readonly title: string;
  readonly transactionIds: readonly string[];
  readonly transactionById: ReadonlyMap<string, Transaction>;
  readonly compact?: boolean;
}) {
  return (
    <details className="transaction-drilldown">
      <summary>
        {compact
          ? "View contributing transactions"
          : `View ${transactionIds.length} transaction(s)`}
      </summary>
      <p>These are the exact canonical records contributing to the selected fact.</p>
      <ol className="drilldown-list" aria-label={title}>
        {transactionIds.map((id) => {
          const transaction = transactionById.get(id);
          if (transaction === undefined) return null;
          const money = transaction.money.toJSON();
          return (
            <li key={transaction.id}>
              <strong>{transaction.description}</strong>
              <span>{transaction.postedDate}</span>
              <span>{formatAmount(money.currency, money.amount)}</span>
              <span>Review: {transaction.reviewState}</span>
              <span>Source: {transaction.provenance.sourceLocation}</span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

function MonthlyCashFlowChart({
  report,
}: {
  readonly report: CashFlowReport["currencies"][number];
}) {
  const values = report.months.flatMap(({ income, spending }) => [
    Number(income),
    Number(spending),
  ]);
  const maximum = Math.max(1, ...values);
  const width = 720;
  const height = 180;
  const groupWidth = width / Math.max(1, report.months.length);
  return (
    <svg
      className="summary-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby={`chart-${report.currency}-title chart-${report.currency}-description`}
    >
      <title id={`chart-${report.currency}-title`}>
        Monthly income and spending in {report.currency}
      </title>
      <desc id={`chart-${report.currency}-description`}>
        Visual comparison only. The adjacent table contains exact values and incomplete-period
        markers.
      </desc>
      {report.months.map((month, index) => {
        const incomeHeight = (Number(month.income) / maximum) * 130;
        const spendingHeight = (Number(month.spending) / maximum) * 130;
        const x = index * groupWidth + groupWidth * 0.2;
        return (
          <g key={month.month}>
            <rect
              className="chart-income"
              x={x}
              y={150 - incomeHeight}
              width={groupWidth * 0.25}
              height={incomeHeight}
            />
            <rect
              className="chart-spending"
              x={x + groupWidth * 0.3}
              y={150 - spendingHeight}
              width={groupWidth * 0.25}
              height={spendingHeight}
            />
            <text x={x} y={170} fontSize="11">
              {month.month}
              {month.incomplete ? "*" : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function createCashFlowFilter(
  accountId: string,
  currency: string,
  categoryId: string,
  fromDate: string,
  toDate: string,
): CashFlowFilter {
  return {
    ...(accountId === "" ? {} : { accountIds: [accountId] }),
    ...(currency === "" ? {} : { currencies: [currency] }),
    ...(categoryId === "" ? {} : { categoryIds: [categoryId] }),
    ...(fromDate === "" ? {} : { fromDate }),
    ...(toDate === "" ? {} : { toDate }),
  };
}

function describePeriod(months: readonly string[]): string {
  if (months.length === 0) return "No matching period";
  return months.length === 1 ? months[0]! : `${months[0]} to ${months.at(-1)}`;
}

function formatAmount(currency: string, amount: string): string {
  return `${currency} ${amount}`;
}

function TransactionDetails({
  transaction,
  onSave,
  onLoadHistory,
}: {
  readonly transaction: Transaction;
  readonly onSave: (edit: {
    readonly notes?: string | null;
    readonly tags?: readonly string[];
    readonly reviewState?: "unreviewed" | "needsReview" | "reviewed";
  }) => Promise<void>;
  readonly onLoadHistory: () => Promise<readonly BulkTransactionOperation[]>;
}) {
  const [notes, setNotes] = useState(transaction.notes ?? "");
  const [tags, setTags] = useState(transaction.tags.join(", "));
  const [history, setHistory] = useState<readonly BulkTransactionOperation[]>();
  return (
    <details>
      <summary>Source details</summary>
      <dl className="provenance-list">
        <div>
          <dt>Import</dt>
          <dd>{transaction.importId}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{transaction.provenance.sourceLocation}</dd>
        </div>
        <div>
          <dt>Parser</dt>
          <dd>
            {transaction.provenance.parserId} · {transaction.provenance.parserVersion}
          </dd>
        </div>
        <div>
          <dt>Original values</dt>
          <dd>
            <pre>{JSON.stringify(transaction.provenance.original, null, 2)}</pre>
          </dd>
        </div>
        <div>
          <dt>Transformations</dt>
          <dd>{transaction.provenance.transformations.join(", ") || "None"}</dd>
        </div>
      </dl>
      <h4>Edit history</h4>
      {history === undefined ? (
        <button type="button" onClick={() => void onLoadHistory().then(setHistory)}>
          Load edit history
        </button>
      ) : history.length === 0 ? (
        <p>No manual edits have been recorded.</p>
      ) : (
        <ol aria-label={`Edit history for ${transaction.description}`}>
          {history.map((operation) => (
            <li key={operation.id}>
              {operation.createdAt} · manual edit
              {operation.undoneAt === undefined ? "" : ` · undone ${operation.undoneAt}`}
            </li>
          ))}
        </ol>
      )}
      <label>
        Notes
        <textarea
          value={notes}
          maxLength={2000}
          onChange={(event) => setNotes(event.currentTarget.value)}
        />
      </label>
      <label>
        Tags, comma separated
        <input value={tags} onChange={(event) => setTags(event.currentTarget.value)} />
      </label>
      <button
        type="button"
        onClick={() =>
          void onSave({
            notes: notes === "" ? null : notes,
            tags: tags
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          })
        }
      >
        Save notes and tags
      </button>
    </details>
  );
}

function DuplicateReview({
  candidates,
  decisions,
  transactionById,
  onResolve,
  onUndo,
}: {
  readonly candidates: readonly DuplicateCandidate[];
  readonly decisions: ReadonlyMap<string, DuplicateDecision>;
  readonly transactionById: ReadonlyMap<string, Transaction>;
  readonly onResolve: (
    candidate: DuplicateCandidate,
    action: "keep-existing" | "keep-new" | "keep-both" | "manual-link",
  ) => Promise<void>;
  readonly onUndo: (decisionId: string) => Promise<void>;
}) {
  return (
    <section className="import-panel" aria-labelledby="duplicates-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Overlap safety</p>
          <h2 id="duplicates-title">Duplicate review</h2>
        </div>
        <span className="storage-chip">{candidates.length} candidates</span>
      </div>
      {candidates.length === 0 ? (
        <p>No exact or likely duplicates were found in the latest import.</p>
      ) : (
        <ol className="duplicate-list">
          {candidates.map((candidate) => {
            const existing = transactionById.get(candidate.existingTransactionId);
            const incoming = transactionById.get(candidate.incomingTransactionId);
            const decision = decisions.get(candidate.id);
            if (existing === undefined || incoming === undefined) return null;
            return (
              <li key={candidate.id}>
                <h3>
                  {candidate.kind === "exact" ? "Exact evidence" : "Likely match"} ·{" "}
                  {(candidate.score / 100).toFixed(0)}%
                </h3>
                <div className="duplicate-comparison">
                  <TransactionSummary label="Existing" transaction={existing} />
                  <TransactionSummary label="New" transaction={incoming} />
                </div>
                <ul>
                  {candidate.evidence.map((evidence) => (
                    <li key={evidence.code}>{evidence.detail}</li>
                  ))}
                </ul>
                {decision === undefined ? (
                  <div className="preview-actions">
                    <button
                      type="button"
                      onClick={() => void onResolve(candidate, "keep-existing")}
                    >
                      Keep existing
                    </button>
                    <button type="button" onClick={() => void onResolve(candidate, "keep-new")}>
                      Keep new
                    </button>
                    <button type="button" onClick={() => void onResolve(candidate, "keep-both")}>
                      Keep both
                    </button>
                    <button type="button" onClick={() => void onResolve(candidate, "manual-link")}>
                      Link manually
                    </button>
                  </div>
                ) : (
                  <div className="preview-actions">
                    <span className="ready-status">Decision: {decision.action}</span>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void onUndo(decision.id)}
                    >
                      Undo decision
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function TransactionSummary({
  label,
  transaction,
}: {
  readonly label: string;
  readonly transaction: Transaction;
}) {
  const money = transaction.money.toJSON();
  return (
    <div>
      <strong>{label}</strong>
      <span>{transaction.postedDate}</span>
      <span>{transaction.description}</span>
      <span>
        {money.currency} {money.amount}
      </span>
      <span>{transaction.provenance.sourceLocation}</span>
    </div>
  );
}

function CategoryManager({
  categories,
  services,
  onChanged,
}: {
  readonly categories: readonly Category[];
  readonly services: ApplicationServices;
  readonly onChanged: () => Promise<void>;
}) {
  const submit = async (event: FormEvent<HTMLFormElement>, category: Category) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("name");
    if (typeof value === "string") {
      await services.renameCategory.execute(category.id, value);
      await onChanged();
    }
  };
  return (
    <section className="import-panel" aria-labelledby="categories-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Stable IDs, editable labels</p>
          <h2 id="categories-title">Categories</h2>
        </div>
        <span className="storage-chip">{categories.length} local</span>
      </div>
      <ul className="category-list">
        {categories.map((category) => (
          <li key={category.id}>
            <form onSubmit={(event) => void submit(event, category)}>
              <label>
                Rename {category.name}
                <input name="name" defaultValue={category.name} maxLength={120} />
              </label>
              <button type="submit">Save label</button>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  void services.setCategoryArchived
                    .execute(category.id, !category.archived)
                    .then(onChanged)
                }
              >
                {category.archived ? "Restore" : "Archive"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

function bulkEdit(categoryId: string, reviewState: string, categories: readonly Category[]) {
  return {
    ...(categoryId === ""
      ? {}
      : { category: categories.find((category) => category.id === categoryId)!.id }),
    ...(reviewState === ""
      ? {}
      : { reviewState: reviewState as "unreviewed" | "needsReview" | "reviewed" }),
  };
}

function CategorizationReviewQueue({
  services,
  categories,
  onRefresh,
}: {
  readonly services: ApplicationServices;
  readonly categories: readonly Category[];
  readonly onRefresh: () => Promise<void>;
}) {
  const [queue, setQueue] = useState<ReviewQueueQueryResult>();
  const [filterReason, setFilterReason] = useState<ReviewReason | "">("");
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [targetCategory, setTargetCategory] = useState("");
  const [correctionMode, setCorrectionMode] = useState<"one-off" | "reusable-rule">("one-off");
  const [ruleName, setRuleName] = useState("");
  const [highImpactConfirmed, setHighImpactConfirmed] = useState(false);
  const [ruleImpact, setRuleImpact] = useState<RuleImpactPreview>();
  const [message, setMessage] = useState<string>();
  const [lastOpId, setLastOpId] = useState<string>();

  useEffect(() => {
    let active = true;
    void services.queryReviewQueue
      .execute(filterReason === "" ? {} : { reason: filterReason })
      .then((res) => {
        if (active) setQueue(res);
      });
    return () => {
      active = false;
    };
  }, [filterReason, services]);

  useEffect(() => {
    if (!modalOpen || correctionMode !== "reusable-rule" || targetCategory === "") {
      return;
    }
    let active = true;
    void services.previewRuleImpactUseCase.execute([]).then((impact) => {
      if (active) setRuleImpact(impact);
    });
    return () => {
      active = false;
    };
  }, [modalOpen, correctionMode, targetCategory, services]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAllVisible = () => {
    if (queue === undefined) return;
    setSelectedIds(new Set(queue.items.map((i) => i.transactionId)));
  };

  const deselectAll = () => setSelectedIds(new Set());

  const handleApplyCorrection = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0 || targetCategory === "") return;

    try {
      const categoryId = parseCategoryId(targetCategory);
      const transactionIds = Array.from(selectedIds).map((id) => parseTransactionId(id));

      const res = await services.applyReviewCorrectionUseCase.execute({
        transactionIds,
        categoryId,
        ...(correctionMode === "reusable-rule" && ruleName.trim() !== ""
          ? {
              createRule: {
                name: ruleName.trim(),
                conditions: [
                  {
                    field: "normalizedDescription" as const,
                    operator: "startsWith" as const,
                    value:
                      queue?.items.find((i) => selectedIds.has(i.transactionId))
                        ?.normalizedDescription ?? "",
                  },
                ],
                actions: [{ type: "setCategory" as const, value: categoryId }],
              },
            }
          : {}),
      });

      setLastOpId(res.operationId);
      setSelectedIds(new Set());
      setModalOpen(false);
      setRuleName("");
      setHighImpactConfirmed(false);

      const refreshedQueue = await services.queryReviewQueue.execute(
        filterReason === "" ? {} : { reason: filterReason },
      );
      setQueue(refreshedQueue);

      await onRefresh();
      setMessage(
        `Corrected ${res.updatedCount} transaction(s) successfully.${res.createdRuleId ? " Created reusable classification rule." : ""}`,
      );
    } catch {
      setMessage("Error applying categorization correction.");
    }
  };

  const handleUndoLast = async () => {
    if (lastOpId === undefined) return;
    try {
      await services.undoBulkTransactionEdit.execute(lastOpId);
      setLastOpId(undefined);
      const refreshedQueue = await services.queryReviewQueue.execute(
        filterReason === "" ? {} : { reason: filterReason },
      );
      setQueue(refreshedQueue);
      await onRefresh();
      setMessage("Undone last categorization correction.");
    } catch {
      setMessage("Failed to undo correction.");
    }
  };

  if (queue === undefined) return null;

  return (
    <section className="import-panel" aria-labelledby="review-queue-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Explainable Learning</p>
          <h2 id="review-queue-title">Categorization review queue</h2>
        </div>
        <span className="storage-chip">{queue.totalCount} items needing review</span>
      </div>

      {message && (
        <p role="status" className="mapping-status" aria-live="polite">
          {message}
        </p>
      )}

      <div className="ledger-filters" style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          className={filterReason === "" ? "primary-button" : "secondary-button"}
          onClick={() => setFilterReason("")}
        >
          All ({queue.totalCount})
        </button>
        <button
          type="button"
          className={filterReason === "unclassified" ? "primary-button" : "secondary-button"}
          onClick={() => setFilterReason("unclassified")}
        >
          Unclassified ({queue.countsByReason.unclassified})
        </button>
        <button
          type="button"
          className={filterReason === "rule-conflict" ? "primary-button" : "secondary-button"}
          onClick={() => setFilterReason("rule-conflict")}
        >
          Rule Conflict ({queue.countsByReason["rule-conflict"]})
        </button>
        <button
          type="button"
          className={filterReason === "merchant-collision" ? "primary-button" : "secondary-button"}
          onClick={() => setFilterReason("merchant-collision")}
        >
          Merchant Collision ({queue.countsByReason["merchant-collision"]})
        </button>
        <button
          type="button"
          className={filterReason === "low-confidence" ? "primary-button" : "secondary-button"}
          onClick={() => setFilterReason("low-confidence")}
        >
          Low Confidence ({queue.countsByReason["low-confidence"]})
        </button>
      </div>

      <div className="preview-actions" style={{ marginBottom: "1rem" }}>
        <button type="button" onClick={selectAllVisible}>
          Select all visible
        </button>
        <button type="button" className="secondary-button" onClick={deselectAll}>
          Deselect all
        </button>
        <button type="button" disabled={selectedIds.size === 0} onClick={() => setModalOpen(true)}>
          Correct selected ({selectedIds.size})
        </button>
        {lastOpId !== undefined && (
          <button type="button" className="secondary-button" onClick={() => void handleUndoLast()}>
            Undo last correction
          </button>
        )}
      </div>

      {queue.items.length === 0 ? (
        <p>No transactions currently require categorization review.</p>
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Review Queue Table">
          <table>
            <thead>
              <tr>
                <th scope="col">Select</th>
                <th scope="col">Date</th>
                <th scope="col">Description</th>
                <th scope="col">Amount</th>
                <th scope="col">Review Reason</th>
                <th scope="col">Explanation</th>
              </tr>
            </thead>
            <tbody>
              {queue.items.map((item) => (
                <tr key={item.transactionId}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.transactionId)}
                      onChange={() => toggleSelect(item.transactionId)}
                      aria-label={`Select ${item.rawDescription}`}
                    />
                  </td>
                  <td>{item.postedDate}</td>
                  <td>
                    <strong>{item.rawDescription}</strong>
                    <br />
                    <small>{item.normalizedDescription}</small>
                  </td>
                  <td>{item.amount.toString()}</td>
                  <td>
                    <span className="storage-chip" style={{ textTransform: "capitalize" }}>
                      {item.reason.replace("-", " ")}
                    </span>
                  </td>
                  <td>{item.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div
          className="import-panel"
          style={{ marginTop: "1.5rem", border: "2px solid var(--forest)" }}
        >
          <h3>Apply Categorization Correction</h3>
          <form onSubmit={(e) => void handleApplyCorrection(e)}>
            <div style={{ display: "grid", gap: "1rem", marginBottom: "1rem" }}>
              <label>
                Target Category:
                <select
                  value={targetCategory}
                  onChange={(e) => setTargetCategory(e.target.value)}
                  required
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset>
                <legend style={{ fontWeight: "bold" }}>Correction Scope</legend>
                <label style={{ display: "block", margin: "0.5rem 0" }}>
                  <input
                    type="radio"
                    name="scope"
                    checked={correctionMode === "one-off"}
                    onChange={() => setCorrectionMode("one-off")}
                  />{" "}
                  One-off Override (Locks selected transactions only)
                </label>
                <label style={{ display: "block", margin: "0.5rem 0" }}>
                  <input
                    type="radio"
                    name="scope"
                    checked={correctionMode === "reusable-rule"}
                    onChange={() => setCorrectionMode("reusable-rule")}
                  />{" "}
                  Create Reusable Rule (Applies to current & future transactions)
                </label>
              </fieldset>

              {correctionMode === "reusable-rule" && (
                <>
                  <label>
                    Rule Name:
                    <input
                      type="text"
                      value={ruleName}
                      onChange={(e) => setRuleName(e.target.value)}
                      placeholder="e.g. Tim Hortons Rule"
                      required
                    />
                  </label>
                  {ruleImpact !== undefined && (
                    <div
                      style={{
                        background: "var(--forest-soft)",
                        padding: "0.75rem",
                        borderRadius: "8px",
                      }}
                    >
                      <strong>Rule Impact Preview:</strong>
                      <p style={{ margin: "0.25rem 0" }}>
                        Matched: {ruleImpact.matchedTransactions} · Locked Exclusions:{" "}
                        {ruleImpact.lockedTransactions} · Conflicts:{" "}
                        {ruleImpact.conflictTransactions}
                      </p>
                      {ruleImpact.matchedTransactions > 10 && (
                        <label
                          style={{ display: "block", marginTop: "0.5rem", fontWeight: "bold" }}
                        >
                          <input
                            type="checkbox"
                            checked={highImpactConfirmed}
                            onChange={(e) => setHighImpactConfirmed(e.target.checked)}
                          />{" "}
                          I confirm applying this rule to over 10 matching transactions
                        </label>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="preview-actions">
              <button
                type="submit"
                disabled={
                  targetCategory === "" ||
                  (correctionMode === "reusable-rule" &&
                    ruleImpact !== undefined &&
                    ruleImpact.matchedTransactions > 10 &&
                    !highImpactConfirmed)
                }
              >
                Apply Correction
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
