export function parseOfxDate(value: string):
  | {
      readonly raw: string;
      readonly dateOnly: string;
      readonly hasOffset: boolean;
      readonly hasTime: boolean;
    }
  | undefined {
  const raw = value.trim();
  if (raw.length === 0) return undefined;

  // YYYYMMDDHHMMSS[.fraction][offset:zone] or YYYYMMDD
  const timestampMatch =
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.(\d{1,3}))?(?:\[([+-]?\d{1,2}):(\w+)\])?$/u.exec(
      raw,
    );
  if (timestampMatch !== null) {
    const year = Number(timestampMatch[1]);
    const month = Number(timestampMatch[2]);
    const day = Number(timestampMatch[3]);
    const hour = Number(timestampMatch[4]);
    const minute = Number(timestampMatch[5]);
    const second = Number(timestampMatch[6]);
    const fraction = timestampMatch[7];
    const offset = timestampMatch[8];

    if (!validCalendarDate(year, month, day)) return undefined;
    if (hour > 23 || minute > 59 || second > 59) return undefined;

    const fractionMillis = fraction === undefined ? 0 : Number(fraction.padEnd(3, "0").slice(0, 3));
    if (!Number.isFinite(fractionMillis) || fractionMillis < 0 || fractionMillis > 999) {
      return undefined;
    }

    return {
      raw,
      dateOnly: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      hasOffset: offset !== undefined,
      hasTime: true,
    };
  }

  const dateOnlyMatch = /^(\d{4})(\d{2})(\d{2})$/u.exec(raw);
  if (dateOnlyMatch !== null) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    if (!validCalendarDate(year, month, day)) return undefined;
    return {
      raw,
      dateOnly: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      hasOffset: false,
      hasTime: false,
    };
  }

  return undefined;
}

function validCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (days[month - 1] ?? 0);
}
