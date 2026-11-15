// The shape of a hunt as the screens see it (FR-4.10). A real hunt and the
// sample hunt both speak this, so the screens don't care which one is running.

import type { Lead } from './lead';

/** The stages of a hunt, in the order they run (FRD §12). */
export const HUNT_STEPS = ['posts', 'freshness', 'funding', 'community', 'contacts'] as const;
export type HuntStepId = (typeof HUNT_STEPS)[number];

export type HuntStepState = 'waiting' | 'running' | 'done' | 'failed';

export interface HuntStep {
  id: HuntStepId;
  state: HuntStepState;
  /** How many items the step handled. `null` until it is known. */
  count: number | null;
}

/** Why a lead was dropped (FRD §9.1). Every dropped lead has exactly one. */
export const DROP_REASONS = [
  'stale',
  'too-popular',
  'recruiter',
  'role-mismatch',
  'location',
  'pay-below-floor',
  'skip-list',
  'do-not-contact',
  'duplicate',
  'unverifiable',
] as const;
export type DropReason = (typeof DROP_REASONS)[number];

export interface DroppedLead {
  company: string;
  reason: DropReason;
  sourceUrl: string;
}

export interface HuntProgress {
  steps: HuntStep[];
  kept: number;
  dropped: number;
}

export interface HuntResult {
  /** `cancelled` keeps whatever was found before the user stopped it (AC-4.10). */
  status: 'completed' | 'cancelled' | 'failed';
  leads: Lead[];
  dropped: DroppedLead[];
  steps: HuntStep[];
}

export interface HuntOptions {
  now: Date;
  /** Aborting it cancels the hunt. */
  signal: AbortSignal;
  onProgress: (progress: HuntProgress) => void;
}

export type HuntRunner = (options: HuntOptions) => Promise<HuntResult>;

export function waitingSteps(): HuntStep[] {
  return HUNT_STEPS.map((id) => ({ id, state: 'waiting', count: null }));
}
