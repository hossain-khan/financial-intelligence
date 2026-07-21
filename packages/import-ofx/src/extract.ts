import type { ImportIssue, SourceRow } from "@financial-intelligence/import-core";

import { parseOfxDate } from "./datetime";
import { OfxImportError } from "./errors";
import type { OfxParseLimits } from "./options";
import type { OfxNode } from "./tokenizer";

/** Canonical OFX source-row field names shared with the format-neutral mapper. */
export const OFX_FIELDS = {
  postedDate: "posted_date",
  userDate: "user_date",
  availableDate: "available_date",
  amount: "amount",
  currency: "currency",
  sourceTransactionId: "fitid",
  transactionType: "trntype",
  checkNumber: "checknum",
  referenceNumber: "refnum",
  sicCode: "sic",
  serverTransactionId: "srvrtid",
  name: "name",
  memo: "memo",
  description: "description",
} as const;

export interface OfxAccountSummary {
  readonly accountType?: string;
  /** Masked account hint (last four digits) used only to help select a local account. */
  readonly maskedAccountHint?: string;
  readonly currency?: string;
  readonly ledgerBalance?: string;
  readonly ledgerBalanceDate?: string;
  readonly availableBalance?: string;
  readonly startDate?: string;
  readonly endDate?: string;
}

export interface OfxStatement {
  readonly index: number;
  readonly account: OfxAccountSummary;
  readonly rows: readonly SourceRow[];
}

export interface OfxExtraction {
  readonly statements: readonly OfxStatement[];
  readonly rows: readonly SourceRow[];
  readonly issues: readonly ImportIssue[];
  readonly detectedMetadata: Readonly<Record<string, string | number | boolean>>;
}

interface StatementSection {
  readonly node: OfxNode;
  readonly kind: "bank" | "creditcard";
}

const SUPPORTED_STATEMENTS: Readonly<Record<string, "bank" | "creditcard">> = {
  STMTRS: "bank",
  CCSTMTRS: "creditcard",
};

/**
 * OFX message-set aggregates that are explicitly out of v1 scope. Their presence produces a
 * bounded UNSUPPORTED_SECTION warning; the parser never follows sign-on, sync, or online-banking
 * instructions contained in them.
 */
const UNSUPPORTED_SECTIONS: readonly string[] = [
  "INVSTMTMSGSRSV1",
  "LOANMSGSRSV1",
  "BILLPAYMSGSRSV1",
  "SIGNUPMSGSRSV1",
  "PROFMSGSRSV1",
  "SIGNONMSGSRSV1",
  "INTERXFERMSGSRSV1",
  "WIREXFERMSGSRSV1",
  "EMAILMSGSRSV1",
];

export function extractOfx(root: OfxNode, limits: OfxParseLimits): OfxExtraction {
  const issues: IssueSink = new IssueSink(limits.maxIssues);
  const ofx = findChild(root, "OFX");
  if (ofx === undefined) {
    throw new OfxImportError("MALFORMED_DOCUMENT", "OFX document is missing its <OFX> root");
  }

  for (const section of UNSUPPORTED_SECTIONS) {
    if (findDescendant(ofx, section) !== undefined) {
      issues.add({
        code: "UNSUPPORTED_SECTION",
        severity: "warning",
        sourceLocation: `section:${section}`,
        message: `The “${section}” section is not supported and was ignored.`,
      });
    }
  }

  const statementNodes = collectStatements(ofx);
  if (statementNodes.length === 0) {
    throw new OfxImportError(
      "MALFORMED_DOCUMENT",
      "No supported bank or credit-card statement was found",
    );
  }
  if (statementNodes.length > limits.maxStatements) {
    throw new OfxImportError(
      "STATEMENT_LIMIT_EXCEEDED",
      "OFX document exceeds the configured statement limit",
    );
  }

  const statements: OfxStatement[] = [];
  const allRows: SourceRow[] = [];
  let currency: string | undefined;

  for (const [statementIndex, section] of statementNodes.entries()) {
    const account = summarizeAccount(section.node, section.kind);
    currency ??= account.currency;
    const rows = extractTransactions(
      section.node,
      statementIndex + 1,
      account.currency,
      limits,
      allRows.length,
      issues,
    );
    allRows.push(...rows);
    statements.push({ index: statementIndex + 1, account, rows });
  }

  const detectedMetadata: Record<string, string | number | boolean> = {
    statementCount: statements.length,
    transactionCount: allRows.length,
  };
  if (currency !== undefined) detectedMetadata.currency = currency;
  const firstAccount = statements[0]?.account;
  if (firstAccount?.accountType !== undefined)
    detectedMetadata.accountType = firstAccount.accountType;
  if (firstAccount?.maskedAccountHint !== undefined) {
    detectedMetadata.maskedAccountHint = firstAccount.maskedAccountHint;
  }

  return { statements, rows: allRows, issues: issues.toArray(), detectedMetadata };
}

function collectStatements(ofx: OfxNode): readonly StatementSection[] {
  const found: StatementSection[] = [];
  const visit = (node: OfxNode): void => {
    const kind = SUPPORTED_STATEMENTS[node.tag];
    if (kind !== undefined) {
      found.push({ node, kind });
      return; // Do not descend into a statement looking for nested statements.
    }
    for (const child of node.children) visit(child);
  };
  visit(ofx);
  return found;
}

function summarizeAccount(statement: OfxNode, kind: "bank" | "creditcard"): OfxAccountSummary {
  const acctFrom =
    findDescendant(statement, kind === "bank" ? "BANKACCTFROM" : "CCACCTFROM") ??
    findDescendant(statement, "CCACCTFROM");
  const acctId = acctFrom === undefined ? undefined : leafValue(acctFrom, "ACCTID");
  const balance = findChild(statement, "LEDGERBAL");
  const availBalance = findChild(statement, "AVAILBAL");
  const summary: OfxAccountSummary = {
    ...optional(
      "accountType",
      acctFrom === undefined ? undefined : leafValue(acctFrom, "ACCTTYPE"),
    ),
    ...optional("maskedAccountHint", maskAccount(acctId)),
    ...optional("currency", normalizeCurrency(leafValue(statement, "CURDEF"))),
    ...optional("ledgerBalance", leafValue(balance, "BALAMT")),
    ...optional("ledgerBalanceDate", safeDate(leafValue(balance, "DTASOF"))),
    ...optional("availableBalance", leafValue(availBalance, "BALAMT")),
    ...optional("startDate", safeDate(leafValue(findChild(statement, "BANKTRANLIST"), "DTSTART"))),
    ...optional("endDate", safeDate(leafValue(findChild(statement, "BANKTRANLIST"), "DTEND"))),
  };
  return summary;
}

function extractTransactions(
  statement: OfxNode,
  statementIndex: number,
  currency: string | undefined,
  limits: OfxParseLimits,
  priorCount: number,
  issues: IssueSink,
): readonly SourceRow[] {
  const list = findChild(statement, "BANKTRANLIST");
  if (list === undefined) return [];
  const rows: SourceRow[] = [];
  let transactionIndex = 0;
  for (const node of list.children) {
    if (node.tag !== "STMTTRN") continue;
    transactionIndex += 1;
    if (priorCount + rows.length >= limits.maxTransactions) {
      throw new OfxImportError(
        "TRANSACTION_LIMIT_EXCEEDED",
        "OFX document exceeds the configured transaction limit",
      );
    }
    const sourceLocation = `statement:${statementIndex}/transaction:${transactionIndex}`;
    const row = extractTransaction(node, sourceLocation, currency, issues);
    if (row !== undefined) rows.push(row);
  }
  return rows;
}

function extractTransaction(
  node: OfxNode,
  sourceLocation: string,
  currency: string | undefined,
  issues: IssueSink,
): SourceRow | undefined {
  const rawPosted = leafValue(node, "DTPOSTED");
  const rawAmount = leafValue(node, "TRNAMT");
  if (rawPosted === undefined || rawAmount === undefined) {
    issues.add({
      code: "INCOMPLETE_TRANSACTION",
      severity: "error",
      sourceLocation,
      message: "A transaction is missing its posted date or amount.",
    });
    return undefined;
  }

  let postedDate: string;
  try {
    postedDate = parseOfxDate(rawPosted).date;
  } catch (error) {
    issues.add({
      code: "INVALID_DATE",
      severity: "error",
      sourceLocation,
      field: "posted_date",
      message: error instanceof Error ? error.message : "The posted date is invalid.",
    });
    return undefined;
  }

  const amount = normalizeAmount(rawAmount);
  if (amount === undefined) {
    issues.add({
      code: "INVALID_AMOUNT",
      severity: "error",
      sourceLocation,
      field: "amount",
      message: `Amount “${clip(rawAmount)}” is not a valid OFX decimal.`,
    });
    return undefined;
  }

  const name = leafValue(node, "NAME");
  const memo = leafValue(node, "MEMO");
  const description = buildDescription(name, memo);
  if (description.length === 0) {
    issues.add({
      code: "MISSING_DESCRIPTION",
      severity: "warning",
      sourceLocation,
      message: "A transaction has no NAME or MEMO; using its type as the description.",
    });
  }

  const fields: Record<string, string> = {
    [OFX_FIELDS.postedDate]: postedDate,
    [OFX_FIELDS.amount]: amount,
    [OFX_FIELDS.description]:
      description.length > 0 ? description : (leafValue(node, "TRNTYPE") ?? "OFX transaction"),
  };
  // Stamp the statement currency (CURDEF) onto each row so the shared mapper enforces the
  // account/statement currency match. Per-transaction CURRENCY overrides are out of v1 scope.
  assign(fields, OFX_FIELDS.currency, currency);
  assign(fields, OFX_FIELDS.userDate, safeDate(leafValue(node, "DTUSER")));
  assign(fields, OFX_FIELDS.availableDate, safeDate(leafValue(node, "DTAVAIL")));
  assign(fields, OFX_FIELDS.sourceTransactionId, leafValue(node, "FITID"));
  assign(fields, OFX_FIELDS.transactionType, leafValue(node, "TRNTYPE"));
  assign(fields, OFX_FIELDS.checkNumber, leafValue(node, "CHECKNUM"));
  assign(fields, OFX_FIELDS.referenceNumber, leafValue(node, "REFNUM"));
  assign(fields, OFX_FIELDS.sicCode, leafValue(node, "SIC"));
  assign(fields, OFX_FIELDS.serverTransactionId, leafValue(node, "SRVRTID"));
  assign(fields, OFX_FIELDS.name, name);
  assign(fields, OFX_FIELDS.memo, memo);

  return { sourceLocation, fields };
}

/**
 * Validate an OFX signed decimal amount. OFX permits `.` or `,` as the decimal separator and no
 * grouping. Anything else (letters, multiple separators, empty) is rejected — never coerced.
 */
function normalizeAmount(raw: string): string | undefined {
  const trimmed = raw.trim().replace(",", ".");
  if (!/^[+-]?\d+(\.\d+)?$/u.test(trimmed)) return undefined;
  const negative = trimmed.startsWith("-");
  const unsigned = trimmed.replace(/^[+-]/u, "");
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const normalizedFraction = (fraction + "00").slice(0, 2);
  const normalizedWhole = whole.replace(/^0+(?=\d)/u, "");
  const value = `${normalizedWhole}.${normalizedFraction}`;
  return negative && value.replace(/[.0]/gu, "").length > 0 ? `-${value}` : value;
}

function buildDescription(name: string | undefined, memo: string | undefined): string {
  const parts = [name, memo]
    .map((part) => (part ?? "").normalize("NFC").replaceAll(/\s+/gu, " ").trim())
    .filter((part) => part.length > 0);
  const unique = parts.filter((part, index) => parts.indexOf(part) === index);
  return unique.join(" — ").slice(0, 1000);
}

function maskAccount(acctId: string | undefined): string | undefined {
  if (acctId === undefined) return undefined;
  const digits = acctId.replaceAll(/\D/gu, "");
  if (digits.length === 0) return undefined;
  return `••••${digits.slice(-4)}`;
}

function normalizeCurrency(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.normalize("NFKC").trim().toUpperCase();
  return /^[A-Z]{3}$/u.test(normalized) ? normalized : undefined;
}

function safeDate(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  try {
    return parseOfxDate(value).date;
  } catch {
    return undefined;
  }
}

function leafValue(node: OfxNode | undefined, tag: string): string | undefined {
  if (node === undefined) return undefined;
  const child = node.children.find((candidate) => candidate.tag === tag);
  const value = child?.value?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}

function findChild(node: OfxNode | undefined, tag: string): OfxNode | undefined {
  return node?.children.find((child) => child.tag === tag);
}

function findDescendant(node: OfxNode, tag: string): OfxNode | undefined {
  if (node.tag === tag) return node;
  for (const child of node.children) {
    const found = findDescendant(child, tag);
    if (found !== undefined) return found;
  }
  return undefined;
}

function assign(fields: Record<string, string>, key: string, value: string | undefined): void {
  if (value !== undefined && value.length > 0) fields[key] = value;
}

function optional<K extends string>(
  key: K,
  value: string | undefined,
): Record<K, string> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, string>);
}

function clip(value: string): string {
  return value.length > 32 ? `${value.slice(0, 32)}…` : value;
}

class IssueSink {
  private readonly issues: ImportIssue[] = [];

  public constructor(private readonly max: number) {}

  public add(issue: ImportIssue): void {
    if (this.issues.length < this.max) this.issues.push(issue);
  }

  public toArray(): readonly ImportIssue[] {
    return this.issues;
  }
}
