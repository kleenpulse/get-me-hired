import { describe, expect, it } from 'vitest';
import { huntEstimate } from '@/core/budget';
import { capAllowsStart, capState } from './cap';
import { emptyData, type AppData, type RunRecord } from './data';

const TODAY = '2026-11-15';

function withSpend(listCost: number, monthlyCap = 2): AppData {
  const run: RunRecord = { at: '2026-11-02T09:00:00.000Z', date: '2026-11-02', status: 'completed', kept: 0, dropped: [], sample: false, listCost };
  return { ...emptyData(), runs: [run], settings: { ...emptyData().settings, monthlyCap } };
}

describe('the cap on the Today screen (AC-4.13)', () => {
  const estimate = huntEstimate('gemini-3.1-flash-lite') ?? 0;

  it('shows the estimate and what is spent, and lets the hunt start', () => {
    const state = capState(withSpend(0.5), 'gemini', TODAY);
    expect(state).toEqual({ kind: 'ok', estimate, spent: { usd: 0.5, partial: false }, cap: 2 });
    expect(capAllowsStart(state)).toBe(true);
  });

  it("won't start a hunt that could go past the cap, or once it's reached", () => {
    expect(capState(withSpend(2 - estimate / 2), 'gemini', TODAY).kind).toBe('over-cap');
    expect(capState(withSpend(2), 'gemini', TODAY).kind).toBe('cap-reached');
    expect(capAllowsStart(capState(withSpend(2), 'gemini', TODAY))).toBe(false);
  });

  it('counts last month as spent no more', () => {
    expect(capState(withSpend(2), 'gemini', '2026-12-01').kind).toBe('ok');
  });

  it('leaves a free model alone', () => {
    expect(capState(withSpend(2), 'openrouter', TODAY)).toEqual({ kind: 'free' });
  });
});
