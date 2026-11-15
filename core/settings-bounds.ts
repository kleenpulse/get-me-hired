// The ranges the app allows for its settings, in one place. The Settings screen
// keeps the user inside them, and a backup's values outside them are ignored.
// A value far outside could make follow-up dates take minutes to work out.

import type { Cadence } from './lifecycle';

/** FRD §8.2: each follow-up delay is 3 to 10 working days, with 0 to 3 follow-ups. */
export const DELAY_RANGE = { min: 3, max: 10 } as const;
export const MAX_FOLLOWUPS = 3;
/** Working days after the last follow-up before a lead moves to "no reply" (§8.2). */
export const CLOSE_RANGE = { min: 3, max: 10 } as const;
/** People to write to in a day (FR-4.14). */
export const DAILY_TARGET_RANGE = { min: 1, max: 100 } as const;

export function isWholeIn(value: unknown, range: { min: number; max: number }): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= range.min && value <= range.max;
}

export function isValidCadence(value: unknown): value is Cadence {
  if (typeof value !== 'object' || value === null) return false;
  const { followupDelays, closeAfter } = value as Record<string, unknown>;
  return (
    Array.isArray(followupDelays) &&
    followupDelays.length <= MAX_FOLLOWUPS &&
    followupDelays.every((delay) => isWholeIn(delay, DELAY_RANGE)) &&
    isWholeIn(closeAfter, CLOSE_RANGE)
  );
}

export function isValidDailyTarget(value: unknown): value is number {
  return isWholeIn(value, DAILY_TARGET_RANGE);
}
