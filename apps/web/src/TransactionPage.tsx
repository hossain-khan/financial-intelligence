import type {
  BulkTransactionOperation,
  TransactionLedgerPage,
  TransactionLedgerSortField,
} from "@financial-intelligence/application";
import {
  duplicateEvidenceSignature,
  type Account,
  type Category,
  type DuplicateCandidate,
  type DuplicateDecision,
  type Transaction,
} from "@financial-intelligence/domain";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import type { ApplicationServices } from "./infrastructure";

const EMPTY_PAGE: TransactionLedgerPage = { items: [], total: 0, offset: 0, limit: 50 };

export function TransactionPage({ services }: { readonly services: ApplicationServices }) {
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [accountId, setAccountId] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
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
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [message, setMessage] = useState<string>();

  const refresh = useCallback(async () => {
    const workspaces = await services.listWorkspaces.execute();
    const workspace = workspaces[0];
    const loadedAccounts =
      workspace === undefined ? [] : await services.listAccounts.execute(workspace.id);
    const activeAccounts = loadedAccounts.filter((account) => !account.archived);
    const nextAccountId =
      accountId !== "" && activeAccounts.some((account) => account.id === accountId)
        ? accountId
        : (activeAccounts[0]?.id ?? "");
    const loadedCategories = await services.listCategories.execute();
    const loadedPage = await services.queryTransactionLedger.execute({
      filter: {
        ...(nextAccountId === "" ? {} : { accountIds: [nextAccountId] }),
        ...(search.trim() === "" ? {} : { search }),
        ...(fromDate === "" ? {} : { fromDate }),
        ...(toDate === "" ? {} : { toDate }),
        ...(categoryId === "" ? {} : { categoryIds: [categoryId] }),
        ...(reviewState === ""
          ? {}
          : { reviewStates: [reviewState as "unreviewed" | "needsReview" | "reviewed"] }),
        ...(direction === ""
          ? {}
          : {
              amount:
                direction === "inflow"
                  ? {
                      currency:
                        activeAccounts.find((value) => value.id === nextAccountId)?.currency ??
                        "CAD",
                      minimum: "0",
                    }
                  : {
                      currency:
                        activeAccounts.find((value) => value.id === nextAccountId)?.currency ??
                        "CAD",
                      maximum: "0",
                    },
            }),
      },
      sort: { field: sortField, direction: sortDirection },
      offset: pageIndex * 50,
      limit: 50,
    });
    const transactions =
      nextAccountId === "" ? [] : await services.listTransactions.execute(nextAccountId);
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
    setPage(loadedPage);
    setAllTransactions(transactions);
    setDuplicates(candidates);
    setDecisions(await services.listDuplicateResolutions.execute());
    setStatus("ready");
  }, [
    accountId,
    categoryId,
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

  return (
    <div className="transaction-page">
      <section className="import-heading" aria-labelledby="transactions-title">
        <p className="eyebrow">Canonical local ledger</p>
        <h1 id="transactions-title">Review every transaction and trace it to its source.</h1>
        <p className="hero-copy">
          Filters, categories, duplicate decisions, and undo remain entirely on this device.
        </p>
      </section>

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
            Account
            <select
              value={accountId}
              onChange={(event) => {
                setAccountId(event.currentTarget.value);
                setPageIndex(0);
              }}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.currency}
                </option>
              ))}
            </select>
          </label>
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
            Category
            <select
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.currentTarget.value);
                setPageIndex(0);
              }}
            >
              <option value="">All</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
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
            Direction
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
              setFromDate("");
              setToDate("");
              setDirection("");
              setCategoryId("");
              setReviewState("");
              setPageIndex(0);
            }}
          >
            Reset filters
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
