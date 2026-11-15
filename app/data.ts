// What the app keeps in the browser. Keys are never part of this (FRD §11.1).

import type { BlockEntry } from '@/core/block';
import { DEFAULT_DISPLAY, isDisplay, type Display } from './display';
import type { DroppedLead, HuntResult } from '@/core/hunt';
import type { Lead } from '@/core/lead';
import { DEFAULT_CADENCE, type Cadence } from '@/core/lifecycle';
import { emptyProfile, type Profile } from '@/core/profile';
import type { ProviderId } from '@/core/providers';
import { isValidMonthlyCap } from '@/core/settings-bounds';
import { DEFAULT_SOURCES, isSourceSwitches, type SourceSwitches } from './sources';

export const FORMAT_VERSION = 1;
export const DEFAULT_DAILY_TARGET = 20;
/**
 * The monthly spending cap a new user starts with, in US dollars at the list
 * price. About 60 hunts at the measured cost of one (core/budget.ts).
 */
export const DEFAULT_MONTHLY_CAP = 2;

export interface Settings {
  /** True once the user has been through the welcome screens (FR-1.2). */
  welcomeDone: boolean;
  /** True while the app shows invented sample leads (FR-1.4). */
  sampleMode: boolean;
  /** How many people to write to in a day (FR-4.14). */
  dailyTarget: number;
  /** The monthly spending cap, in whole US dollars at the list price (FR-10.2, AC-4.13). */
  monthlyCap: number;
  /** Start today's hunt when the app is opened and it hasn't run yet (FR-4.2). Off until the user turns it on. */
  runOnOpen: boolean;
  /** Sources switched on or off (FR-10.3). Funding news and fresh posts can't run yet, so they aren't here. */
  sources: SourceSwitches;
  /** The local date of the last backup download, for the 7-day reminder (FR-9.2). */
  lastBackupOn: string | null;
  /** Theme and text size (FR-10.5). */
  display: Display;
  cadence: Cadence;
  /** The provider hunts use. Only its name: the key itself is stored apart (see storage.ts). */
  provider: ProviderId | null;
}

export interface RunRecord {
  /** When the hunt finished, as a UTC date-time. */
  at: string;
  /** The user's local date of the hunt. */
  date: string;
  status: HuntResult['status'];
  kept: number;
  dropped: DroppedLead[];
  /** True for a sample hunt, which searched nothing. */
  sample: boolean;
  /** The provider the hunt used. Only its name, never its key. */
  provider?: ProviderId | null;
  /** Why a stopped hunt stopped. */
  problem?: HuntResult['problem'];
  /**
   * What the run cost at the list price, in US dollars (FR-4.13): `null` when its
   * model has no known price. Runs from before the cap, and reports written by
   * the skill, have none.
   */
  listCost?: number | null;
  /** Calls in the run that didn't report their tokens, so `listCost` leaves them out. */
  unreported?: number;
  /** The run report (FR-8.1) as Markdown, and its file name in `runs/`. Hunts from before reports have none. */
  report?: string;
  reportName?: string;
}

export interface AppData {
  formatVersion: typeof FORMAT_VERSION;
  /** `null` until the user saves a profile for the first time. */
  profile: Profile | null;
  leads: Lead[];
  settings: Settings;
  runs: RunRecord[];
  /** The do-not-contact list (FR-5.7). Kept until the user removes an entry. */
  doNotContact: BlockEntry[];
  /**
   * How many times this record was saved. Set by storage.ts on each save, so a tab
   * holding an older copy can't overwrite a newer one. Never part of a backup.
   */
  revision?: number;
  /**
   * In this tab's memory only, never saved: which read of the data this copy was
   * built on (tab-sync.ts), so a copy built before another tab's data was read in
   * can't be written over it.
   */
  tabGeneration?: number;
}

export function emptyData(): AppData {
  return {
    formatVersion: FORMAT_VERSION,
    profile: null,
    leads: [],
    settings: {
      welcomeDone: false,
      sampleMode: false,
      dailyTarget: DEFAULT_DAILY_TARGET,
      monthlyCap: DEFAULT_MONTHLY_CAP,
      runOnOpen: false,
      sources: DEFAULT_SOURCES,
      cadence: DEFAULT_CADENCE,
      provider: null,
      lastBackupOn: null,
      display: DEFAULT_DISPLAY,
    },
    runs: [],
    doNotContact: [],
  };
}

/** Fills in parts that data saved by an earlier build of the app doesn't have yet. */
export function withDefaults(saved: AppData): AppData {
  const fresh = emptyData();
  return {
    ...fresh,
    ...saved,
    profile: saved.profile ? { ...emptyProfile(), ...saved.profile } : null,
    doNotContact: Array.isArray(saved.doNotContact) ? saved.doNotContact : [],
    settings: {
      ...fresh.settings,
      ...saved.settings,
      // Older data has no display settings, and a bad value falls back to the defaults.
      display: isDisplay(saved.settings?.display) ? saved.settings.display : DEFAULT_DISPLAY,
      monthlyCap: isValidMonthlyCap(saved.settings?.monthlyCap) ? saved.settings.monthlyCap : DEFAULT_MONTHLY_CAP,
      runOnOpen: saved.settings?.runOnOpen === true,
      sources: isSourceSwitches(saved.settings?.sources) ? { community: saved.settings.sources.community } : DEFAULT_SOURCES,
    },
  };
}
