import { describe, expect, it } from 'vitest';
import { personEntry } from '@/core/block';
import type { HuntResult } from '@/core/hunt';
import type { Lead } from '@/core/lead';
import { emptyData, type AppData } from './data';
import { addFound, applyBlocks } from './found';

const NOW = new Date('2026-11-15T12:00:00Z');
const URL = 'https://news.ycombinator.com/item?id=90000101';

// An invented lead, as a hunt would find it.
const QUILLSTACK: Lead = {
  key: `${URL}|quillstack`,
  foundOn: '2026-11-15',
  type: 'post',
  company: 'Quillstack',
  companyUrl: 'https://quillstack.example',
  about: '',
  role: 'Senior Frontend Engineer',
  fit: '',
  postedAt: '2026-11-02T15:04:05.000Z',
  postedAtApprox: false,
  likes: 'n/a',
  round: '',
  location: '',
  people: [
    {
      name: 'Ana Quill',
      role: 'Founder',
      contacts: [{ method: 'email', value: 'ana@quillstack.example', label: 'published', evidence: URL }],
      emailedOn: [],
      followupsSent: [],
    },
    { name: 'Ben Ray', role: 'CTO', contacts: [], emailedOn: [], followupsSent: [] },
  ],
  hooks: [],
  sources: [{ kind: 'community', url: URL, seen: '2026-11-15' }],
  signals: [],
  tier: 'A',
  status: 'new',
  statusHistory: [{ status: 'new', at: NOW.toISOString() }],
  snoozeUntil: null,
  attention: null,
  notes: '',
  sample: false,
};

const RESULT: HuntResult = {
  status: 'completed',
  leads: [QUILLSTACK],
  dropped: [],
  steps: [{ id: 'community', state: 'done', count: 1 }],
};

describe('adding what a hunt found (FR-5.7)', () => {
  it('applies a domain blocked while the hunt ran: the lead is not added, only its company and source are kept', () => {
    // The user blocked the domain after the hunt started, so the hunt never saw it.
    const current: AppData = { ...emptyData(), doNotContact: [{ kind: 'domain', value: 'quillstack.example', addedOn: '2026-11-15' }] };
    const after = addFound(current, RESULT, NOW, false, 'gemini');
    expect(after.leads).toEqual([]);
    const run = after.runs.at(-1);
    expect(run?.kept).toBe(0);
    expect(run?.dropped).toEqual([{ company: 'Quillstack', reason: 'do-not-contact', sourceUrl: URL }]);
    expect(JSON.stringify(run)).not.toContain('ana@quillstack.example');
    expect(run?.report).toContain('- Quillstack: On your do-not-contact list.');
  });

  it('applies a person blocked while the hunt ran: that person is taken off the added lead', () => {
    const block = personEntry('Ben Ray', QUILLSTACK, '2026-11-15')!;
    const after = addFound({ ...emptyData(), doNotContact: [block] }, RESULT, NOW, false, 'gemini');
    expect(after.leads[0]?.people.map((person) => person.name)).toEqual(['Ana Quill']);
    expect(after.runs.at(-1)?.report).not.toContain('Ben Ray');
  });

  it('counts a lead already saved as a duplicate, and adds nothing', () => {
    const after = addFound({ ...emptyData(), leads: [QUILLSTACK] }, RESULT, NOW, false, 'gemini');
    expect(after.leads).toHaveLength(1);
    expect(after.runs.at(-1)?.dropped).toEqual([{ company: 'Quillstack', reason: 'duplicate', sourceUrl: URL }]);
  });
});

describe('blocking saved leads', () => {
  it('adds entries once, removes leads on a blocked company domain, and says how many', () => {
    const data: AppData = { ...emptyData(), leads: [QUILLSTACK] };
    const entry = { kind: 'domain' as const, value: 'quillstack.example', addedOn: '2026-11-15' };
    const { data: after, removed } = applyBlocks(data, [entry]);
    expect(removed).toBe(1);
    expect(after.leads).toEqual([]);
    expect(applyBlocks(after, [entry]).data.doNotContact).toHaveLength(1);
  });
});
