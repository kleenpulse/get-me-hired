// The monthly spending cap (FR-4.13, FR-10.2, AC-4.13).
//
// The cap is in US dollars at the paid list price, from the dated table in
// prices.ts, the same figures the run report uses. The app can't see whether a
// key is billed: on a free tier a hunt costs nothing, but it still counts here
// at the list price. A model whose list price is $0 never reaches the cap.
//
// Every model call is checked before it is made, against its bound: what it
// could cost at most. Its answer is capped by `maxOutputTokens`, and its prompt
// is known, so its input is at most one token per byte. A call that reads a web
// page itself (Gemini's url_context) is billed for the page too, which the app
// never sees, so it has no bound: it runs only when input costs nothing.

import { PRICES, paidCost, type Usage } from './prices';

/** What one model call could cost at most, in tokens. `inputTokens: null` means it can't be known. */
export interface CallBound {
  inputTokens: number | null;
  outputTokens: number;
}

/**
 * Extra input tokens allowed beside the prompt's bytes: the answer's schema and
 * the provider's own wrapping. Generous on purpose.
 */
export const PROMPT_OVERHEAD_TOKENS = 2000;

/** The bound of a call whose whole prompt is known. Tokens never cover less than one byte. */
export function knownPromptBound(texts: readonly string[], maxOutputTokens: number): CallBound {
  const bytes = texts.reduce((total, text) => total + new TextEncoder().encode(text).length, 0);
  return { inputTokens: bytes + PROMPT_OVERHEAD_TOKENS, outputTokens: maxOutputTokens };
}

/** The bound of a call that reads a web page itself: its input can't be known. */
export function pageReadBound(maxOutputTokens: number): CallBound {
  return { inputTokens: null, outputTokens: maxOutputTokens };
}

/** The most a call could cost at the list price, or `null` when that can't be known. */
export function boundCost(model: string, bound: CallBound): number | null {
  const price = PRICES[model];
  if (!price) return null;
  const input = bound.inputTokens === null ? (price.input === 0 ? 0 : null) : bound.inputTokens * price.input;
  return input === null ? null : (input + bound.outputTokens * price.output) / 1_000_000;
}

/** True when the model costs nothing at its list price, so no cap can be reached. */
export function isFreeModel(model: string): boolean {
  const price = PRICES[model];
  return price !== undefined && price.input === 0 && price.output === 0;
}

/** What earlier runs this month cost, from the saved runs. */
export interface MonthSpend {
  /** US dollars at the list price. */
  usd: number;
  /** True when some calls didn't report their tokens, so the real total may be higher. */
  partial: boolean;
}

/** One saved run, as far as spending goes. */
export interface SpendRecord {
  /** The user's local date of the run, `YYYY-MM-DD`. */
  date: string;
  sample: boolean;
  /** The run's cost at the list price. `null` when its model has no known price. Missing on runs from before the cap. */
  listCost?: number | null;
  /** Calls in the run that didn't report their tokens. */
  unreported?: number;
}

/** What real runs in the month of `today` cost, in the user's own calendar. */
export function spentThisMonth(runs: readonly SpendRecord[], today: string): MonthSpend {
  const month = today.slice(0, 7);
  let usd = 0;
  let partial = false;
  for (const run of runs) {
    if (run.sample || run.date.slice(0, 7) !== month) continue;
    if (typeof run.listCost === 'number' && Number.isFinite(run.listCost) && run.listCost >= 0) usd += run.listCost;
    else if (run.listCost !== undefined) partial = true;
    if ((run.unreported ?? 0) > 0) partial = true;
  }
  return { usd, partial };
}

/**
 * A rough figure for one whole hunt, shown before it starts (FR-4.13). Measured
 * on 2026-11-15 on the Hacker News stage (FRD §19): 10 calls, about 35,000
 * tokens in and 11,000 out. Rounded up.
 */
export const HUNT_ESTIMATE: Usage = { calls: 10, inputTokens: 40_000, outputTokens: 15_000, unreported: 0 };

/** The rough cost of one hunt at the list price, or `null` for a model with no known price. */
export function huntEstimate(model: string): number | null {
  return paidCost(model, HUNT_ESTIMATE);
}

/** Why a hunt can't start, or `null` when it can. */
export function capBlocksStart(model: string, spent: MonthSpend, capUsd: number): 'cap-reached' | 'over-cap' | 'no-price' | null {
  if (isFreeModel(model)) return null;
  const estimate = huntEstimate(model);
  if (estimate === null) return 'no-price';
  if (spent.usd >= capUsd) return 'cap-reached';
  return spent.usd + estimate > capUsd ? 'over-cap' : null;
}

/**
 * Keeps one hunt under the cap. `spent` is what earlier runs this month cost.
 * A call that answered without its token counts is charged at its bound, so
 * an unknown cost is never taken as $0.
 */
export class Budget {
  private reserved = 0;

  constructor(
    private readonly model: string,
    private readonly capUsd: number,
    private readonly spent: number,
  ) {}

  /**
   * What this run has cost so far, with unreported calls at their bound. This is
   * what the run saves, so the next hunt counts those calls too. `null` for a
   * model with no known price.
   */
  runCost(usage: Usage): number | null {
    const paid = paidCost(this.model, usage);
    return paid === null ? null : paid + this.reserved;
  }

  /** True when a call with this bound can't take the month past the cap. */
  allows(bound: CallBound, usage: Usage): boolean {
    if (isFreeModel(this.model)) return true;
    const most = boundCost(this.model, bound);
    const soFar = this.runCost(usage);
    return most !== null && soFar !== null && this.spent + soFar + most <= this.capUsd;
  }

  /** A call answered without its token counts: charge it at its bound. */
  chargeUnreported(bound: CallBound): void {
    this.reserved += boundCost(this.model, bound) ?? 0;
  }
}
