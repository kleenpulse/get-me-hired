// Where this month's spending stands against the cap (FR-4.13, AC-4.13), for
// the Today screen and for the check before a hunt starts. One place, so the
// note under the button and the check always agree.

import { capBlocksStart, huntEstimate, isFreeModel, spentThisMonth, type MonthSpend, type SpendRecord } from '@/core/budget';
import { PROVIDERS, type ProviderId } from '@/core/providers';
import type { AppData } from './data';

/**
 * What counts toward this month's spending: the saved runs, and a hunt still
 * running or stopped partway, at what it has spent so far (FR-4.15, AC-4.13).
 */
export function spendRecords(data: Pick<AppData, 'runs' | 'huntInProgress'>): SpendRecord[] {
  const live = data.huntInProgress;
  return live ? [...data.runs, { date: live.date, sample: false, listCost: live.chargedUsd, unreported: live.usage.unreported }] : data.runs;
}

export type CapState =
  /** The model costs nothing at its list price: no cap applies. */
  | { kind: 'free' }
  | { kind: 'ok' | 'cap-reached' | 'over-cap'; estimate: number; spent: MonthSpend; cap: number }
  /** The model has no known price, so the cap can't be kept. */
  | { kind: 'no-price' };

export function capState(data: Pick<AppData, 'runs' | 'settings' | 'huntInProgress'>, provider: ProviderId, today: string): CapState {
  const model = PROVIDERS[provider].model;
  if (isFreeModel(model)) return { kind: 'free' };
  const estimate = huntEstimate(model);
  if (estimate === null) return { kind: 'no-price' };
  const spent = spentThisMonth(spendRecords(data), today);
  const cap = data.settings.monthlyCap;
  const blocked = capBlocksStart(model, spent, cap);
  return { kind: blocked === 'cap-reached' || blocked === 'over-cap' ? blocked : 'ok', estimate, spent, cap };
}

/** True when a real hunt may start under the cap. */
export function capAllowsStart(state: CapState): boolean {
  return state.kind === 'free' || state.kind === 'ok';
}
