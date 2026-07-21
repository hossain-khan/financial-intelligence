import type { ImportIssue } from "@financial-intelligence/import-core";

import type {
  LayoutDetection,
  PdfLayoutResult,
  PdfLayoutRow,
  PdfStatementLayoutAdapter,
} from "../layout";
import type { PdfTextDocument } from "../model";
import { looksLikeAmount, looksLikeDate, parseAmount, parseDate } from "../normalize";
import { groupLines, lineLocation, type TextLine } from "../text-grid";

const LINE_TOLERANCE = 3;
const ADAPTER_ID = "generic-tabular";
const ADAPTER_VERSION = "1.0.0";

interface ColumnLayout {
  readonly date: number;
  readonly description: number;
  readonly amount?: number;
  readonly debit?: number;
  readonly credit?: number;
  /** Left edge of the amount region; text right of here is not part of the description. */
  readonly valueBoundary: number;
  readonly dayFirst: boolean;
}

const HEADER_TOKENS = {
  date: /^(date|posted|transaction date|trans date|posting date)$/u,
  description: /^(description|details|transaction|narrative|particulars|memo|payee)$/u,
  amount: /^(amount|value)$/u,
  debit: /^(debit|debits|withdrawal|withdrawals|payments|paid out)$/u,
  credit: /^(credit|credits|deposit|deposits|received|paid in)$/u,
};

/** Lines matching these are statement summary/total rows, never transactions. */
const SUMMARY_LINE =
  /\b(opening balance|closing balance|balance (brought|carried) forward|statement total|total (debits|credits|withdrawals|deposits)|subtotal|ending balance|beginning balance|page \d+ of \d+)\b/iu;

const CURRENCY_HINT = /\b(USD|CAD|EUR|GBP|AUD|JPY|CHF|NZD)\b/u;

/**
 * A single generic adapter for statements laid out as a date / description / amount (or
 * debit/credit) table. It detects the header row, derives column x-bands from header item
 * positions, then walks the body: a line whose first cell parses as a date starts a transaction,
 * and a subsequent dateless line with only description text is folded in as a wrapped continuation.
 * Repeated headers, footers, and summary rows are skipped. Nothing is invented — a row missing a
 * usable date or amount is reported as an issue, not guessed.
 */
export class GenericTabularAdapter implements PdfStatementLayoutAdapter {
  public readonly id = ADAPTER_ID;
  public readonly version = ADAPTER_VERSION;
  public readonly minimumScore = 0.5;

  public detect(document: PdfTextDocument): LayoutDetection {
    const found = this.findColumns(document);
    if (found === undefined) {
      return {
        adapterId: this.id,
        score: 0,
        reason: "No date/description/amount header row found",
      };
    }

    // Confidence blends "we found a usable header" with "the body actually looks like dated,
    // money-bearing rows", so a document with the right headers but no tabular data does not win.
    const sample = this.sampleBody(document, found.columns);
    const dateRatio = sample.total === 0 ? 0 : sample.dated / sample.total;
    const amountRatio = sample.total === 0 ? 0 : sample.withAmount / sample.total;
    const score = Number((0.4 + 0.3 * dateRatio + 0.3 * amountRatio).toFixed(4));
    return {
      adapterId: this.id,
      score,
      reason: `Header row on page ${found.page}; ${sample.dated}/${sample.total} sampled rows dated`,
    };
  }

  public extract(document: PdfTextDocument, signal: AbortSignal): PdfLayoutResult {
    const found = this.findColumns(document);
    if (found === undefined) {
      return {
        rows: [],
        issues: [issue("UNSUPPORTED_LAYOUT", "error", "No recognizable statement table was found")],
        detectedMetadata: { adapterId: this.id, adapterVersion: this.version },
      };
    }

    const columns = found.columns;
    const currency = detectCurrency(document);
    const rows: PdfLayoutRow[] = [];
    const issues: ImportIssue[] = [];
    let current: MutableRow | undefined;

    const flush = (): void => {
      if (current === undefined) return;
      const row = finalizeRow(current, columns, currency, issues);
      if (row !== undefined) rows.push(row);
      current = undefined;
    };

    for (let pageNumber = 1; pageNumber <= document.pageCount; pageNumber += 1) {
      if (signal.aborted) break;
      const page = document.pages[pageNumber - 1];
      if (page === undefined) continue;
      const lines = groupLines(page, LINE_TOLERANCE);
      for (const line of lines) {
        if (isNoiseLine(line, columns)) {
          // A repeated header ends the row in progress but is not itself data.
          flush();
          continue;
        }
        const cells = splitCells(line, columns);
        const dateToken = cells.date.trim();
        const parsedDate =
          dateToken.length === 0 ? undefined : parseDate(dateToken, columns.dayFirst);

        if (parsedDate !== undefined) {
          flush();
          current = {
            postedDate: parsedDate,
            originalDate: dateToken,
            description: cells.description.trim(),
            amountToken: cells.amountToken,
            debitToken: cells.debitToken,
            creditToken: cells.creditToken,
            locations: [lineLocation(line)],
          };
        } else if (
          current !== undefined &&
          dateToken.length === 0 &&
          cells.description.trim().length > 0
        ) {
          // Wrapped description continuation: no date, no new amount, just more narrative text.
          if (cells.amountToken.trim().length === 0) {
            current.description = `${current.description} ${cells.description.trim()}`.trim();
            current.locations.push(lineLocation(line));
          } else {
            flush();
          }
        } else {
          flush();
        }
      }
      // Do not flush across the page boundary until the next dated line: a transaction's wrapped
      // description can continue onto the next page, so the row stays open.
    }
    flush();

    return {
      rows,
      issues,
      detectedMetadata: {
        adapterId: this.id,
        adapterVersion: this.version,
        columnMode: columns.amount !== undefined ? "signed-amount" : "debit-credit",
        ...(currency === undefined ? {} : { currency }),
      },
    };
  }

  private findColumns(
    document: PdfTextDocument,
  ): { readonly columns: ColumnLayout; readonly page: number } | undefined {
    for (const page of document.pages) {
      const lines = groupLines(page, LINE_TOLERANCE);
      for (const line of lines) {
        const columns = deriveColumns(line);
        if (columns !== undefined) return { columns, page: page.pageNumber };
      }
    }
    return undefined;
  }

  private sampleBody(
    document: PdfTextDocument,
    columns: ColumnLayout,
  ): { total: number; dated: number; withAmount: number } {
    let total = 0;
    let dated = 0;
    let withAmount = 0;
    for (const page of document.pages) {
      for (const line of groupLines(page, LINE_TOLERANCE)) {
        if (isNoiseLine(line, columns)) continue;
        const cells = splitCells(line, columns);
        if (cells.date.trim().length === 0 && cells.description.trim().length === 0) continue;
        total += 1;
        if (parseDate(cells.date.trim(), columns.dayFirst) !== undefined) dated += 1;
        if (
          parseAmount(cells.amountToken) !== undefined ||
          parseAmount(cells.debitToken, { debit: true }) !== undefined ||
          parseAmount(cells.creditToken) !== undefined
        ) {
          withAmount += 1;
        }
        if (total >= 40) return { total, dated, withAmount };
      }
    }
    return { total, dated, withAmount };
  }
}

interface MutableRow {
  postedDate: string;
  originalDate: string;
  description: string;
  amountToken: string;
  debitToken: string;
  creditToken: string;
  locations: string[];
}

interface Cells {
  readonly date: string;
  readonly description: string;
  readonly amountToken: string;
  readonly debitToken: string;
  readonly creditToken: string;
}

function deriveColumns(line: TextLine): ColumnLayout | undefined {
  let date: number | undefined;
  let description: number | undefined;
  let amount: number | undefined;
  let debit: number | undefined;
  let credit: number | undefined;

  for (const item of line.items) {
    const token = item.text.trim().toLowerCase();
    if (date === undefined && HEADER_TOKENS.date.test(token)) date = item.x;
    else if (description === undefined && HEADER_TOKENS.description.test(token))
      description = item.x;
    else if (amount === undefined && HEADER_TOKENS.amount.test(token)) amount = item.x;
    else if (debit === undefined && HEADER_TOKENS.debit.test(token)) debit = item.x;
    else if (credit === undefined && HEADER_TOKENS.credit.test(token)) credit = item.x;
  }

  if (date === undefined || description === undefined) return undefined;
  const hasSigned = amount !== undefined;
  const hasSplit = debit !== undefined && credit !== undefined;
  if (!hasSigned && !hasSplit) return undefined;

  const valueBoundary = hasSigned
    ? (amount as number)
    : Math.min(debit as number, credit as number);
  if (valueBoundary <= description) return undefined;

  return {
    date,
    description,
    ...(amount === undefined ? {} : { amount }),
    ...(debit === undefined ? {} : { debit }),
    ...(credit === undefined ? {} : { credit }),
    valueBoundary,
    // Column x-order is fixed by the header; day-first is inferred once from the header language and
    // left false by default (ISO and Mon-name dates are unambiguous regardless).
    dayFirst: false,
  };
}

function splitCells(line: TextLine, columns: ColumnLayout): Cells {
  const midDescription = (columns.description + columns.valueBoundary) / 2;
  const dateParts: string[] = [];
  const descriptionParts: string[] = [];
  const amountParts: string[] = [];
  const debitParts: string[] = [];
  const creditParts: string[] = [];

  for (const item of line.items) {
    const text = item.text.trim();
    if (text.length === 0) continue;
    if (item.x < midDescription) {
      // Left region: date column vs description column, split at the description header x.
      if (item.x < columns.description - 1) dateParts.push(text);
      else descriptionParts.push(text);
    } else if (columns.amount !== undefined) {
      amountParts.push(text);
    } else {
      const debitX = columns.debit ?? Number.POSITIVE_INFINITY;
      const creditX = columns.credit ?? Number.POSITIVE_INFINITY;
      const boundary = (debitX + creditX) / 2;
      if (item.x < boundary) debitParts.push(text);
      else creditParts.push(text);
    }
  }

  return {
    date: dateParts.join(" "),
    description: descriptionParts.join(" "),
    amountToken: amountParts.join(""),
    debitToken: debitParts.join(""),
    creditToken: creditParts.join(""),
  };
}

function finalizeRow(
  row: MutableRow,
  columns: ColumnLayout,
  currency: string | undefined,
  issues: ImportIssue[],
): PdfLayoutRow | undefined {
  const sourceLocation = row.locations.join(";");
  const description = row.description.trim();

  let amount: string | undefined;
  let originalAmount: string;
  if (columns.amount !== undefined) {
    amount = parseAmount(row.amountToken);
    originalAmount = row.amountToken.trim();
  } else {
    const debit = parseAmount(row.debitToken, { debit: true });
    const credit = parseAmount(row.creditToken);
    if (debit !== undefined && credit !== undefined) {
      issues.push(
        issue(
          "AMBIGUOUS_AMOUNT",
          "error",
          "Row has both a debit and a credit value",
          sourceLocation,
        ),
      );
      return undefined;
    }
    amount = debit ?? credit;
    originalAmount = `${row.debitToken} ${row.creditToken}`.trim();
  }

  if (amount === undefined) {
    issues.push(
      issue("MISSING_AMOUNT", "error", "No usable amount found for a dated row", sourceLocation),
    );
    return undefined;
  }
  if (description.length === 0) {
    issues.push(
      issue("MISSING_DESCRIPTION", "error", "No description found for a dated row", sourceLocation),
    );
    return undefined;
  }

  return {
    sourceLocation,
    postedDate: row.postedDate,
    description,
    amount,
    ...(currency === undefined ? {} : { currency }),
    original: {
      postedDate: row.originalDate,
      description,
      amount: originalAmount,
    },
  };
}

function isNoiseLine(line: TextLine, columns: ColumnLayout): boolean {
  if (line.text.length === 0) return true;
  if (SUMMARY_LINE.test(line.text)) return true;
  // A repeated header line re-derives to the same column set.
  return deriveColumns(line) !== undefined && !hasBodyData(line, columns);
}

function hasBodyData(line: TextLine, columns: ColumnLayout): boolean {
  const cells = splitCells(line, columns);
  return (
    looksLikeDate(cells.date.trim()) ||
    looksLikeAmount(cells.amountToken) ||
    looksLikeAmount(cells.debitToken) ||
    looksLikeAmount(cells.creditToken)
  );
}

function detectCurrency(document: PdfTextDocument): string | undefined {
  for (const page of document.pages) {
    for (const item of page.items) {
      const match = CURRENCY_HINT.exec(item.text);
      if (match) return match[1];
    }
    // Only scan the first page's worth to keep detection bounded and cheap.
    break;
  }
  return undefined;
}

function issue(
  code: string,
  severity: ImportIssue["severity"],
  message: string,
  sourceLocation?: string,
): ImportIssue {
  return {
    code,
    severity,
    message,
    ...(sourceLocation === undefined ? {} : { sourceLocation }),
  };
}
