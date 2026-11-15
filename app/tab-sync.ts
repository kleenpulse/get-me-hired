// Keeps one tab's copy of the data in step with the other tabs (NFR-7). All tabs
// save one IndexedDB record whole, so a tab must never write a copy built from
// data another tab has since replaced.
//
// - Every write goes over the revision this tab last read or wrote. storage.ts
//   refuses it, inside one transaction, when another tab saved in between.
// - Reads and writes run one at a time, in order, so this tab's own writes never
//   look stale to it.
// - Each copy of the data in memory carries the generation it was read in.
//   Reading another tab's data starts a new generation, and every change made
//   after that is built on the new data, so it carries the new generation. A
//   write still carrying an older one was built before the read, from data that
//   is gone: it is dropped, even though the revision would let it through.

import { emptyData, type AppData } from './data';
import { revisionOf, StaleDataError } from './storage';

export interface SyncStorage {
  load: () => Promise<AppData | null>;
  /** Writes over revision `base` and resolves with the new revision, or rejects with `StaleDataError`. */
  save: (data: AppData, base: number) => Promise<number>;
}

export interface SyncEvents {
  /** Another tab's data was read in: show it. */
  replace: (data: AppData) => void;
  /** A change made here wasn't saved, because another tab saved first. */
  dropped: () => void;
}

export type WriteOutcome = 'saved' | 'dropped' | 'failed';

export class TabSync {
  private revision = 0;
  private generation = 0;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly storage: SyncStorage,
    private readonly events: SyncEvents,
  ) {}

  /** Marks data as built in this tab's current generation. */
  stamp(data: AppData): AppData {
    return { ...data, tabGeneration: this.generation };
  }

  /** The first read, when the app opens. */
  start(saved: AppData | null): AppData | null {
    this.revision = revisionOf(saved);
    return saved ? this.stamp(saved) : null;
  }

  /** Runs storage work in this tab's queue, after everything queued before it. */
  run<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    this.queue = next.catch(() => {});
    return next;
  }

  /** Reads the saved data again, after another tab saved. Nothing changes when the revision is the same. */
  reload(): Promise<void> {
    return this.run(() => this.readNow());
  }

  /** Writes a copy of the data. Never over another tab's newer save, and never a copy built before a reload. */
  write(data: AppData): Promise<WriteOutcome> {
    return this.run(async (): Promise<WriteOutcome> => {
      if ((data.tabGeneration ?? 0) !== this.generation) {
        this.events.dropped();
        return 'dropped';
      }
      const { tabGeneration: _, ...stored } = data;
      try {
        this.revision = await this.storage.save(stored, this.revision);
        return 'saved';
      } catch (error) {
        if (!(error instanceof StaleDataError)) return 'failed';
        await this.readNow();
        this.events.dropped();
        return 'dropped';
      }
    });
  }

  /** Clears the stored data (Delete everything): the next write starts again from revision 0. */
  clear(work: () => Promise<void>): Promise<void> {
    return this.run(async () => {
      await work();
      this.revision = 0;
    });
  }

  private async readNow(): Promise<void> {
    const saved = await this.storage.load();
    // Same revision: nothing changed, including nothing stored yet on a first visit.
    if (revisionOf(saved) === this.revision) return;
    this.revision = revisionOf(saved);
    this.generation += 1;
    // No record any more: another tab chose Delete everything.
    this.events.replace(this.stamp(saved ?? emptyData()));
  }
}
