import { describe, expect, it } from 'vitest';
import { emptyProfile } from '@/core/profile';
import { buildSampleFinds } from '@/core/sample-leads';
import { spendRecords, capState } from './cap';
import { emptyData, withDefaults, type AppData, type HuntCheckpoint } from './data';
import { settleInterrupted } from './interrupted';
import { shouldRunOnOpen } from './run-on-open';

const NOW = new Date('2026-11-15T12:00:00Z');
// Invented sample leads, marked as real for this test.
const found = buildSampleFinds(NOW).community.map((lead) => ({ ...lead, sample: false }));

const checkpoint = (extra: Partial<HuntCheckpoint> = {}): HuntCheckpoint => ({
  at: '2026-11-14T22:00:00.000Z',
  date: '2026-11-14',
  provider: 'gemini',
  steps: [{ id: 'community', state: 'running', count: 8 }],
  leads: found,
  dropped: [],
  usage: { calls: 3, inputTokens: 9000, outputTokens: 900, unreported: 1 },
  chargedUsd: 0.04,
  ...extra,
});

describe('a hunt that stopped partway (FR-4.15)', () => {
  it('is recorded as a cancelled run on the day it ran, with its cost and the leads it found', () => {
    const data: AppData = { ...emptyData(), huntInProgress: checkpoint() };
    const after = settleInterrupted(data);
    expect(after.huntInProgress).toBeNull();
    expect(after.runs).toHaveLength(1);
    expect(after.runs[0]).toMatchObject({ status: 'cancelled', date: localDay('2026-11-14T22:00:00.000Z'), listCost: 0.04, unreported: 1, kept: found.length });
    expect(after.leads.map((lead) => lead.key)).toEqual(found.map((lead) => lead.key));
  });

  it('changes nothing when no hunt is in progress', () => {
    const data = emptyData();
    expect(settleInterrupted(data)).toBe(data);
  });

  it('counts what it spent toward the monthly cap until it is settled', () => {
    const data: AppData = { ...emptyData(), huntInProgress: checkpoint({ date: '2026-11-15', chargedUsd: 2 }), settings: { ...emptyData().settings, monthlyCap: 2 } };
    expect(spendRecords(data)).toEqual([{ date: '2026-11-15', sample: false, listCost: 2, unreported: 1 }]);
    expect(capState(data, 'gemini', '2026-11-15').kind).toBe('cap-reached');
  });

  it('keeps run on open from starting until the user chooses', () => {
    const ready: AppData = {
      ...emptyData(),
      profile: { ...emptyProfile(), roles: ['Frontend'], skills: ['React'], location: 'Lagos', floor: '$60k' },
      settings: { ...emptyData().settings, welcomeDone: true, provider: 'gemini', runOnOpen: true },
    };
    expect(shouldRunOnOpen(ready, ['gemini'], '2026-11-15')).toBe(true);
    expect(shouldRunOnOpen({ ...ready, huntInProgress: checkpoint() }, ['gemini'], '2026-11-15')).toBe(false);
  });

  it('is read back only when its shape is right', () => {
    const saved = (value: unknown) => withDefaults({ ...emptyData(), huntInProgress: value as HuntCheckpoint }).huntInProgress;
    expect(saved(checkpoint())).toMatchObject({ provider: 'gemini' });
    expect(saved({ at: 'x' })).toBeNull();
    expect(saved('nope')).toBeNull();
  });
});

function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
