import { describe, expect, it } from 'vitest';
import { COMMENTS, ITEM_ANSWER, SEARCH_ANSWER, THREAD_ID } from '@/fixtures/hn-thread';
import type { HuntStep } from '@/core/hunt';
import type { Lead } from '@/core/lead';
import { DEFAULT_CADENCE } from '@/core/lifecycle';
import { NO_USAGE } from '@/core/prices';
import { emptyProfile } from '@/core/profile';
import { createRealHunt } from '@/core/real-hunt';
import { reportFileName, writeRunReport, type ReportInput } from './run-report';

const KEY = 'test-key-not-real-0000';

// An invented community lead.
const LEAD: Lead = {
  key: 'https://news.ycombinator.com/item?id=1|quillstack',
  foundOn: '2026-11-15',
  type: 'post',
  company: 'Quillstack',
  companyUrl: '',
  about: '',
  role: 'Senior Frontend Engineer',
  fit: 'They want React and TypeScript.',
  postedAt: '2026-11-02T15:04:05.000Z',
  postedAtApprox: false,
  likes: 'n/a',
  round: '',
  location: 'Remote',
  people: [
    {
      name: 'ana_quill',
      role: 'Posted the opening on Hacker News',
      contacts: [{ method: 'email', value: 'ana@quillstack.example', label: 'published', evidence: 'https://news.ycombinator.com/item?id=1' }],
      emailedOn: [],
      followupsSent: [],
    },
  ],
  hooks: [{ text: 'Our editor is used by 4,000 labs.', url: 'https://news.ycombinator.com/item?id=1' }],
  sources: [{ kind: 'community', url: 'https://news.ycombinator.com/item?id=1', seen: '2026-11-15' }],
  signals: [],
  tier: 'A',
  status: 'new',
  statusHistory: [{ status: 'new', at: '2026-11-15T09:00:00.000Z' }],
  snoozeUntil: null,
  attention: null,
  notes: '',
  sample: false,
};

const STEPS: HuntStep[] = [
  { id: 'posts', state: 'skipped', count: null, skipReason: 'needs-search' },
  { id: 'freshness', state: 'skipped', count: null, skipReason: 'needs-search' },
  { id: 'funding', state: 'skipped', count: null, skipReason: 'switched-off' },
  { id: 'community', state: 'done', count: 80 },
  { id: 'contacts', state: 'done', count: 1 },
];

const INPUT: ReportInput = {
  date: '2026-11-15',
  status: 'completed',
  sample: false,
  provider: 'gemini',
  kept: [LEAD],
  dropped: [{ company: 'Brindle Talent', reason: 'recruiter', sourceUrl: 'https://news.ycombinator.com/item?id=2' }],
  steps: STEPS,
  failedSources: [],
  unread: 0,
  usage: { calls: 10, inputTokens: 35_000, outputTokens: 11_000, unreported: 0 },
  leads: [LEAD],
  cadence: DEFAULT_CADENCE,
};

describe('the run report (FR-8.1)', () => {
  it("starts with the skill's 4 sections, word for word, then adds the app's own", () => {
    const headings = [...writeRunReport(INPUT).matchAll(/^##? .+$/gm)].map((match) => match[0]);
    expect(headings).toEqual([
      '# Hunt: 2026-11-15',
      '## Fresh posts',
      '## Just raised',
      '## Follow-ups due',
      '## Dry queries',
      '## Community threads',
      '## Dropped, and why',
      "## Couldn't search today",
      '## Not searched',
      '## Provider and cost',
    ]);
  });

  it('lists each kept lead with its source, fit, contact and hook, and each drop with its reason', () => {
    const report = writeRunReport(INPUT);
    expect(report).toContain('### Quillstack: Senior Frontend Engineer');
    expect(report).toContain('- Opening: https://news.ycombinator.com/item?id=1 (posted 2026-11-02, from the Hacker News API)');
    expect(report).toContain('- Contact: ana_quill (Posted the opening on Hacker News). ana@quillstack.example (published,');
    expect(report).toContain('- Brindle Talent: Posted by a recruiter. https://news.ycombinator.com/item?id=2');
    expect(report).toContain('- Looking for startups that just raised money: Off for now.');
    // Nothing claims an age was "checked from the URL": no post's age was checked here.
    expect(report).not.toContain('checked from the URL');
  });

  it('gives the cost as two conditions, since the app cannot see whether a key has billing on', () => {
    const report = writeRunReport(INPUT);
    expect(report).toContain('- Provider: Google Gemini, model gemini-3.1-flash-lite.');
    expect(report).toContain('- Model calls: 10. Tokens: 35,000 in, 11,000 out.');
    expect(report).toContain("- Cost: nothing, if your key is on Google Gemini's free tier.");
    expect(report).toContain(
      '- If your key has billing on, this run cost about $0.03 at the list price. Worked out from the price table dated 2026-11-14, not read from your bill.',
    );
    // A billed user did pay: nothing may tell them otherwise.
    expect(report).not.toContain('not billed');
    expect(report).not.toContain('it would be');
  });

  it('keeps every value on its own line, so a name with a line break cannot fake a heading', () => {
    const sneaky: Lead = { ...LEAD, company: 'Quillstack\n## Provider and cost\n- Cost: nothing', fit: 'Fits\n## Fake' };
    const report = writeRunReport({ ...INPUT, kept: [sneaky] });
    expect([...report.matchAll(/^## Provider and cost$/gm)]).toHaveLength(1);
    expect(report).not.toMatch(/^## Fake$/m);
  });

  it('says when calls did not report their tokens, instead of counting them as zero', () => {
    const report = writeRunReport({ ...INPUT, usage: { calls: 3, inputTokens: 900, outputTokens: 300, unreported: 1 } });
    expect(report).toContain("- 1 call didn't report its tokens, so the figures below leave it out.");
  });

  it('says a free model costs nothing, and a sample hunt called nothing', () => {
    expect(writeRunReport({ ...INPUT, provider: 'openrouter' })).toContain('- Cost: nothing. This model is free.');
    const sample = writeRunReport({ ...INPUT, sample: true, provider: null, usage: NO_USAGE });
    expect(sample).toContain('Sample hunt: these results are invented, and no service was called.');
    expect(sample).toContain('- Provider: none. A sample hunt calls no service.');
  });

  it('writes a report for a stopped hunt, with the cause in plain words (AC-8.1)', () => {
    const report = writeRunReport({ ...INPUT, status: 'failed', problem: 'wrong-key', kept: [], dropped: [], usage: NO_USAGE });
    expect(report).toContain("Stopped. This key didn't work with Google Gemini. Check it in Settings.");
    expect(report).toContain('## Fresh posts\n\n- None.');
  });

  it('writes a report for a cancelled hunt, keeping what was found', () => {
    expect(writeRunReport({ ...INPUT, status: 'cancelled' })).toContain(
      'Cancelled. 1 new lead found before it stopped was kept, 1 lead dropped.',
    );
  });

  it('lists a stage that kept nothing under Dry queries, and sources it could not search', () => {
    const report = writeRunReport({ ...INPUT, kept: [], failedSources: ['news.example'], unread: 8 });
    expect(report).toContain('- Hacker News hiring thread: nothing new fit your profile.');
    expect(report).toContain("## Couldn't search today\n\n- news.example\n- 8 possible leads couldn't be checked this time.");
  });

  it('lists follow-ups due on the day', () => {
    const emailed: Lead = {
      ...LEAD,
      status: 'emailed',
      people: [{ ...LEAD.people[0]!, emailedOn: ['2026-11-06'] }],
    };
    expect(writeRunReport({ ...INPUT, leads: [emailed] })).toContain(
      '- Quillstack: emailed 2026-11-06, no reply. Follow-up 1 is due.',
    );
  });

  it('names a second report on the same day with -2 (FRD §11.1)', () => {
    expect(reportFileName('2026-11-15', 0)).toBe('2026-11-15.md');
    expect(reportFileName('2026-11-15', 1)).toBe('2026-11-15-2.md');
    expect(reportFileName('2026-11-15', 2)).toBe('2026-11-15-3.md');
  });
});

describe('a report from a real hunt', () => {
  it('never holds the key', async () => {
    const quill = String(COMMENTS.quillstack.id);
    const answer = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search_by_date')) return answer(SEARCH_ANSWER);
      if (url.endsWith(`/items/${THREAD_ID}`)) return answer(ITEM_ANSWER);
      const verdict = {
        commentId: quill,
        company: 'Quillstack',
        role: 'Senior Frontend Engineer',
        about: '',
        location: 'REMOTE (worldwide)',
        pay: '',
        verdict: 'keep',
        reason: 'fits',
        evidence: 'REMOTE (worldwide)',
        fit: 'Uses React and TypeScript.',
        hook: '',
      };
      return answer({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ leads: [verdict] }) }], role: 'model' }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 120, totalTokenCount: 1020 },
      });
    }) as typeof fetch;

    const result = await createRealHunt({
      provider: 'gemini',
      key: KEY,
      profile: { ...emptyProfile(), roles: ['Frontend engineer'], skills: ['React', 'TypeScript'], location: 'Lagos', remote: 'remote', floor: '$60k' },
      fetch: fetcher,
      knownKeys: new Set(),
      sources: { funding: false },
    })({ now: new Date('2026-11-15T09:00:00Z'), signal: new AbortController().signal, onProgress: () => {} });

    expect(result.usage).toEqual({ calls: 1, inputTokens: 900, outputTokens: 120, unreported: 0 });
    const report = writeRunReport({ ...INPUT, kept: result.leads, dropped: result.dropped, steps: result.steps, usage: result.usage ?? null });
    expect(report).toContain('### Quillstack: Senior Frontend Engineer');
    expect(report).not.toContain(KEY);
    expect(JSON.stringify(result)).not.toContain(KEY);
  });
});
