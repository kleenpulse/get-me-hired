// What the app keeps in the browser. Keys are never part of this (FRD §11.1).

import type { BlockEntry } from '@/core/block';
import type { DroppedLead, HuntResult } from '@/core/hunt';
import type { Lead } from '@/core/lead';
import { DEFAULT_CADENCE, type Cadence } from '@/core/lifecycle';
import { emptyProfile, type Profile } from '@/core/profile';
import type { ProviderId } from '@/core/providers';

export const FORMAT_VERSION = 1;
export const DEFAULT_DAILY_TARGET = 20;

export interface Settings {
  /** True once the user has been through the welcome screens (FR-1.2). */
  welcomeDone: boolean;
  /** True while the app shows invented sample leads (FR-1.4). */
  sampleMode: boolean;
  /** How many people to write to in a day (FR-4.14). */
  dailyTarget: number;
  /** The local date of the last backup download, for the 7-day reminder (FR-9.2). */
  lastBackupOn: string | null;
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
      cadence: DEFAULT_CADENCE,
      provider: null,
      lastBackupOn: null,
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
    settings: { ...fresh.settings, ...saved.settings },
  };
}
