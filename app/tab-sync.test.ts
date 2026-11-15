import { describe, expect, it } from 'vitest';
import { emptyData, type AppData } from './data';
import { revisionOf, StaleDataError } from './storage';
import { needsRekey, TabSync, type SyncStorage } from './tab-sync';

/** One stored record shared by "tabs", with saveData's check: write only over the revision you have. */
function sharedStorage(initial: AppData | null) {
  let record: AppData | null = initial;
  let gate: Promise<void> = Promise.resolve();
  const storage: SyncStorage = {
    load: async () => {
      await gate;
      return record;
    },
    save: async (data, base) => {
      if (revisionOf(record) !== base) throw new StaleDataError();
      record = { ...data, revision: base + 1 };
      return base + 1;
    },
  };
  return {
    storage,
    record: () => record,
    /** Another tab saves. */
    otherTabSaves: (change: Partial<AppData>) => {
      record = { ...(record ?? emptyData()), ...change, revision: revisionOf(record) + 1 };
    },
    /** Holds reads until `release` is called, like a slow IndexedDB read. */
    holdReads: () => {
      let release = () => {};
      gate = new Promise((done) => {
        release = done;
      });
      return () => release();
    },
  };
}

function tab(storage: SyncStorage) {
  const shown: AppData[] = [];
  let dropped = 0;
  const sync = new TabSync(storage, { replace: (data) => shown.push(data), dropped: () => (dropped += 1) });
  return { sync, shown, dropped: () => dropped };
}

const at = (revision: number, dailyTarget = 20): AppData => ({
  ...emptyData(),
  settings: { ...emptyData().settings, dailyTarget },
  revision,
});

describe('one tab in step with the others (NFR-7)', () => {
  it('saves over the revision it read, and keeps the generation out of storage', async () => {
    const shared = sharedStorage(at(2));
    const { sync } = tab(shared.storage);
    const mine = sync.start(at(2));
    expect(await sync.write({ ...mine!, settings: { ...mine!.settings, dailyTarget: 30 } })).toBe('saved');
    expect(shared.record()).toMatchObject({ revision: 3, settings: { dailyTarget: 30 } });
    expect(shared.record()).not.toHaveProperty('tabGeneration');
  });

  it('never writes over a save from another tab, and reads it in instead', async () => {
    const shared = sharedStorage(at(2));
    const one = tab(shared.storage);
    const mine = one.sync.start(at(2))!;
    shared.otherTabSaves({ notes: 'theirs' } as Partial<AppData>);
    expect(await one.sync.write({ ...mine, settings: { ...mine.settings, dailyTarget: 30 } })).toBe('dropped');
    expect(shared.record()).toMatchObject({ revision: 3, settings: { dailyTarget: 20 } });
    expect(one.shown.at(-1)).toMatchObject({ revision: 3 });
    expect(one.dropped()).toBe(1);
  });

  it('drops a copy built before a reload, even though the revision would let it through', async () => {
    const shared = sharedStorage(at(1));
    const one = tab(shared.storage);
    const old = one.sync.start(at(1))!;
    // Another tab saves (revision 2), and this tab starts reading it in. The read is slow.
    shared.otherTabSaves({ settings: { ...at(1).settings, monthlyCap: 9 } });
    const release = shared.holdReads();
    const reading = one.sync.reload();
    // Meanwhile a change is made here on the old copy, and queued behind the read.
    const writing = one.sync.write({ ...old, settings: { ...old.settings, dailyTarget: 33 } });
    release();
    await reading;
    expect(await writing).toBe('dropped');
    // Storage still holds the other tab's save, untouched.
    expect(shared.record()).toMatchObject({ revision: 2, settings: { monthlyCap: 9, dailyTarget: 20 } });
    expect(one.dropped()).toBe(1);
  });

  it('saves a change built on the data it read in', async () => {
    const shared = sharedStorage(at(1));
    const one = tab(shared.storage);
    one.sync.start(at(1));
    shared.otherTabSaves({ settings: { ...at(1).settings, monthlyCap: 9 } });
    await one.sync.reload();
    const fresh = one.shown.at(-1)!;
    expect(await one.sync.write({ ...fresh, settings: { ...fresh.settings, dailyTarget: 33 } })).toBe('saved');
    expect(shared.record()).toMatchObject({ revision: 3, settings: { monthlyCap: 9, dailyTarget: 33 } });
  });

  it('changes nothing on a reload when nothing was saved elsewhere', async () => {
    const shared = sharedStorage(at(4));
    const one = tab(shared.storage);
    const mine = one.sync.start(at(4))!;
    await one.sync.reload();
    expect(one.shown).toEqual([]);
    expect(await one.sync.write(mine)).toBe('saved');
  });

  it('starts over when another tab deleted everything', async () => {
    const shared = sharedStorage(at(4, 50));
    const one = tab(shared.storage);
    const mine = one.sync.start(at(4, 50))!;
    const cleared = sharedStorage(null);
    // The same tab, now reading a store that was cleared.
    const sync = new TabSync(cleared.storage, { replace: (data) => one.shown.push(data), dropped: () => {} });
    sync.start(at(4, 50));
    await sync.reload();
    expect(one.shown.at(-1)?.settings.dailyTarget).toBe(emptyData().settings.dailyTarget);
    expect(await sync.write(mine)).toBe('dropped');
    expect(cleared.record()).toBeNull();
  });
});

describe("another tab's hunt progress (FR-4.15)", () => {
  const base: AppData = { ...emptyData(), revision: 3 };
  const marker = {
    at: '2026-11-15T09:00:00.000Z',
    date: '2026-11-15',
    provider: 'gemini' as const,
    steps: [],
    leads: [],
    dropped: [],
    usage: { calls: 1, inputTokens: 10, outputTokens: 10, unreported: 0 },
    chargedUsd: 0.001,
  };

  it("doesn't make the screens start over when only the hunt's progress changed", () => {
    expect(needsRekey(base, { ...base, huntInProgress: marker, revision: 4 })).toBe(false);
    expect(needsRekey({ ...base, huntInProgress: marker }, { ...base, huntInProgress: { ...marker, chargedUsd: 0.002 }, revision: 5, tabGeneration: 2 })).toBe(false);
  });

  it('ignores the order keys were written in', () => {
    const reordered = Object.fromEntries(Object.entries(base).reverse()) as AppData;
    expect(needsRekey(base, reordered)).toBe(false);
  });

  it('does when anything a screen shows changed', () => {
    expect(needsRekey(base, { ...base, settings: { ...base.settings, dailyTarget: 33 } })).toBe(true);
    expect(needsRekey(base, { ...base, runs: [{ at: 'x', date: '2026-11-15', status: 'completed', kept: 0, dropped: [], sample: false }] })).toBe(true);
  });
});
