// Calendar dates as `YYYY-MM-DD` strings in the user's own time zone, and
// working-day sums (FRD §8.2). Dates are handled as plain calendar days, with
// no time of day, so daylight saving changes can't shift them.

const DAY_MS = 86_400_000;

/** The local calendar date of a moment, as `YYYY-MM-DD`. */
export function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toUtcMs(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Adds calendar days. `days` may be negative. */
export function addDays(day: string, days: number): string {
  return fromUtcMs(toUtcMs(day) + days * DAY_MS);
}

/** Whole calendar days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** Monday to Friday (FRD §8.2). */
export function isWorkingDay(day: string): boolean {
  const weekday = new Date(toUtcMs(day)).getUTCDay();
  return weekday !== 0 && weekday !== 6;
}

/** The most working days `addWorkingDays` will add: about a year and a half. */
export const MAX_WORKING_DAYS = 366;

/**
 * The date `count` working days after `day`. The start day itself is not
 * counted, so 5 working days after a Monday is the next Monday (AC-6.4).
 */
export function addWorkingDays(day: string, count: number): string {
  let current = day;
  // At most a year of working days. The walk is one day at a time, so a huge count
  // from a bad file must never reach it: it would freeze the app (FRD §8.2 delays are 3 to 10).
  let left = Number.isFinite(count) ? Math.min(Math.max(0, Math.floor(count)), MAX_WORKING_DAYS) : 0;
  while (left > 0) {
    current = addDays(current, 1);
    if (isWorkingDay(current)) left -= 1;
  }
  return current;
}
