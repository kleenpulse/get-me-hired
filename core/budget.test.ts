import { describe, expect, it } from 'vitest';
import {
  boundCost,
  Budget,
  capBlocksStart,
  huntEstimate,
  isFreeModel,
  knownPromptBound,
  pageReadBound,
  PROMPT_OVERHEAD_TOKENS,
  spentThisMonth,
} from './budget';
import { NO_USAGE, PRICES } from './prices';
import { PROVIDER_IDS, PROVIDERS } from './providers';

const GEMINI = 'gemini-3.1-flash-lite';
const FREE = 'inclusionai/ling-3.2-flash:free';

describe('the bound of one call', () => {
  it('counts the prompt in bytes, so a word in another script is not undercounted', () => {
    expect(knownPromptBound(['abc'], 100)).toEqual({ inputTokens: 3 + PROMPT_OVERHEAD_TOKENS, outputTokens: 100 });
    // "é" is 2 bytes and "日" is 3: a token never covers less than one byte.
    expect(knownPromptBound(['é', '日'], 100).inputTokens).toBe(5 + PROMPT_OVERHEAD_TOKENS);
  });

  it('is priced at the list price', () => {
    expect(boundCost(GEMINI, { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBeCloseTo(0.25 + 1.5);
  });

  it('is unknown for a page read, unless input costs nothing', () => {
    expect(boundCost(GEMINI, pageReadBound(4000))).toBeNull();
    expect(boundCost(FREE, pageReadBound(4000))).toBe(0);
    expect(boundCost('no-such-model', { inputTokens: 10, outputTokens: 10 })).toBeNull();
  });
});

describe('free models', () => {
  it('are the ones whose list price is $0 both ways', () => {
    expect(isFreeModel(FREE)).toBe(true);
    expect(isFreeModel(GEMINI)).toBe(false);
    expect(isFreeModel('no-such-model')).toBe(false);
  });

  it('every offered provider has a price, so its cap can be kept', () => {
    for (const id of PROVIDER_IDS.filter((provider) => PROVIDERS[provider].status === 'ready')) {
      expect(PRICES[PROVIDERS[id].model], id).toBeDefined();
    }
  });
});

describe("this month's spending", () => {
  const run = (date: string, listCost: number | null | undefined, extra: { sample?: boolean; unreported?: number } = {}) => ({
    date,
    sample: extra.sample ?? false,
    ...(listCost === undefined ? {} : { listCost }),
    ...(extra.unreported === undefined ? {} : { unreported: extra.unreported }),
  });

  it('adds up real runs in the same calendar month only', () => {
    const runs = [run('2026-11-01', 0.5), run('2026-11-30', 0.25), run('2026-10-31', 9), run('2026-11-15', 7, { sample: true })];
    expect(spentThisMonth(runs, '2026-11-15')).toEqual({ usd: 0.75, partial: false });
    expect(spentThisMonth(runs, '2026-12-01')).toEqual({ usd: 0, partial: false });
  });

  it('says the total is partial when a run had unreported calls or no known price', () => {
    expect(spentThisMonth([run('2026-11-02', 0.1, { unreported: 1 })], '2026-11-15')).toEqual({ usd: 0.1, partial: true });
    expect(spentThisMonth([run('2026-11-02', null)], '2026-11-15')).toEqual({ usd: 0, partial: true });
  });

  it("doesn't count runs from before the cap, or reports written by the skill", () => {
    expect(spentThisMonth([run('2026-11-02', undefined)], '2026-11-15')).toEqual({ usd: 0, partial: false });
  });
});

describe('starting a hunt under the cap', () => {
  const estimate = huntEstimate(GEMINI) ?? 0;

  it('has a rough figure for one hunt', () => {
    expect(estimate).toBeGreaterThan(0);
    expect(estimate).toBeLessThan(0.1);
  });

  it("doesn't start once the cap is reached, or when the hunt could go past it", () => {
    expect(capBlocksStart(GEMINI, { usd: 2, partial: false }, 2)).toBe('cap-reached');
    expect(capBlocksStart(GEMINI, { usd: 2 - estimate / 2, partial: false }, 2)).toBe('over-cap');
    expect(capBlocksStart(GEMINI, { usd: 0, partial: false }, 2)).toBeNull();
  });

  it('never blocks a free model, and blocks a model with no known price', () => {
    expect(capBlocksStart(FREE, { usd: 100, partial: false }, 1)).toBeNull();
    expect(capBlocksStart('no-such-model', { usd: 0, partial: false }, 1)).toBe('no-price');
  });
});

describe('the budget of one hunt', () => {
  const bound = { inputTokens: 4000, outputTokens: 6000 };
  const most = boundCost(GEMINI, bound) ?? 0;

  it('allows a call only when its bound fits in what is left', () => {
    expect(new Budget(GEMINI, 1, 1 - most).allows(bound, NO_USAGE)).toBe(true);
    expect(new Budget(GEMINI, 1, 1 - most + 0.0001).allows(bound, NO_USAGE)).toBe(false);
  });

  it('counts what this run has used so far', () => {
    const used = { calls: 1, inputTokens: 100_000, outputTokens: 0, unreported: 0 };
    // 100,000 tokens in at $0.25 a million is $0.025.
    expect(new Budget(GEMINI, 1, 1 - most - 0.02).allows(bound, used)).toBe(false);
    expect(new Budget(GEMINI, 1, 1 - most - 0.03).allows(bound, used)).toBe(true);
  });

  it('charges a call that reported nothing at its bound, never at $0', () => {
    const budget = new Budget(GEMINI, 1, 1 - most * 1.5);
    expect(budget.allows(bound, NO_USAGE)).toBe(true);
    budget.chargeUnreported(bound);
    expect(budget.runCost(NO_USAGE)).toBeCloseTo(most);
    expect(budget.allows(bound, NO_USAGE)).toBe(false);
  });

  it('never allows a page read on a model whose input costs money', () => {
    expect(new Budget(GEMINI, 500, 0).allows(pageReadBound(4000), NO_USAGE)).toBe(false);
    expect(new Budget(FREE, 1, 1).allows(pageReadBound(4000), NO_USAGE)).toBe(true);
  });
});
