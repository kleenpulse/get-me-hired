// Run on open (FR-4.2): start today's hunt when the app is opened and today's
// hunt hasn't run yet. The web app can't run while its tab is closed, so this
// is as close to a schedule as it gets. Real scheduling comes with the desktop app.

import { missingFields } from '@/core/profile';
import type { ProviderId } from '@/core/providers';
import { capAllowsStart, capState } from './cap';
import type { AppData } from './data';

/**
 * True when opening the app should start today's hunt: the setting is on, a
 * real hunt could run (a provider with a key, a complete profile), no real hunt
 * has run today in any outcome, and the monthly cap allows one (AC-4.13).
 *
 * A hunt that failed today counts as run, so a broken key or a provider that's
 * down never starts a new hunt every time the tab is opened.
 */
export function shouldRunOnOpen(data: Pick<AppData, 'settings' | 'profile' | 'runs'>, keyProviders: readonly ProviderId[], today: string): boolean {
  const { settings, profile, runs } = data;
  if (!settings.runOnOpen || !settings.welcomeDone || settings.sampleMode) return false;
  const provider = settings.provider;
  if (!provider || !keyProviders.includes(provider)) return false;
  if (!profile || missingFields(profile).length > 0) return false;
  if (runs.some((run) => !run.sample && run.date === today)) return false;
  return capAllowsStart(capState(data, provider, today));
}
