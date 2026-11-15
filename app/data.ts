// What the app keeps in the browser. Keys are never part of this (FRD §11.1).

import type { DroppedLead, HuntResult } from '@/core/hunt';
import type { Lead } from '@/core/lead';
import { DEFAULT_CADENCE, type Cadence } from '@/core/lifecycle';

export const FORMAT_VERSION = 1;
export const DEFAULT_DAILY_TARGET = 20;

export interface Settings {
  /** True once the user has been through the welcome screens (FR-1.2). */
  welcomeDone: boolean;
  /** True while the app shows invented sample leads (FR-1.4). */
  sampleMode: boolean;
  /** How many people to write to in a day (FR-4.14). */
  dailyTarget: number;
  cadence: Cadence;
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
}

export interface AppData {
  formatVersion: typeof FORMAT_VERSION;
  leads: Lead[];
  settings: Settings;
  runs: RunRecord[];
}

export function emptyData(): AppData {
  return {
    formatVersion: FORMAT_VERSION,
    leads: [],
    settings: {
      welcomeDone: false,
      sampleMode: false,
      dailyTarget: DEFAULT_DAILY_TARGET,
      cadence: DEFAULT_CADENCE,
    },
    runs: [],
  };
}
