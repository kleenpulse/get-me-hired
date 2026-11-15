// The shape of a hunt as the screens see it (FR-4.10). A real hunt and the
// sample hunt both speak this, so the screens don't care which one is running.

import type { Lead } from './lead';
import type { Usage } from './prices';
import type { KeyProblem } from './providers';

/** The stages of a hunt, in the order they run (FRD §12). */
export const HUNT_STEPS = ['posts', 'freshness', 'funding', 'community', 'contacts'] as const;
export type HuntStepId = (typeof HUNT_STEPS)[number];

/** `skipped`: the step can't run with what the user has, such as a search step with no web search. */
export type HuntStepState = 'waiting' | 'running' | 'done' | 'failed' | 'skipped';

export interface HuntStep {
  id: HuntStepId;
  state: HuntStepState;
  /** How many items the step handled. `null` until it is known. */
  count: number | null;
  /** Why a `skipped` step didn't run. */
  skipReason?: 'needs-search' | 'needs-page-reader' | 'switched-off' | 'not-built' | 'no-cost-bound';
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
  /**
   * What a real hunt has found and spent so far, so it can be saved as it goes: a
   * tab that closes mid-hunt still counts what it spent, and keeps what it found
   * (FR-4.15, AC-4.13). Sample hunts leave it out.
   */
  checkpoint?: HuntCheckpointData;
}

export interface HuntCheckpointData {
  leads: Lead[];
  dropped: DroppedLead[];
  usage: Usage;
  /** As in HuntResult: unreported calls at their bound, `null` for a model with no known price. */
  chargedUsd: number | null;
}

/**
 * Why a hunt stopped: a provider problem (AC-4.11), Hacker News not answering,
 * or this month's spending cap (AC-4.13).
 */
export type HuntProblem = KeyProblem | 'hn-down' | 'cap-reached';

export interface HuntResult {
  /** `cancelled` keeps whatever was found before the user stopped it (AC-4.10). */
  status: 'completed' | 'cancelled' | 'failed';
  leads: Lead[];
  dropped: DroppedLead[];
  steps: HuntStep[];
  /** Why a `failed` hunt stopped. */
  problem?: HuntProblem;
  /** Openings that could not be read because their batch failed. Counted apart from those checked. */
  unread?: number;
  /** Sources that couldn't be searched today, by host name (FR-4.11). The rest of the run still finished. */
  failedSources?: string[];
  /** Model calls and tokens, summed from the SDK's reports (FR-4.13). */
  usage?: Usage;
  /**
   * What the run cost at the list price, in US dollars, with every call that
   * reported no tokens counted at the most it could have cost, never at $0.
   * `null` for a model with no known price. The monthly cap adds this up (AC-4.13).
   */
  chargedUsd?: number | null;
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
