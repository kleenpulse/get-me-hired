// A hunt that stopped partway, because its tab closed or the browser ended it
// (FR-4.15, FRD §10.2 "Interrupted hunt found on open"). Its checkpoint holds
// what it found and spent so far. Settling it records it as a cancelled run on
// the day it ran, with that cost and those leads, so the monthly cap and
// History stay true and nothing it found is dropped. Running it again is then
// an ordinary new hunt.

import type { HuntResult } from '@/core/hunt';
import type { AppData } from './data';
import { addFound } from './found';

/** The data with a stopped hunt recorded as a run. The same data when there is none. */
export function settleInterrupted(data: AppData): AppData {
  const checkpoint = data.huntInProgress;
  if (!checkpoint) return data;
  const result: HuntResult = {
    status: 'cancelled',
    leads: checkpoint.leads,
    dropped: checkpoint.dropped,
    steps: checkpoint.steps,
    usage: checkpoint.usage,
    chargedUsd: checkpoint.chargedUsd,
  };
  // Dated when it ran, so its cost lands in that month. addFound clears the checkpoint.
  return addFound(data, result, new Date(checkpoint.at), false, checkpoint.provider);
}
