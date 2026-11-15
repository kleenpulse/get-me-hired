// Saves a lead's notes as they're typed (FR-6.7), so at most a moment of typing
// is ever at risk: after a short pause, when the box loses focus, when the page
// is hidden or closed, and when the card goes away (another tab's data read in,
// or a move to another screen). It saves only a real change, so mounting the
// card twice in a row (React's dev check) saves nothing.

import { cleanNotes } from '@/core/lead';
import type { AppData } from './data';

/** The pause after typing before notes are saved. */
export const NOTES_SAVE_DELAY_MS = 800;

export interface NotesSaver {
  /** The text in the box changed. Saves after a pause. */
  change: (text: string) => void;
  /** Saves now if the text differs from what is saved. True when it saved. */
  flush: () => boolean;
  /** The notes saved on the lead changed (an import, another tab): what "unchanged" means now. */
  saved: (notes: string) => void;
  /** Saves now if needed, and stops the timer. The card is going away. */
  dispose: () => void;
}

export interface Timers {
  set: (run: () => void, ms: number) => number;
  clear: (id: number) => void;
}

export function createNotesSaver(save: (notes: string) => void, initial: string, timers: Timers): NotesSaver {
  let text = initial;
  let stored = cleanNotes(initial);
  let timer: number | null = null;

  const stop = () => {
    if (timer !== null) timers.clear(timer);
    timer = null;
  };

  const flush = () => {
    stop();
    const next = cleanNotes(text);
    if (next === stored) return false;
    stored = next;
    save(next);
    return true;
  };

  return {
    change: (next) => {
      text = next;
      stop();
      timer = timers.set(flush, NOTES_SAVE_DELAY_MS);
    },
    flush,
    saved: (notes) => {
      stored = notes;
      text = notes;
    },
    dispose: () => {
      flush();
      stop();
    },
  };
}

/**
 * The data with one lead's notes set. A functional update on the data as it is
 * now, so notes typed while another tab's data was read in land on that data.
 */
export function withNotes(data: AppData, key: string, notes: string): AppData {
  const next = cleanNotes(notes);
  let changed = false;
  const leads = data.leads.map((lead) => {
    if (lead.key !== key || lead.notes === next) return lead;
    changed = true;
    return { ...lead, notes: next };
  });
  return changed ? { ...data, leads } : data;
}
