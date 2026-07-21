import { OfxImportError } from "./errors";

export interface OfxDate {
  /** Canonical date-only value in the statement's wall-clock terms, `YYYY-MM-DD`. */
  readonly date: string;
  /** The exact source string, preserved for provenance. */
  readonly raw: string;
}

/**
 * Parse an OFX date/datetime with a dedicated grammar rather than `Date.parse`, which is
 * implementation-defined for these strings. The OFX format is:
 *
 *   YYYYMMDD[HHMMSS[.XXX]][[+/-gmt-offset[.XX]:zone]]
 *
 * We validate every calendar and offset component and derive the canonical date deterministically
 * from the wall-clock fields as written (the offset is validated and preserved, not applied — a
 * posted date is a calendar day in the statement's own terms). Any deviation is a hard error so a
 * malformed timestamp can never silently become a wrong or "Invalid Date" value.
 */
export function parseOfxDate(raw: string): OfxDate {
  const value = raw.trim();
  const match =
    /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})(?:\.(\d{1,3}))?)?(?:\[([+-]?\d+(?:\.\d{1,2})?):([A-Za-z0-9_+/-]{1,32})\])?$/u.exec(
      value,
    );
  if (match === null) {
    throw new OfxImportError(
      "MALFORMED_DOCUMENT",
      `Date “${value}” does not match the OFX timestamp grammar`,
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidCalendarDate(year, month, day)) {
    throw new OfxImportError("MALFORMED_DOCUMENT", `Date “${value}” is not a valid calendar date`);
  }
  if (match[4] !== undefined) {
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);
    if (hour > 23 || minute > 59 || second > 59) {
      throw new OfxImportError(
        "MALFORMED_DOCUMENT",
        `Time in “${value}” is outside the valid range`,
      );
    }
  }
  if (match[8] !== undefined) {
    const offset = Number(match[8]);
    if (!Number.isFinite(offset) || offset < -12 || offset > 14) {
      throw new OfxImportError(
        "MALFORMED_DOCUMENT",
        `GMT offset in “${value}” is outside the valid range`,
      );
    }
  }
  const date = `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
  return { date, raw: value };
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (daysInMonth[month - 1] ?? 0);
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}
