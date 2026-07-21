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
import { mapOfxResult } from "@financial-intelligence/import-ofx";
import { mapPdfResult } from "@financial-intelligence/import-pdf";
import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";

import type { ApplicationServices } from "./infrastructure";
import { parseCsvFiles } from "./csv-import";
import { detectBatchFormat } from "./import-format";
import { parseOfxFile, type ParsedOfxSource } from "./ofx-import";
import { parsePdfFile, type ParsedPdfSource } from "./pdf-import";
import { loadMappingPreset, saveMappingPreset } from "./mapping-presets";
import { withProtectedOperation } from "./pwa/protected-operations";

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
  readonly parseOfx?: typeof parseOfxFile;
  readonly parsePdf?: typeof parsePdfFile;
  readonly detectFormat?: typeof detectBatchFormat;
  readonly presetStorage?: Pick<Storage, "getItem" | "setItem">;
  readonly now?: () => string;
}

export function ImportPage({
  services,
  parseFiles = parseCsvFiles,
  parseOfx = parseOfxFile,
  parsePdf = parsePdfFile,
  detectFormat = detectBatchFormat,
  presetStorage = localStorage,
  now = () => new Date().toISOString(),
}: ImportPageProperties) {
  const [workspaces, setWorkspaces] = useState<readonly Workspace[]>([]);
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [sources, setSources] = useState<readonly CsvMappingSource[]>([]);
  const [ofxSource, setOfxSource] = useState<ParsedOfxSource>();
  const [ofxAccountId, setOfxAccountId] = useState("");
  const [pdfSource, setPdfSource] = useState<ParsedPdfSource>();
  const [pdfAccountId, setPdfAccountId] = useState("");
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
  const ofxAccount = accounts.find((account) => account.id === ofxAccountId);
  const pdfAccount = accounts.find((account) => account.id === pdfAccountId);
  const historyAccount =
    ofxSource !== undefined
      ? (ofxAccount ?? accounts[0])
      : pdfSource !== undefined
        ? (pdfAccount ?? accounts[0])
        : (selectedAccount ?? accounts[0]);
  const mapping = useMemo(
    () => createMapping(draft, selectedAccount, headers),
    [draft, selectedAccount, headers],
  );
  const mapped = useMemo(
    () => (mapping === undefined ? undefined : mapCsvSources(sources, mapping)),
    [mapping, sources],
  );
  const ofxMapped = useMemo(
    () =>
      ofxSource === undefined || ofxAccount === undefined
        ? undefined
        : mapOfxResult(ofxSource.result, {
            accountId: ofxAccount.id,
            accountCurrency: ofxAccount.currency,
            sourceFileSha256: ofxSource.metadata.sha256,
          }),
    [ofxSource, ofxAccount],
  );
  const pdfMapped = useMemo(
    () =>
      pdfSource === undefined || pdfAccount === undefined
        ? undefined
        : mapPdfResult(pdfSource.result, {
            accountId: pdfAccount.id,
            accountCurrency: pdfAccount.currency,
            sourceFileSha256: pdfSource.metadata.sha256,
          }),
    [pdfSource, pdfAccount],
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
    setOfxSource(undefined);
    setPdfSource(undefined);
    setCommitStatus("idle");
    try {
      const format = await detectFormat(files);
      if (format === "ofx") {
        const first = files[0];
        if (first === undefined) throw new Error("Choose an OFX or QFX file.");
        const parsedOfx = await parseOfx(first);
        setOfxSource(parsedOfx);
        setOfxAccountId((current) => current || matchOfxAccount(parsedOfx, accounts));
        setStatus("ready");
        return;
      }
      if (format === "pdf") {
        const first = files[0];
        if (first === undefined) throw new Error("Choose a PDF statement.");
        const parsedPdf = await parsePdf(first);
        setPdfSource(parsedPdf);
        setPdfAccountId(
          (current) => current || (accounts.length === 1 ? (accounts[0]?.id ?? "") : ""),
        );
        setStatus("ready");
        return;
      }
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
        error instanceof Error ? error.message : "The selected files could not be parsed.",
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
      const result = await withProtectedOperation("import-commit", () =>
        services.commitAcceptedImport.execute({
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
        }),
      );
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

  const confirmOfxImport = async () => {
    const workspace = workspaces[0];
    if (
      ofxSource === undefined ||
      ofxAccount === undefined ||
      ofxMapped?.canContinue !== true ||
      workspace === undefined
    )
      return;
    setCommitStatus("committing");
    setMessage(undefined);
    try {
      const result = await withProtectedOperation("import-commit", () =>
        services.commitAcceptedImport.execute({
          workspaceId: workspace.id,
          accountId: ofxAccount.id,
          sources: [
            {
              fileName: ofxSource.metadata.fileName,
              mediaType: ofxSource.metadata.mediaType,
              byteSize: ofxSource.metadata.byteSize,
              sha256: ofxSource.metadata.sha256,
              parserId: ofxSource.result.parserId,
              parserVersion: ofxSource.result.parserVersion,
              sourceRows: ofxSource.result.rows.length,
              issues: ofxSource.result.issues,
            },
          ],
          candidates: ofxMapped.candidates.map((candidate) => ({
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
          mapping: {
            format: "ofx",
            dialect: String(ofxSource.result.detectedMetadata?.dialect ?? ""),
          },
        }),
      );
      setHistory(await services.listImportHistory.execute(ofxAccount.id));
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

  const confirmPdfImport = async () => {
    const workspace = workspaces[0];
    if (
      pdfSource === undefined ||
      pdfAccount === undefined ||
      pdfMapped?.canContinue !== true ||
      workspace === undefined
    )
      return;
    setCommitStatus("committing");
    setMessage(undefined);
    try {
      const result = await withProtectedOperation("import-commit", () =>
        services.commitAcceptedImport.execute({
          workspaceId: workspace.id,
          accountId: pdfAccount.id,
          sources: [
            {
              fileName: pdfSource.metadata.fileName,
              mediaType: pdfSource.metadata.mediaType,
              byteSize: pdfSource.metadata.byteSize,
              sha256: pdfSource.metadata.sha256,
              parserId: pdfSource.result.parserId,
              parserVersion: pdfSource.result.parserVersion,
              sourceRows: pdfSource.result.rows.length,
              issues: pdfSource.result.issues,
            },
          ],
          candidates: pdfMapped.candidates.map((candidate) => ({
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
          mapping: {
            format: "pdf",
            adapter: String(pdfSource.result.detectedMetadata?.adapterId ?? ""),
          },
        }),
      );
      setHistory(await services.listImportHistory.execute(pdfAccount.id));
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
        <p className="eyebrow">Local statement import</p>
        <h1 id="import-title">Map every transaction before it enters your ledger.</h1>
        <p className="hero-copy">
          CSV, OFX, QFX, and text-based PDF files are parsed in a dedicated browser worker. This
          preview does not write canonical transactions.
        </p>
      </section>

      <section className="import-panel" aria-labelledby="source-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Step 1</p>
            <h2 id="source-title">Choose statements</h2>
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
          <label htmlFor="csv-files">Select CSV files, or a single OFX/QFX or PDF statement</label>
          <input
            id="csv-files"
            type="file"
            accept=".csv,.tsv,.ofx,.qfx,.pdf,text/csv,text/tab-separated-values,application/x-ofx,application/vnd.intu.qfx,application/pdf"
            multiple
            onChange={onFilesChanged}
          />
          <span>or drag and drop files here</span>
        </div>
        <p className="privacy-copy">
          Raw statement contents remain in this browser and are not saved by this preview. The
          detected format decides the mapping step; content is checked, not just the file extension.
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
        {ofxSource !== undefined && (
          <p className="success-message" role="status">
            Parsed OFX statement {ofxSource.metadata.fileName} containing{" "}
            {ofxSource.result.rows.length} transaction
            {ofxSource.result.rows.length === 1 ? "" : "s"}.
          </p>
        )}
        {pdfSource !== undefined && (
          <p className="success-message" role="status">
            Parsed PDF statement {pdfSource.metadata.fileName} containing{" "}
            {pdfSource.result.rows.length} transaction
            {pdfSource.result.rows.length === 1 ? "" : "s"}.
          </p>
        )}
      </section>

      {ofxSource !== undefined && (
        <OfxAccountForm
          source={ofxSource}
          accounts={accounts}
          accountId={ofxAccountId}
          workspaceExists={workspaces.length > 0}
          onChange={setOfxAccountId}
        />
      )}

      {ofxSource !== undefined && (
        <Preview
          result={ofxMapped}
          mappingReady={ofxAccount !== undefined}
          isCommitting={commitStatus === "committing"}
          onConfirm={() => void confirmOfxImport()}
        />
      )}

      {pdfSource !== undefined && (
        <PdfAccountForm
          source={pdfSource}
          accounts={accounts}
          accountId={pdfAccountId}
          workspaceExists={workspaces.length > 0}
          onChange={setPdfAccountId}
        />
      )}

      {pdfSource !== undefined && (
        <Preview
          result={pdfMapped}
          mappingReady={pdfAccount !== undefined}
          isCommitting={commitStatus === "committing"}
          onConfirm={() => void confirmPdfImport()}
        />
      )}

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

function OfxAccountForm({
  source,
  accounts,
  accountId,
  workspaceExists,
  onChange,
}: {
  readonly source: ParsedOfxSource;
  readonly accounts: readonly Account[];
  readonly accountId: string;
  readonly workspaceExists: boolean;
  readonly onChange: (accountId: string) => void;
}) {
  const metadata = source.result.detectedMetadata ?? {};
  const dialect = metadata.dialect === "ofx-xml" ? "OFX 2.x (XML/QFX)" : "OFX 1.x (SGML)";
  const detected: readonly { readonly label: string; readonly value: string }[] = [
    { label: "Detected format", value: dialect },
    { label: "Statements", value: String(metadata.statementCount ?? 1) },
    {
      label: "Transactions",
      value: String(metadata.transactionCount ?? source.result.rows.length),
    },
    { label: "Account type", value: formatMetaValue(metadata.accountType) },
    { label: "Account hint", value: formatMetaValue(metadata.maskedAccountHint) },
    { label: "Statement currency", value: formatMetaValue(metadata.currency) },
  ];
  const unsupported = source.result.issues.filter((issue) => issue.code === "UNSUPPORTED_SECTION");

  return (
    <section className="import-panel" aria-labelledby="ofx-account-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Step 2</p>
          <h2 id="ofx-account-title">Confirm the account</h2>
        </div>
        <span className="storage-chip">{dialect}</span>
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
      <dl className="import-totals" aria-label="Detected statement details">
        {detected.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      <form className="mapping-form" onSubmit={(event) => event.preventDefault()}>
        <SelectField label="Target account" value={accountId} onChange={onChange} required>
          <option value="">Choose an account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} · {account.currency}
            </option>
          ))}
        </SelectField>
      </form>
      <p className="privacy-copy">
        The statement currency must match the selected account. Full account and routing numbers are
        never stored; only a masked hint is shown to help you choose.
      </p>
      {unsupported.length > 0 && (
        <div className="issue-list">
          <h3>Unsupported sections</h3>
          <ul>
            {unsupported.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function PdfAccountForm({
  source,
  accounts,
  accountId,
  workspaceExists,
  onChange,
}: {
  readonly source: ParsedPdfSource;
  readonly accounts: readonly Account[];
  readonly accountId: string;
  readonly workspaceExists: boolean;
  readonly onChange: (accountId: string) => void;
}) {
  const metadata = source.result.detectedMetadata ?? {};
  const adapter = formatMetaValue(metadata.adapterId);
  const detected: readonly { readonly label: string; readonly value: string }[] = [
    { label: "Detected layout", value: adapter },
    { label: "Pages", value: String(metadata.pageCount ?? 1) },
    { label: "Transactions", value: String(source.result.rows.length) },
    { label: "Column mode", value: formatMetaValue(metadata.columnMode) },
    { label: "Statement currency", value: formatMetaValue(metadata.currency) },
  ];

  return (
    <section className="import-panel" aria-labelledby="pdf-account-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Step 2</p>
          <h2 id="pdf-account-title">Confirm the account</h2>
        </div>
        <span className="storage-chip">Text PDF</span>
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
      <dl className="import-totals" aria-label="Detected statement details">
        {detected.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      <form className="mapping-form" onSubmit={(event) => event.preventDefault()}>
        <SelectField label="Target account" value={accountId} onChange={onChange} required>
          <option value="">Choose an account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} · {account.currency}
            </option>
          ))}
        </SelectField>
      </form>
      <p className="privacy-copy">
        Amounts and dates are read from the statement text, not rendered images. Review the preview
        below; the source PDF is not saved by this preview. If a layout is not recognized, export a
        CSV or OFX statement instead.
      </p>
    </section>
  );
}

function formatMetaValue(value: string | number | boolean | undefined): string {
  return value === undefined || value === "" ? "—" : String(value);
}

function matchOfxAccount(source: ParsedOfxSource, accounts: readonly Account[]): string {
  const currency = source.result.detectedMetadata?.currency;
  if (typeof currency !== "string") return "";
  const matches = accounts.filter((account) => account.currency === currency);
  return matches.length === 1 && matches[0] !== undefined ? matches[0].id : "";
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
