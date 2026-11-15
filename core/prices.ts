// What a hunt costs (FR-4.13). Prices live here, in one place, with the date
// they were last checked. Update both together.
//
// The app can't tell whether a key is on a free tier or billed, so a report
// gives both: what the run cost on the free tier, and what it would cost at
// the paid list price.

/** The day these prices were last checked against each provider's price list. */
export const PRICES_CHECKED_ON = '2026-11-14';

export interface ModelPrice {
  /** US dollars per million input tokens, at the paid list price. */
  input: number;
  /** US dollars per million output tokens, at the paid list price. */
  output: number;
  /** True when the provider has a free tier on which this model costs nothing. */
  freeTier: boolean;
}

export const PRICES: Record<string, ModelPrice> = {
  // FRD §19: free on Gemini's free tier, $0.25 in and $1.50 out per million on the paid tier.
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5, freeTier: true },
  // OpenRouter's `:free` models cost nothing, with a daily request limit.
  'inclusionai/ling-3.2-flash:free': { input: 0, output: 0, freeTier: true },
};

export interface Usage {
  /** Model calls that answered. A call that failed reports no tokens. */
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /**
   * Answered calls whose token counts the provider didn't report. Their tokens
   * are unknown, not zero, so a cost that includes them is a lower bound.
   */
  unreported: number;
}

export const NO_USAGE: Usage = { calls: 0, inputTokens: 0, outputTokens: 0, unreported: 0 };

/** Adds one answered call's token counts, as the SDK reports them. */
export function addUsage(total: Usage, more: { inputTokens?: number | undefined; outputTokens?: number | undefined }): Usage {
  const reported = typeof more.inputTokens === 'number' && typeof more.outputTokens === 'number';
  return {
    calls: total.calls + 1,
    inputTokens: total.inputTokens + (reported ? (more.inputTokens ?? 0) : 0),
    outputTokens: total.outputTokens + (reported ? (more.outputTokens ?? 0) : 0),
    unreported: total.unreported + (reported ? 0 : 1),
  };
}

/** The cost at the paid list price, in US dollars, or `null` for a model with no known price. */
export function paidCost(model: string, usage: Usage): number | null {
  const price = PRICES[model];
  if (!price) return null;
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
}
