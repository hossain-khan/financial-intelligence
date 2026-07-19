declare const dateOnlyBrand: unique symbol;
declare const utcTimestampBrand: unique symbol;

export type DateOnly = string & { readonly [dateOnlyBrand]: "DateOnly" };
export type UtcTimestamp = string & { readonly [utcTimestampBrand]: "UtcTimestamp" };

const DATE_ONLY_PATTERN = /^(?<year>[0-9]{4})-(?<month>[0-9]{2})-(?<day>[0-9]{2})$/;
const UTC_TIMESTAMP_PATTERN =
  /^(?<date>[0-9]{4}-[0-9]{2}-[0-9]{2})T(?<hour>[0-9]{2}):(?<minute>[0-9]{2}):(?<second>[0-9]{2})(?<fraction>\.[0-9]+)?Z$/;

export function parseDateOnly(value: string): DateOnly {
  const match = DATE_ONLY_PATTERN.exec(value);

  if (match?.groups === undefined || !isCalendarDate(match.groups)) {
    throw new TypeError(`Invalid ISO date-only value: ${value}`);
  }

  return value as DateOnly;
}

export function parseUtcTimestamp(value: string): UtcTimestamp {
  const match = UTC_TIMESTAMP_PATTERN.exec(value);

  if (match?.groups === undefined) {
    throw new TypeError(`Invalid RFC 3339 UTC timestamp: ${value}`);
  }

  parseDateOnly(match.groups.date ?? "");

  const hour = Number(match.groups.hour);
  const minute = Number(match.groups.minute);
  const second = Number(match.groups.second);

  if (hour > 23 || minute > 59 || second > 59) {
    throw new TypeError(`Invalid RFC 3339 UTC timestamp: ${value}`);
  }

  return value as UtcTimestamp;
}

function isCalendarDate(parts: Record<string, string>): boolean {
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);

  if (year < 1 || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (daysInMonth[month - 1] ?? 0);
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
