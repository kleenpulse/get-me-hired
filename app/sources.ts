// Which sources a hunt reads (FR-4.12, FR-10.3). Only the ones that can run
// today are switches. Funding news stays off until the app has a page reader
// that returns links (FRD §19 finding 12), and fresh posts need web search, so
// those show as off with their reason, never as a switch that does nothing.

import type { Settings } from './data';

export interface SourceSwitches {
  /** The Hacker News "Who is hiring?" thread. */
  community: boolean;
}

export const DEFAULT_SOURCES: SourceSwitches = { community: true };

/** The sources a real hunt runs with, for createRealHunt. */
export function huntSources(settings: Pick<Settings, 'sources'>): { funding: boolean; community: boolean } {
  return { funding: false, community: settings.sources.community };
}

/** False when every source is off, so a hunt would search nothing. */
export function anySourceOn(settings: Pick<Settings, 'sources'>): boolean {
  const on = huntSources(settings);
  return on.funding || on.community;
}

export function isSourceSwitches(value: unknown): value is SourceSwitches {
  return typeof value === 'object' && value !== null && typeof (value as { community?: unknown }).community === 'boolean';
}
