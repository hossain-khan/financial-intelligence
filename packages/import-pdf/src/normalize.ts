/**
 * Token normalization shared by layout adapters. Every function here fails closed by returning
 * `undefined` for anything it cannot interpret unambiguously; adapters must never substitute a
 * default date, amount, or sign for an unparseable value.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;
const SLASH_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/u;
const MONTHS: Readonly<Record<string, number>> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const TEXT_DATE = /^(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+(\d{4})$/u;
const MONTH_FIRST_TEXT_DATE = /^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/u;

/**
 * Parse a date token into canonical `YYYY-MM-DD`. Supports ISO, `MM/DD/YYYY`, `DD Mon YYYY`, and
 * `Mon DD, YYYY`. `MM/DD` vs `DD/MM` is genuinely ambiguous, so the slash form is interpreted with
 * an explicit `dayFirst` decision supplied by the adapter rather than guessed per value.
 */
export function parseDate(raw: string, dayFirst: boolean): string | undefined {
  const value = raw.trim().toLowerCase();

  const iso = ISO_DATE.exec(value);
  if (iso) return validate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slash = SLASH_DATE.exec(value);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const year = normalizeYear(Number(slash[3]));
    const month = dayFirst ? b : a;
    const day = dayFirst ? a : b;
    return validate(year, month, day);
  }

  const text = TEXT_DATE.exec(value);
  if (text) {
    const month = MONTHS[text[2] ?? ""];
    if (month !== undefined) return validate(Number(text[3]), month, Number(text[1]));
  }

  const monthFirst = MONTH_FIRST_TEXT_DATE.exec(value);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1] ?? ""];
    if (month !== undefined) return validate(Number(monthFirst[3]), month, Number(monthFirst[2]));
  }

  return undefined;
}

/** Whether a token could be a date in any supported shape (used for column detection scoring). */
export function looksLikeDate(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  return (
    ISO_DATE.test(value) ||
    SLASH_DATE.test(value) ||
    TEXT_DATE.test(value) ||
    MONTH_FIRST_TEXT_DATE.test(value)
  );
}

const AMOUNT_BODY = /^\(?\s*-?\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})\s*\)?-?$/u;
const AMOUNT_PLAIN = /^\(?\s*-?\$?\s*\d+(?:\.\d{2})\s*\)?-?$/u;

/**
 * Parse a monetary token into a signed decimal string with exactly two fraction digits. Recognizes
 * `$`, thousands separators, a leading minus, a trailing minus, and parentheses for negatives. A
 * token without exactly two decimal places is rejected — we never round or infer precision. `debit`
 * forces the sign negative for a value drawn from a debit column (which is written unsigned).
 */
export function parseAmount(
  raw: string,
  options: { readonly debit?: boolean } = {},
): string | undefined {
  const value = raw.trim();
  if (value.length === 0) return undefined;
  if (!AMOUNT_BODY.test(value) && !AMOUNT_PLAIN.test(value)) return undefined;

  const negative = /^\(.*\)$/u.test(value) || value.includes("-") || options.debit === true;
  const digits = value.replaceAll(/[(),$\s-]/gu, "");
  if (!/^\d+\.\d{2}$/u.test(digits)) return undefined;
  const normalized = digits;
  if (normalized === "0.00") return "0.00";
  return negative ? `-${normalized}` : normalized;
}

/** Whether a token could be a monetary amount (used for column detection scoring). */
export function looksLikeAmount(raw: string): boolean {
  const value = raw.trim();
  return AMOUNT_BODY.test(value) || AMOUNT_PLAIN.test(value);
}

function normalizeYear(year: number): number {
  if (year >= 100) return year;
  // Two-digit years: 00–68 → 2000s, 69–99 → 1900s, matching common statement conventions.
  return year <= 68 ? 2000 + year : 1900 + year;
}

function validate(year: number, month: number, day: number): string | undefined {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined;
  }
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) return undefined;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > (daysInMonth[month - 1] ?? 0)) return undefined;
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}
