import { describe, expect, it } from 'vitest';
import { emptyProfile, type Profile } from '@/core/profile';
import { emptyData, withDefaults, type AppData, type RunRecord } from './data';
import { shouldRunOnOpen } from './run-on-open';

const TODAY = '2026-11-15';

// An invented profile with every field a real hunt needs.
const PROFILE: Profile = { ...emptyProfile(), roles: ['Frontend engineer'], skills: ['React'], location: 'Lagos', floor: '$60k' };

function ready(change: Partial<AppData['settings']> = {}, runs: RunRecord[] = []): AppData {
  const fresh = emptyData();
  return {
    ...fresh,
    profile: PROFILE,
    runs,
    settings: { ...fresh.settings, welcomeDone: true, provider: 'gemini', runOnOpen: true, ...change },
  };
}

const run = (date: string, extra: Partial<RunRecord> = {}): RunRecord => ({
  at: `${date}T08:00:00.000Z`,
  date,
  status: 'completed',
  kept: 0,
  dropped: [],
  sample: false,
  listCost: 0,
  ...extra,
});

describe('run on open (FR-4.2)', () => {
  it("starts today's hunt when everything is ready and it hasn't run today", () => {
    expect(shouldRunOnOpen(ready(), ['gemini'], TODAY)).toBe(true);
    expect(shouldRunOnOpen(ready({}, [run('2026-11-14')]), ['gemini'], TODAY)).toBe(true);
  });

  it('is off until the user turns it on', () => {
    expect(emptyData().settings.runOnOpen).toBe(false);
    expect(shouldRunOnOpen(ready({ runOnOpen: false }), ['gemini'], TODAY)).toBe(false);
  });

  it("doesn't start before the welcome is done, or in sample mode", () => {
    expect(shouldRunOnOpen(ready({ welcomeDone: false }), ['gemini'], TODAY)).toBe(false);
    expect(shouldRunOnOpen(ready({ sampleMode: true }), ['gemini'], TODAY)).toBe(false);
  });

  it("doesn't start without a provider and its key, or with a profile missing a field", () => {
    expect(shouldRunOnOpen(ready({ provider: null }), ['gemini'], TODAY)).toBe(false);
    expect(shouldRunOnOpen(ready(), [], TODAY)).toBe(false);
    expect(shouldRunOnOpen(ready(), ['openrouter'], TODAY)).toBe(false);
    expect(shouldRunOnOpen({ ...ready(), profile: { ...PROFILE, floor: '' } }, ['gemini'], TODAY)).toBe(false);
    expect(shouldRunOnOpen({ ...ready(), profile: null }, ['gemini'], TODAY)).toBe(false);
  });

  it('counts any real hunt today, even one that failed or was cancelled, so it never loops', () => {
    for (const status of ['completed', 'failed', 'cancelled'] as const) {
      expect(shouldRunOnOpen(ready({}, [run(TODAY, { status })]), ['gemini'], TODAY)).toBe(false);
    }
    // A sample hunt today isn't a real one.
    expect(shouldRunOnOpen(ready({}, [run(TODAY, { sample: true })]), ['gemini'], TODAY)).toBe(true);
  });

  it("doesn't start when the monthly cap would stop it (AC-4.13)", () => {
    expect(shouldRunOnOpen(ready({ monthlyCap: 1 }, [run('2026-11-02', { listCost: 1 })]), ['gemini'], TODAY)).toBe(false);
  });

  it('reads only a real true from saved data', () => {
    const saved = (value: unknown) => withDefaults({ ...emptyData(), settings: { ...emptyData().settings, runOnOpen: value as boolean } });
    expect(saved(true).settings.runOnOpen).toBe(true);
    expect(saved('yes').settings.runOnOpen).toBe(false);
    expect(saved(1).settings.runOnOpen).toBe(false);
  });
});
