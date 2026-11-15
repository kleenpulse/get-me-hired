import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lead } from '@/core/lead';
import { emptyData, type AppData } from './data';
import { createNotesSaver, NOTES_SAVE_DELAY_MS, withNotes } from './notes-saver';

const timers = {
  set: (run: () => void, ms: number) => setTimeout(run, ms) as unknown as number,
  clear: (id: number) => clearTimeout(id),
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('saving notes as you type (FR-6.7)', () => {
  it('saves after a pause, once, with the last text', () => {
    const saved: string[] = [];
    const saver = createNotesSaver((notes) => saved.push(notes), '', timers);
    saver.change('C');
    saver.change('Ca');
    saver.change('Call Friday');
    vi.advanceTimersByTime(NOTES_SAVE_DELAY_MS - 1);
    expect(saved).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(saved).toEqual(['Call Friday']);
  });

  it('saves at once on flush (blur, page hide), and the pending timer then does nothing', () => {
    const saved: string[] = [];
    const saver = createNotesSaver((notes) => saved.push(notes), '', timers);
    saver.change('Call Friday');
    expect(saver.flush()).toBe(true);
    vi.advanceTimersByTime(NOTES_SAVE_DELAY_MS * 2);
    expect(saved).toEqual(['Call Friday']);
  });

  it('saves what was typed when the card goes away, and no timer fires after', () => {
    const saved: string[] = [];
    const saver = createNotesSaver((notes) => saved.push(notes), 'old', timers);
    saver.change('old, then new');
    saver.dispose();
    vi.advanceTimersByTime(NOTES_SAVE_DELAY_MS * 2);
    expect(saved).toEqual(['old, then new']);
  });

  it('saves nothing when nothing changed, as when React mounts the card twice', () => {
    const saved: string[] = [];
    const saver = createNotesSaver((notes) => saved.push(notes), 'kept', timers);
    saver.dispose();
    saver.dispose();
    saver.change('kept   ');
    vi.advanceTimersByTime(NOTES_SAVE_DELAY_MS);
    expect(saved).toEqual([]);
  });

  it('takes a change made elsewhere as the new saved text', () => {
    const saved: string[] = [];
    const saver = createNotesSaver((notes) => saved.push(notes), 'mine', timers);
    saver.saved('from an import');
    expect(saver.flush()).toBe(false);
    saver.change('from an import, and more');
    expect(saver.flush()).toBe(true);
    expect(saved).toEqual(['from an import, and more']);
  });
});

describe('notes landing on data another tab saved', () => {
  const lead = (key: string, notes: string) => ({ key, notes }) as Lead;

  it("changes only that lead's notes, on the data as it is now", () => {
    const fresh: AppData = {
      ...emptyData(),
      leads: [lead('a', 'theirs'), lead('b', '')],
      settings: { ...emptyData().settings, dailyTarget: 33 },
    };
    const after = withNotes(fresh, 'a', 'mine, typed meanwhile');
    expect(after.leads.map((entry) => entry.notes)).toEqual(['mine, typed meanwhile', '']);
    expect(after.settings.dailyTarget).toBe(33);
    expect(after.leads[1]).toBe(fresh.leads[1]);
  });

  it('returns the same data when the notes are already that, and cleans them', () => {
    const data: AppData = { ...emptyData(), leads: [lead('a', 'same')] };
    expect(withNotes(data, 'a', 'same  ')).toBe(data);
    expect(withNotes(data, 'a', 'bell\u0007').leads[0]?.notes).toBe('bell');
  });
});
