import type { ImportIssue, SourceRow } from "@financial-intelligence/import-core";

import type { OfxParseLimits } from "../options";
import { findChild, findChildren, getText, type OfxElement } from "./dialect";
import { minorToDecimal, parseOfxAmount } from "./amount";
import { parseOfxDate } from "./date";

export interface ExtractedStatement {
  readonly accountType: "checking" | "savings" | "credit-card" | "other";
  readonly currency: string;
  readonly accountHint: string;
  readonly transactions: readonly SourceRow[];
  readonly ledgerBalance: { readonly amount: string; readonly date: string } | undefined;
  readonly availableBalance: { readonly amount: string; readonly date: string } | undefined;
  readonly startDate: string | undefined;
  readonly endDate: string | undefined;
}

export interface ExtractionResult {
  readonly statements: readonly ExtractedStatement[];
  readonly issues: readonly ImportIssue[];
  readonly unsupportedSections: readonly string[];
}

export function extractStatements(
  root: readonly OfxElement[],
  limits: OfxParseLimits,
): ExtractionResult {
  const statements: ExtractedStatement[] = [];
  const issues: ImportIssue[] = [];
  const unsupportedSections: string[] = [];

  const ofxRoot = root.find((element) => element.name.toUpperCase() === "OFX");
  if (ofxRoot === undefined) {
    issues.push({
      code: "MISSING_OFX_ROOT",
      severity: "error",
      message: "OFX root element was not found",
    });
    return { statements, issues, unsupportedSections };
  }

  for (const child of ofxRoot.children) {
    const name = child.name.toUpperCase();
    if (name === "BANKMSGSRSV1") {
      extractBankMessageSet(child, statements, issues, unsupportedSections, limits);
    } else if (name === "CREDITCARDMSGSRSV1") {
      extractCreditCardMessageSet(child, statements, issues, unsupportedSections, limits);
    } else if (name === "SIGNONMSGSRSV1") {
      // Signon is expected; ignore for transaction extraction.
    } else if (isUnsupportedMessageSet(name)) {
      unsupportedSections.push(name);
      issues.push({
        code: "UNSUPPORTED_SECTION",
        severity: "warning",
        sourceLocation: `section:${name}`,
        message: `OFX message set ${name} is not supported in this version`,
      });
    }
  }

  if (statements.length === 0 && !issues.some((issue) => issue.severity === "error")) {
    issues.push({
      code: "NO_STATEMENTS",
      severity: "error",
      message: "No supported bank or credit-card statements were found",
    });
  }

  return { statements, issues, unsupportedSections };
}

function isUnsupportedMessageSet(name: string): boolean {
  const unsupported = [
    "INVSTMTMSGSRSV1",
    "LOANMSGSRSV1",
    "BILLPAYMSGSRSV1",
    "SIGNUPMSGSRSV1",
    "TAX1098MSGSRSV1",
    "TAX1099MSGSRSV1",
    "PRESTMGSRSV1",
  ];
  return unsupported.includes(name);
}

function extractBankMessageSet(
  element: OfxElement,
  statements: ExtractedStatement[],
  issues: ImportIssue[],
  unsupportedSections: string[],
  limits: OfxParseLimits,
): void {
  for (const child of element.children) {
    const name = child.name.toUpperCase();
    if (name === "STMTTRNRS") {
      const response = findChild(child, "STMTRS");
      if (response !== undefined) {
        statements.push(extractBankStatement(response, issues, limits));
      }
    } else {
      unsupportedSections.push(name);
      issues.push({
        code: "UNSUPPORTED_SECTION",
        severity: "warning",
        sourceLocation: `section:${name}`,
        message: `OFX bank response ${name} is not supported`,
      });
    }
  }
}

function extractCreditCardMessageSet(
  element: OfxElement,
  statements: ExtractedStatement[],
  issues: ImportIssue[],
  unsupportedSections: string[],
  limits: OfxParseLimits,
): void {
  for (const child of element.children) {
    const name = child.name.toUpperCase();
    if (name === "CCSTMTTRNRS") {
      const response = findChild(child, "CCSTMTRS");
      if (response !== undefined) {
        statements.push(extractCreditCardStatement(response, issues, limits));
      }
    } else {
      unsupportedSections.push(name);
      issues.push({
        code: "UNSUPPORTED_SECTION",
        severity: "warning",
        sourceLocation: `section:${name}`,
        message: `OFX credit-card response ${name} is not supported`,
      });
    }
  }
}

function extractBankStatement(
  element: OfxElement,
  issues: ImportIssue[],
  limits: OfxParseLimits,
): ExtractedStatement {
  const accountFrom = findChild(element, "BANKACCTFROM");
  const accountId = maskAccountHint(getText(findChild(accountFrom ?? element, "ACCTID")));
  const accountType = normalizeBankAccountType(
    getText(findChild(accountFrom ?? element, "ACCTTYPE")),
  );
  const currency = getText(findChild(element, "CURDEF")).toUpperCase();
  const transactionList = findChild(element, "BANKTRANLIST");

  return {
    accountType,
    currency,
    accountHint: accountId,
    transactions: extractTransactions(transactionList, issues, limits, currency),
    ledgerBalance: extractBalance(findChild(element, "LEDGERBAL")),
    availableBalance: extractBalance(findChild(element, "AVAILBAL")),
    startDate: extractDateOnly(transactionList ? findChild(transactionList, "DTSTART") : undefined),
    endDate: extractDateOnly(transactionList ? findChild(transactionList, "DTEND") : undefined),
  };
}

function extractCreditCardStatement(
  element: OfxElement,
  issues: ImportIssue[],
  limits: OfxParseLimits,
): ExtractedStatement {
  const accountFrom = findChild(element, "CCACCTFROM");
  const accountId = maskAccountHint(getText(findChild(accountFrom ?? element, "ACCTID")));
  const currency = getText(findChild(element, "CURDEF")).toUpperCase();
  const transactionList = findChild(element, "BANKTRANLIST");

  return {
    accountType: "credit-card",
    currency,
    accountHint: accountId,
    transactions: extractTransactions(transactionList, issues, limits, currency),
    ledgerBalance: extractBalance(findChild(element, "LEDGERBAL")),
    availableBalance: extractBalance(findChild(element, "AVAILBAL")),
    startDate: extractDateOnly(transactionList ? findChild(transactionList, "DTSTART") : undefined),
    endDate: extractDateOnly(transactionList ? findChild(transactionList, "DTEND") : undefined),
  };
}

function maskAccountHint(value: string): string {
  if (value.length <= 4) return "*".repeat(value.length);
  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}

function normalizeBankAccountType(value: string): ExtractedStatement["accountType"] {
  switch (value.toLowerCase()) {
    case "checking":
      return "checking";
    case "savings":
      return "savings";
    case "creditline":
    case "creditcard":
      return "credit-card";
    default:
      return "other";
  }
}

function extractTransactions(
  transactionList: OfxElement | undefined,
  issues: ImportIssue[],
  limits: OfxParseLimits,
  statementCurrency: string,
): readonly SourceRow[] {
  if (transactionList === undefined) return [];

  const rows: SourceRow[] = [];
  const transactions = findChildren(transactionList, "STMTTRN");

  if (transactions.length > limits.maxTransactions) {
    issues.push({
      code: "TRANSACTION_LIMIT_EXCEEDED",
      severity: "error",
      message: `Transaction count ${transactions.length} exceeds the configured limit`,
    });
    return rows;
  }

  let index = 0;
  for (const transaction of transactions) {
    index += 1;
    const location = `statement:1/transaction:${index}`;
    const amountResult = parseOfxAmount(getText(findChild(transaction, "TRNAMT")));
    if (amountResult === undefined) {
      issues.push({
        code: "INVALID_AMOUNT",
        severity: "error",
        sourceLocation: location,
        field: "TRNAMT",
        message: "Transaction amount is missing or malformed",
      });
      continue;
    }

    const postedDate = parseOfxDate(getText(findChild(transaction, "DTPOSTED")));
    if (postedDate === undefined) {
      issues.push({
        code: "INVALID_DATE",
        severity: "error",
        sourceLocation: location,
        field: "DTPOSTED",
        message: "Transaction posted date is missing or malformed",
      });
      continue;
    }

    const name = getText(findChild(transaction, "NAME"));
    const memo = getText(findChild(transaction, "MEMO"));
    const description = [name, memo].filter((part) => part.length > 0).join(" — ");
    if (description.length === 0) {
      issues.push({
        code: "MISSING_DESCRIPTION",
        severity: "error",
        sourceLocation: location,
        field: "NAME",
        message: "Transaction description is empty",
      });
      continue;
    }

    const fields: Record<string, string> = {
      postedDate: postedDate.dateOnly,
      amount: minorToDecimal(amountResult.minor),
      description,
      currency: statementCurrency,
      sourceTransactionId: getText(findChild(transaction, "FITID")),
      // Provenance metadata, not canonical mapping targets.
      DTPOSTED: postedDate.raw,
      TRNAMT: getText(findChild(transaction, "TRNAMT")),
      NAME: name,
      MEMO: memo,
      TRNTYPE: getText(findChild(transaction, "TRNTYPE")),
      CHECKNUM: getText(findChild(transaction, "CHECKNUM")),
      REFNUM: getText(findChild(transaction, "REFNUM")),
      SIC: getText(findChild(transaction, "SIC")),
    };

    const userDate = parseOfxDate(getText(findChild(transaction, "DTUSER")));
    if (userDate !== undefined) {
      fields["transactionDate"] = userDate.dateOnly;
      fields["DTUSER"] = userDate.raw;
    }
    const availDate = parseOfxDate(getText(findChild(transaction, "DTAVAIL")));
    if (availDate !== undefined) {
      fields["DTAVAIL"] = availDate.raw;
    }

    for (const [key, value] of Object.entries(fields)) {
      if (value.length > limits.maxFieldLength) {
        issues.push({
          code: "FIELD_LIMIT_EXCEEDED",
          severity: "error",
          sourceLocation: location,
          field: key,
          message: `${key} exceeds the configured field length limit`,
        });
      }
    }

    rows.push({ sourceLocation: location, fields });
  }

  return rows;
}

function extractBalance(element: OfxElement | undefined):
  | {
      readonly amount: string;
      readonly date: string;
    }
  | undefined {
  if (element === undefined) return undefined;
  const amountResult = parseOfxAmount(getText(findChild(element, "BALAMT") ?? undefined));
  const dateResult = parseOfxDate(getText(findChild(element, "DTASOF") ?? undefined));
  if (amountResult === undefined || dateResult === undefined) return undefined;
  return { amount: minorToDecimal(amountResult.minor), date: dateResult.dateOnly };
}

function extractDateOnly(element: OfxElement | undefined): string | undefined {
  if (element === undefined) return undefined;
  const result = parseOfxDate(element.value);
  return result?.dateOnly;
}
