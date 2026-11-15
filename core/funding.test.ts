// The funding stage end to end: the real AI SDK, with a stand-in `fetch` that
// answers like Gemini's page reader. No request leaves the machine.

import { describe, expect, it } from 'vitest';
import { ARTICLE_PAGES, ARTICLES, LISTING_JSON, LISTING_TEXT, LISTING_URL } from '@/fixtures/funding-pages';
import { parseDateLine, roundStage } from './funding';
import type { HuntResult } from './hunt';
import { emptyProfile } from './profile';
import type { ProviderId } from './providers';
import { createRealHunt } from './real-hunt';

const KEY = 'test-key-not-real-0000';
const NOW = new Date('2026-11-15T12:00:00Z');

interface Call {
  url: string;
  body: Record<string, unknown>;
  raw: string;
}

function gemini(text: string, retrieved?: { url: string; ok: boolean }): Response {
  const candidate: Record<string, unknown> = {
    content: { parts: [{ text }], role: 'model' },
    finishReason: 'STOP',
    index: 0,
  };
  if (retrieved) {
    candidate.urlContextMetadata = {
      urlMetadata: [
        {
          retrievedUrl: retrieved.url,
          urlRetrievalStatus: retrieved.ok ? 'URL_RETRIEVAL_STATUS_SUCCESS' : 'URL_RETRIEVAL_STATUS_ERROR',
        },
      ],
    };
  }
  return new Response(
    JSON.stringify({ candidates: [candidate], usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 200, totalTokenCount: 700 } }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

/** A `fetch` that answers like Gemini with its page reader, and records every call. */
function standIn(calls: Call[], options: { listingReadable?: boolean } = {}): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const raw = String(init?.body ?? '');
    const body = JSON.parse(raw || '{}') as Record<string, unknown>;
    calls.push({ url, body, raw });
    if (!url.startsWith('https://generativelanguage.googleapis.com/')) throw new TypeError(`Unexpected request to ${url}`);

    const prompt = JSON.stringify(body.contents ?? '');
    if (body.tools) {
      // Call 1: the page reader. Answer for the page the prompt names.
      const asked = /Read (https?:\/\/\S+?) \./.exec(prompt)?.[1] ?? '';
      if (asked === LISTING_URL) {
        const ok = options.listingReadable !== false;
        return gemini(ok ? LISTING_TEXT : 'PAGE NOT READ', { url: asked, ok });
      }
      const page = ARTICLE_PAGES[asked];
      if (page) return gemini(page.text, { url: asked, ok: page.retrieved });
      return gemini('PAGE NOT READ', { url: asked, ok: false });
    }
    // Call 2: no tools. Answer with the JSON for the text it was given.
    if (prompt.includes('Every startup round of 2026')) return gemini(JSON.stringify(LISTING_JSON));
    const article = Object.values(ARTICLE_PAGES).find((page) => page.retrieved && prompt.includes(page.text.slice(10, 40)));
    return gemini(JSON.stringify(article?.json ?? {}));
  }) as typeof fetch;
}

async function hunt(fetcher: typeof fetch, provider: ProviderId = 'gemini'): Promise<HuntResult> {
  return createRealHunt({
    provider,
    key: KEY,
    profile: { ...emptyProfile(), roles: ['Frontend engineer'], skills: ['React'], location: 'Lagos', floor: '$60k' },
    fetch: fetcher,
    knownKeys: new Set(),
    sources: { community: false },
    fundingListings: [LISTING_URL],
  })({ now: NOW, signal: new AbortController().signal, onProgress: () => {} });
}

describe('reading dates (AC-4.6)', () => {
  it('reads full dates as printed', () => {
    expect(parseDateLine('November 10, 2026')).toBe('2026-11-10');
    expect(parseDateLine('Published Nov. 3 2026 at 9:00')).toBe('2026-11-03');
    expect(parseDateLine('12th November 2026')).toBe('2026-11-12');
    expect(parseDateLine('2026-11-09')).toBe('2026-11-09');
  });

  it('refuses dates that are approximate, missing a year, ambiguous, impossible or more than one', () => {
    expect(parseDateLine('2 days ago')).toBeNull();
    expect(parseDateLine('Yesterday')).toBeNull();
    expect(parseDateLine('November 10')).toBeNull();
    expect(parseDateLine('11/10/2026')).toBeNull();
    expect(parseDateLine('February 30, 2026')).toBeNull();
    expect(parseDateLine('Updated November 12, 2026 (first published November 2, 2026)')).toBeNull();
    expect(parseDateLine('')).toBeNull();
  });

  it('reads the stage of a round from its words', () => {
    expect(roundStage('Pre-seed')).toBe('pre-seed');
    expect(roundStage('$3M seed round')).toBe('seed');
    expect(roundStage('Series B')).toBe('later');
    expect(roundStage('raised money')).toBe('unknown');
  });
});

describe('the funding stage (FR-4.6)', () => {
  it('keeps only a recent seed round that a second read of its own article confirms', async () => {
    const result = await hunt(standIn([]));
    expect(result.status).toBe('completed');
    expect(result.leads).toHaveLength(1);
    const [lead] = result.leads;
    expect(lead).toMatchObject({
      company: 'Quillstack',
      type: 'funding',
      round: '$3M seed',
      postedAt: '2026-11-10T00:00:00.000Z',
      signals: ['no-open-role'],
      people: [],
      hooks: [{ text: 'Quillstack raises $3M seed round to build lab notebooks', url: ARTICLES.quillstack }],
    });
    // Read by the AI, and marked so: the app never shows it as checked (principle 2).
    expect(lead?.sources).toEqual([{ kind: 'funding', url: ARTICLES.quillstack, seen: '2026-11-15', readBy: 'gemini' }]);
  });

  it('drops old, vague and unconfirmed rounds with a reason, and never keeps the March round (AC-4.6)', async () => {
    const result = await hunt(standIn([]));
    const reasons = Object.fromEntries(result.dropped.map((drop) => [drop.company, drop.reason]));
    expect(reasons).toEqual({
      Ferncastle: 'stale',
      Larkline: 'unverifiable',
      // Only on a tracker page, and its second read failed.
      Brightmoss: 'unverifiable',
      // Its article gives a different date.
      Tidewell: 'unverifiable',
      // No link of its own, so it is seen only on the list.
      Pinecrest: 'unverifiable',
    });
  });

  it('ignores what the planted instruction asked for, and leaves Series B out', async () => {
    const result = await hunt(standIn([]));
    const named = [...result.leads.map((lead) => lead.company), ...result.dropped.map((drop) => drop.company)];
    expect(named).not.toContain('Phantom AI');
    expect(named).not.toContain('Oakhaven');
  });

  it('gives the page reader only to call 1, and call 2 only the text as data (NFR-4)', async () => {
    const calls: Call[] = [];
    await hunt(standIn(calls));
    const withTools = calls.filter((call) => call.body.tools);
    const withoutTools = calls.filter((call) => !call.body.tools);
    // The listing, then a second read for each of the 3 recent seed rounds.
    expect(withTools).toHaveLength(4);
    expect(withoutTools).toHaveLength(3);
    for (const call of withoutTools) expect(call.raw).toContain('<text>');
    for (const call of calls) {
      expect(call.url).not.toContain(KEY);
      expect(call.raw).not.toContain(KEY);
    }
  });

  it("lists a listing it couldn't read under the sources it couldn't search, and still finishes (FR-4.11)", async () => {
    const result = await hunt(standIn([], { listingReadable: false }));
    expect(result.status).toBe('completed');
    expect(result.failedSources).toEqual(['news.example']);
    expect(result.leads).toEqual([]);
  });

  it('skips the step with another provider, and says why', async () => {
    const calls: Call[] = [];
    const result = await hunt(standIn(calls), 'openrouter');
    expect(result.steps.find((step) => step.id === 'funding')).toMatchObject({ state: 'skipped', skipReason: 'needs-page-reader' });
    expect(calls).toHaveLength(0);
  });
});

describe('the funding stage under the monthly cap (AC-4.13)', () => {
  it('is skipped, not run, when its page reads have no cost bound', async () => {
    const calls: string[] = [];
    const fetcher = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      throw new TypeError('should not be called');
    }) as typeof fetch;
    const result = await createRealHunt({
      provider: 'gemini',
      key: KEY,
      profile: emptyProfile(),
      fetch: fetcher,
      knownKeys: new Set(),
      sources: { community: false },
      fundingListings: [LISTING_URL],
      cap: { usd: 500, spentUsd: 0 },
    })({ now: NOW, signal: new AbortController().signal, onProgress: () => {} });
    expect(calls).toEqual([]);
    expect(result.status).toBe('completed');
    expect(result.steps.find((step) => step.id === 'funding')).toMatchObject({ state: 'skipped', skipReason: 'no-cost-bound' });
  });
});
