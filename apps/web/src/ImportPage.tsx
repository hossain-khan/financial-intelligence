import type { Account, StatementImport, Workspace } from "@financial-intelligence/domain";
import {
  createCsvErrorReport,
  createFormatSignature,
  mapCsvSources,
  type CsvMapping,
  type CsvMappingResult,
  type CsvMappingSource,
  type DateFormat,
} from "@financial-intelligence/import-core";
import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";

import type { ApplicationServices } from "./infrastructure";
import { parseCsvFiles } from "./csv-import";
import { loadMappingPreset, saveMappingPreset } from "./mapping-presets";

interface MappingDraft {
  readonly accountId: string;
  readonly postedDateColumn: string;
  readonly transactionDateColumn: string;
  readonly descriptionColumn: string;
  readonly amountKind: "signed" | "debit-credit";
  readonly amountColumn: string;
  readonly debitColumn: string;
  readonly creditColumn: string;
  readonly signedPositiveDirection: "" | "inflow" | "outflow";
  readonly debitDirection: "" | "outflow" | "inflow";
  readonly currencyColumn: string;
  readonly sourceTransactionIdColumn: string;
  readonly statusColumn: string;
  readonly dateFormat: "" | DateFormat;
  readonly decimalSeparator: "." | ",";
  readonly groupSeparator: "none" | "," | "." | "space";
}

const EMPTY_DRAFT: MappingDraft = {
  accountId: "",
  postedDateColumn: "",
  transactionDateColumn: "",
  descriptionColumn: "",
  amountKind: "signed",
  amountColumn: "",
  debitColumn: "",
  creditColumn: "",
  signedPositiveDirection: "",
  debitDirection: "",
  currencyColumn: "",
  sourceTransactionIdColumn: "",
  statusColumn: "",
  dateFormat: "",
  decimalSeparator: ".",
  groupSeparator: ",",
};

export interface ImportPageProperties {
  readonly services: ApplicationServices;
  readonly parseFiles?: typeof parseCsvFiles;
  readonly presetStorage?: Pick<Storage, "getItem" | "setItem">;
  readonly now?: () => string;
}

export function ImportPage({
  services,
  parseFiles = parseCsvFiles,
  presetStorage = localStorage,
  now = () => new Date().toISOString(),
}: ImportPageProperties) {
  const [workspaces, setWorkspaces] = useState<readonly Workspace[]>([]);
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [sources, setSources] = useState<readonly CsvMappingSource[]>([]);
  const [draft, setDraft] = useState<MappingDraft>(EMPTY_DRAFT);
  const [status, setStatus] = useState<"loading" | "ready" | "parsing" | "error">("loading");
  const [message, setMessage] = useState<string>();
  const [presetMessage, setPresetMessage] = useState<string>();
  const [history, setHistory] = useState<readonly StatementImport[]>([]);
  const [commitStatus, setCommitStatus] = useState<"idle" | "committing" | "committed" | "error">(
    "idle",
  );
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    let current = true;
    void services.listWorkspaces
      .execute()
      .then(async (loadedWorkspaces) => {
        const workspace = loadedWorkspaces[0];
        const loadedAccounts =
          workspace === undefined ? [] : await services.listAccounts.execute(workspace.id);
        if (!current) return;
        setWorkspaces(loadedWorkspaces);
        setAccounts(loadedAccounts.filter((account) => !account.archived));
        setStatus("ready");
      })
      .catch(() => {
        if (!current) return;
        setMessage("Local accounts could not be loaded. Your existing data was not changed.");
        setStatus("error");
      });
    return () => {
      current = false;
    };
  }, [services]);

  const headers = useMemo(() => {
    const firstRow = sources[0]?.rows[0];
    return firstRow === undefined ? [] : Object.keys(firstRow.fields);
  }, [sources]);
  const selectedAccount = accounts.find((account) => account.id === draft.accountId);
  const historyAccount = selectedAccount ?? accounts[0];
  const mapping = useMemo(
    () => createMapping(draft, selectedAccount, headers),
    [draft, selectedAccount, headers],
  );
  const mapped = useMemo(
    () => (mapping === undefined ? undefined : mapCsvSources(sources, mapping)),
    [mapping, sources],
  );

  useEffect(() => {
    if (historyAccount === undefined) {
      return;
    }
    let current = true;
    void services.listImportHistory
      .execute(historyAccount.id)
      .then((imports) => {
        if (current) setHistory(imports);
      })
      .catch(() => {
        if (current) {
          setMessage("Import history could not be loaded. Existing data was not changed.");
        }
      });
    return () => {
      current = false;
    };
  }, [historyAccount, services]);

  const acceptFiles = async (files: readonly File[]) => {
    setStatus("parsing");
    setMessage(undefined);
    setPresetMessage(undefined);
    setSources([]);
    try {
      const parsed = await parseFiles(files);
      setSources(parsed);
      setStatus("ready");
      const first = parsed[0];
      const firstRow = first?.rows[0];
      const nextHeaders = firstRow === undefined ? [] : Object.keys(firstRow.fields);
      const suggested = suggestDraft(nextHeaders, draft.accountId);
      if (first !== undefined && nextHeaders.length > 0) {
        const signature = createFormatSignature(nextHeaders, first.parserId, first.parserVersion);
        const preset = loadMappingPreset(
          presetStorage,
          signature,
          first.parserId,
          first.parserVersion,
        );
        if (preset !== undefined) {
          setDraft(draftFromPreset(preset.mapping, draft.accountId));
          setPresetMessage(
            "A compatible mapping preset was restored. Review it before confirming.",
          );
          return;
        }
      }
      setDraft(suggested);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "The selected CSV files could not be parsed.",
      );
    }
  };

  const onFilesChanged = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files;
    if (files !== null) void acceptFiles([...files]);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    void acceptFiles([...event.dataTransfer.files]);
  };

  const confirmMapping = async () => {
    const first = sources[0];
    const workspace = workspaces[0];
    if (
      mapping === undefined ||
      mapped?.canContinue !== true ||
      first === undefined ||
      workspace === undefined
    )
      return;
    setCommitStatus("committing");
    setMessage(undefined);
    try {
      const result = await services.commitAcceptedImport.execute({
        workspaceId: workspace.id,
        accountId: mapping.accountId,
        sources: sources.map((source) => ({
          fileName: source.metadata.fileName,
          mediaType: source.metadata.mediaType,
          byteSize: source.metadata.byteSize,
          sha256: source.metadata.sha256,
          parserId: source.parserId,
          parserVersion: source.parserVersion,
          sourceRows: source.rows.length,
          issues: source.issues,
        })),
        candidates: mapped.candidates.map((candidate) => ({
          accountId: candidate.accountId,
          postedDate: candidate.postedDate,
          ...(candidate.transactionDate === undefined
            ? {}
            : { transactionDate: candidate.transactionDate }),
          description: candidate.description,
          amount: candidate.amount,
          currency: candidate.currency,
          ...(candidate.sourceTransactionId === undefined
            ? {}
            : { sourceTransactionId: candidate.sourceTransactionId }),
          ...(candidate.status === undefined ? {} : { status: candidate.status }),
          provenance: {
            sourceFileSha256: candidate.provenance.sourceFileSha256,
            sourceLocation: candidate.provenance.sourceLocation,
            parserId: candidate.provenance.parserId,
            parserVersion: candidate.provenance.parserVersion,
            mappingVersion: candidate.provenance.mappingVersion,
            original: { ...candidate.provenance.original },
          },
        })),
        mapping: mappingSummary(mapping),
      });
      const signature = createFormatSignature(headers, first.parserId, first.parserVersion);
      saveMappingPreset(presetStorage, {
        formatSignature: signature,
        parserId: first.parserId,
        parserVersion: first.parserVersion,
        mapping,
        now: now(),
      });
      setHistory(await services.listImportHistory.execute(mapping.accountId));
      setCommitStatus("committed");
      setPresetMessage(
        `Committed ${result.transactionCount} transaction${result.transactionCount === 1 ? "" : "s"} atomically at local revision ${result.committedRevision}.`,
      );
    } catch (error) {
      setCommitStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "The import could not be committed. No partial transactions were saved.",
      );
    }
  };

  return (
    <div className="import-page">
      <section className="import-heading" aria-labelledby="import-title">
        <p className="eyebrow">Local CSV import</p>
        <h1 id="import-title">Map every transaction before it enters your ledger.</h1>
        <p className="hero-copy">
          Files are parsed in a dedicated browser worker. This preview does not write canonical
          transactions.
        </p>
      </section>

      <section className="import-panel" aria-labelledby="source-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Step 1</p>
            <h2 id="source-title">Choose CSV statements</h2>
          </div>
          <span className="storage-chip">Local worker</span>
        </div>
        <div
          className={`file-drop-zone${dragActive ? " is-dragging" : ""}`}
          onDragEnter={() => setDragActive(true)}
          onDragLeave={() => setDragActive(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
        >
          <label htmlFor="csv-files">Select one or more bounded CSV files</label>
          <input
            id="csv-files"
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            multiple
            onChange={onFilesChanged}
          />
          <span>or drag and drop files here</span>
        </div>
        <p className="privacy-copy">
          Raw statement contents remain in this browser and are not saved by this preview.
        </p>
        {status === "parsing" && <p role="status">Parsing selected files locally…</p>}
        {message !== undefined && (
          <p className="error-message" role="alert">
            {message}
          </p>
        )}
        {sources.length > 0 && (
          <p className="success-message" role="status">
            Parsed {sources.length} source file{sources.length === 1 ? "" : "s"} containing{" "}
            {sources.reduce((count, source) => count + source.rows.length, 0)} rows.
          </p>
        )}
      </section>

      {sources.length > 0 && (
        <MappingForm
          accounts={accounts}
          draft={draft}
          headers={headers}
          workspaceExists={workspaces.length > 0}
          onChange={setDraft}
        />
      )}

      {sources.length > 0 && (
        <Preview
          result={mapped}
          mappingReady={mapping !== undefined}
          isCommitting={commitStatus === "committing"}
          onConfirm={() => void confirmMapping()}
        />
      )}

      {presetMessage !== undefined && (
        <p className="mapping-status" role="status">
          {presetMessage}
        </p>
      )}
      {historyAccount !== undefined && <ImportHistory imports={history} account={historyAccount} />}
    </div>
  );
}

function MappingForm({
  accounts,
  draft,
  headers,
  workspaceExists,
  onChange,
}: {
  readonly accounts: readonly Account[];
  readonly draft: MappingDraft;
  readonly headers: readonly string[];
  readonly workspaceExists: boolean;
  readonly onChange: (draft: MappingDraft) => void;
}) {
  const change = <Key extends keyof MappingDraft>(key: Key, value: MappingDraft[Key]) =>
    onChange({ ...draft, [key]: value });
  const columnOptions = (optional = false) => (
    <>
      <option value="">{optional ? "Not mapped" : "Choose a column"}</option>
      {headers.map((header) => (
        <option key={header} value={header}>
          {header}
        </option>
      ))}
    </>
  );

  return (
    <section className="import-panel" aria-labelledby="mapping-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Step 2</p>
          <h2 id="mapping-title">Confirm the mapping</h2>
        </div>
        <span className="storage-chip">{headers.length} columns</span>
      </div>
      {!workspaceExists && (
        <p className="error-message" role="alert">
          Create a workspace and account before importing.
        </p>
      )}
      {workspaceExists && accounts.length === 0 && (
        <p className="error-message" role="alert">
          Add an active account before importing.
        </p>
      )}
      <form className="mapping-form" onSubmit={(event) => event.preventDefault()}>
        <SelectField
          label="Target account"
          value={draft.accountId}
          onChange={(value) => change("accountId", value)}
          required
        >
          <option value="">Choose an account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} · {account.currency}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Posted date column"
          value={draft.postedDateColumn}
          onChange={(value) => change("postedDateColumn", value)}
          required
        >
          {columnOptions()}
        </SelectField>
        <SelectField
          label="Transaction date column (optional)"
          value={draft.transactionDateColumn}
          onChange={(value) => change("transactionDateColumn", value)}
        >
          {columnOptions(true)}
        </SelectField>
        <SelectField
          label="Description column"
          value={draft.descriptionColumn}
          onChange={(value) => change("descriptionColumn", value)}
          required
        >
          {columnOptions()}
        </SelectField>
        <SelectField
          label="Date format (must be confirmed)"
          value={draft.dateFormat}
          onChange={(value) => change("dateFormat", value as MappingDraft["dateFormat"])}
          required
        >
          <option value="">Choose the exact format</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
          <option value="YYYY/MM/DD">YYYY/MM/DD</option>
        </SelectField>
        <SelectField
          label="Amount layout"
          value={draft.amountKind}
          onChange={(value) => change("amountKind", value as MappingDraft["amountKind"])}
        >
          <option value="signed">One signed amount column</option>
          <option value="debit-credit">Separate debit and credit columns</option>
        </SelectField>
        {draft.amountKind === "signed" ? (
          <>
            <SelectField
              label="Amount column"
              value={draft.amountColumn}
              onChange={(value) => change("amountColumn", value)}
              required
            >
              {columnOptions()}
            </SelectField>
            <SelectField
              label="What does a positive amount mean?"
              value={draft.signedPositiveDirection}
              onChange={(value) =>
                change("signedPositiveDirection", value as MappingDraft["signedPositiveDirection"])
              }
              required
            >
              <option value="">Confirm amount direction</option>
              <option value="inflow">Positive is money in</option>
              <option value="outflow">Positive is money out</option>
            </SelectField>
          </>
        ) : (
          <>
            <SelectField
              label="Debit column"
              value={draft.debitColumn}
              onChange={(value) => change("debitColumn", value)}
              required
            >
              {columnOptions()}
            </SelectField>
            <SelectField
              label="Credit column"
              value={draft.creditColumn}
              onChange={(value) => change("creditColumn", value)}
              required
            >
              {columnOptions()}
            </SelectField>
            <SelectField
              label="What does a debit mean?"
              value={draft.debitDirection}
              onChange={(value) =>
                change("debitDirection", value as MappingDraft["debitDirection"])
              }
              required
            >
              <option value="">Confirm debit direction</option>
              <option value="outflow">Debit is money out</option>
              <option value="inflow">Debit is money in</option>
            </SelectField>
          </>
        )}
        <SelectField
          label="Decimal separator"
          value={draft.decimalSeparator}
          onChange={(value) => change("decimalSeparator", value as "." | ",")}
        >
          <option value=".">Period (1,234.56)</option>
          <option value=",">Comma (1.234,56)</option>
        </SelectField>
        <SelectField
          label="Grouping separator"
          value={draft.groupSeparator}
          onChange={(value) => change("groupSeparator", value as MappingDraft["groupSeparator"])}
        >
          <option value=",">Comma</option>
          <option value=".">Period</option>
          <option value="space">Space</option>
          <option value="none">None</option>
        </SelectField>
        <SelectField
          label="Currency column (optional)"
          value={draft.currencyColumn}
          onChange={(value) => change("currencyColumn", value)}
        >
          {columnOptions(true)}
        </SelectField>
        <SelectField
          label="Source transaction ID (optional)"
          value={draft.sourceTransactionIdColumn}
          onChange={(value) => change("sourceTransactionIdColumn", value)}
        >
          {columnOptions(true)}
        </SelectField>
        <SelectField
          label="Status column (optional)"
          value={draft.statusColumn}
          onChange={(value) => change("statusColumn", value)}
        >
          {columnOptions(true)}
        </SelectField>
      </form>
    </section>
  );
}

function SelectField({
  label,
  value,
  onChange,
  required = false,
  children,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly required?: boolean;
  readonly children: React.ReactNode;
}) {
  const id = `mapping-${label.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-")}`;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        required={required}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {children}
      </select>
    </div>
  );
}

function Preview({
  result,
  mappingReady,
  isCommitting,
  onConfirm,
}: {
  readonly result: CsvMappingResult | undefined;
  readonly mappingReady: boolean;
  readonly isCommitting: boolean;
  readonly onConfirm: () => void;
}) {
  if (!mappingReady || result === undefined) {
    return (
      <section className="import-panel" aria-labelledby="preview-title">
        <p className="eyebrow">Step 3</p>
        <h2 id="preview-title">Review the preview</h2>
        <p role="status">
          Complete every required mapping and explicitly confirm date and amount direction.
        </p>
      </section>
    );
  }
  const errors = result.issues.filter((issue) => issue.severity === "error");
  return (
    <section className="import-panel" aria-labelledby="preview-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Step 3</p>
          <h2 id="preview-title">Review the preview</h2>
        </div>
        <span className={result.canContinue ? "ready-status" : "error-chip"}>
          {result.canContinue ? "Ready to confirm" : `${errors.length} errors`}
        </span>
      </div>
      <dl className="import-totals" aria-label="Mapped transaction totals">
        <div>
          <dt>Money in</dt>
          <dd>
            {result.totals.currency} {result.totals.inflow}
          </dd>
        </div>
        <div>
          <dt>Money out</dt>
          <dd>
            {result.totals.currency} {result.totals.outflow}
          </dd>
        </div>
        <div>
          <dt>Valid rows</dt>
          <dd>{result.totals.validRows}</dd>
        </div>
        <div>
          <dt>Invalid rows</dt>
          <dd>{result.totals.invalidRows}</dd>
        </div>
      </dl>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Transaction mapping preview"
      >
        <table>
          <caption>Representative valid and invalid rows, up to 20</caption>
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Status</th>
              <th scope="col">Date</th>
              <th scope="col">Description</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {result.previewRows.map((row) => (
              <tr key={row.sourceLocation}>
                <td>{row.sourceLocation}</td>
                <td>{row.status}</td>
                <td>{row.postedDate ?? "—"}</td>
                <td>{row.description ?? "—"}</td>
                <td>{row.amount === undefined ? "—" : `${row.currency} ${row.amount}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.issues.length > 0 && (
        <div className="issue-list">
          <h3>Validation issues</h3>
          <ul>
            {result.issues.slice(0, 20).map((issue, index) => (
              <li key={`${issue.code}-${issue.sourceLocation ?? "global"}-${index}`}>
                <strong>
                  {issue.severity}: {issue.code}
                </strong>
                <span>
                  {issue.sourceLocation ?? "File"}
                  {issue.field ? ` · ${issue.field}` : ""}: {issue.message}
                </span>
                {issue.correction && <span>Correction: {issue.correction}</span>}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="secondary-button"
            onClick={() => downloadErrorReport(result)}
          >
            Download sanitized error report
          </button>
        </div>
      )}
      <div className="preview-actions">
        <button type="button" onClick={onConfirm} disabled={!result.canContinue || isCommitting}>
          {isCommitting ? "Committing atomically…" : "Commit accepted transactions"}
        </button>
        <span>
          {result.canContinue
            ? "Transactions, provenance, import history, and revision commit together."
            : "Resolve all error-level rows before committing."}
        </span>
      </div>
    </section>
  );
}

function ImportHistory({
  imports,
  account,
}: {
  readonly imports: readonly StatementImport[];
  readonly account: Account;
}) {
  return (
    <section className="import-panel" aria-labelledby="import-history-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Local history</p>
          <h2 id="import-history-title">Committed imports</h2>
        </div>
        <span className="storage-chip">{account.name}</span>
      </div>
      {imports.length === 0 ? (
        <p>No committed imports exist for this account yet.</p>
      ) : (
        <ul className="import-history-list">
          {[...imports].reverse().map((statementImport) => (
            <li key={statementImport.id}>
              <div>
                <strong>{statementImport.source.fileName}</strong>
                <span>
                  {statementImport.parser.id} · {statementImport.parser.version}
                </span>
              </div>
              <div>
                <strong>{statementImport.counts.committed} transactions</strong>
                <span>
                  Revision {statementImport.committedRevision} ·{" "}
                  {statementImport.committedAt.slice(0, 10)}
                </span>
              </div>
              <span className="ready-status">Committed</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function createMapping(
  draft: MappingDraft,
  account: Account | undefined,
  headers: readonly string[],
): CsvMapping | undefined {
  if (
    account === undefined ||
    draft.postedDateColumn === "" ||
    draft.descriptionColumn === "" ||
    draft.dateFormat === ""
  )
    return undefined;
  if (
    draft.amountKind === "signed" &&
    (draft.amountColumn === "" || draft.signedPositiveDirection === "")
  )
    return undefined;
  if (
    draft.amountKind === "debit-credit" &&
    (draft.debitColumn === "" || draft.creditColumn === "" || draft.debitDirection === "")
  )
    return undefined;
  const selected = new Set(
    [
      draft.postedDateColumn,
      draft.transactionDateColumn,
      draft.descriptionColumn,
      draft.amountColumn,
      draft.debitColumn,
      draft.creditColumn,
      draft.currencyColumn,
      draft.sourceTransactionIdColumn,
      draft.statusColumn,
    ].filter(Boolean),
  );
  return {
    accountId: account.id,
    accountCurrency: account.currency,
    postedDateColumn: draft.postedDateColumn,
    ...(draft.transactionDateColumn === ""
      ? {}
      : { transactionDateColumn: draft.transactionDateColumn }),
    descriptionColumn: draft.descriptionColumn,
    amount:
      draft.amountKind === "signed"
        ? {
            kind: "signed",
            column: draft.amountColumn,
            positiveDirection: draft.signedPositiveDirection as "inflow" | "outflow",
          }
        : {
            kind: "debit-credit",
            debitColumn: draft.debitColumn,
            creditColumn: draft.creditColumn,
            debitDirection: draft.debitDirection as "outflow" | "inflow",
          },
    ...(draft.currencyColumn === "" ? {} : { currencyColumn: draft.currencyColumn }),
    ...(draft.sourceTransactionIdColumn === ""
      ? {}
      : { sourceTransactionIdColumn: draft.sourceTransactionIdColumn }),
    ...(draft.statusColumn === "" ? {} : { statusColumn: draft.statusColumn }),
    ignoredColumns: headers.filter((header) => !selected.has(header)),
    dateFormat: draft.dateFormat,
    numberFormat: {
      decimalSeparator: draft.decimalSeparator,
      groupSeparator: draft.groupSeparator,
    },
  };
}

function suggestDraft(headers: readonly string[], accountId: string): MappingDraft {
  const find = (...patterns: readonly RegExp[]) =>
    headers.find((header) => patterns.some((pattern) => pattern.test(header))) ?? "";
  return {
    ...EMPTY_DRAFT,
    accountId,
    postedDateColumn: find(/transfer.*date/iu, /^date$/iu, /posted.*date/iu),
    descriptionColumn: find(/description/iu, /merchant/iu, /details/iu),
    amountColumn: find(/^amount$/iu, /transaction.*amount/iu),
  };
}

function draftFromPreset(
  mapping: Omit<CsvMapping, "accountId" | "accountCurrency">,
  accountId: string,
): MappingDraft {
  return {
    ...EMPTY_DRAFT,
    accountId,
    postedDateColumn: mapping.postedDateColumn,
    transactionDateColumn: mapping.transactionDateColumn ?? "",
    descriptionColumn: mapping.descriptionColumn,
    amountKind: mapping.amount.kind,
    amountColumn: mapping.amount.kind === "signed" ? mapping.amount.column : "",
    debitColumn: mapping.amount.kind === "debit-credit" ? mapping.amount.debitColumn : "",
    creditColumn: mapping.amount.kind === "debit-credit" ? mapping.amount.creditColumn : "",
    signedPositiveDirection:
      mapping.amount.kind === "signed" ? mapping.amount.positiveDirection : "",
    debitDirection: mapping.amount.kind === "debit-credit" ? mapping.amount.debitDirection : "",
    currencyColumn: mapping.currencyColumn ?? "",
    sourceTransactionIdColumn: mapping.sourceTransactionIdColumn ?? "",
    statusColumn: mapping.statusColumn ?? "",
    dateFormat: mapping.dateFormat,
    decimalSeparator: mapping.numberFormat.decimalSeparator,
    groupSeparator: mapping.numberFormat.groupSeparator,
  };
}

function mappingSummary(
  mapping: CsvMapping,
): Readonly<Record<string, string | number | boolean | null>> {
  return {
    postedDateColumn: mapping.postedDateColumn,
    transactionDateColumn: mapping.transactionDateColumn ?? null,
    descriptionColumn: mapping.descriptionColumn,
    amountKind: mapping.amount.kind,
    amountColumn: mapping.amount.kind === "signed" ? mapping.amount.column : null,
    positiveDirection: mapping.amount.kind === "signed" ? mapping.amount.positiveDirection : null,
    debitColumn: mapping.amount.kind === "debit-credit" ? mapping.amount.debitColumn : null,
    creditColumn: mapping.amount.kind === "debit-credit" ? mapping.amount.creditColumn : null,
    debitDirection: mapping.amount.kind === "debit-credit" ? mapping.amount.debitDirection : null,
    currencyColumn: mapping.currencyColumn ?? null,
    sourceTransactionIdColumn: mapping.sourceTransactionIdColumn ?? null,
    statusColumn: mapping.statusColumn ?? null,
    dateFormat: mapping.dateFormat,
    decimalSeparator: mapping.numberFormat.decimalSeparator,
    groupSeparator: mapping.numberFormat.groupSeparator,
  };
}

function downloadErrorReport(result: CsvMappingResult): void {
  const blob = new Blob([createCsvErrorReport(result.issues)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "financial-intelligence-import-errors.csv";
  link.click();
  URL.revokeObjectURL(url);
}
