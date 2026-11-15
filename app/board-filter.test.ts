import { describe, expect, it } from 'vitest';
import type { Contact, Lead } from '@/core/lead';
import { judge, type Verdict } from '@/core/hn-hunt';
import { emptyProfile } from '@/core/profile';
import { filterLeads, isFiltering, NO_FILTER, type BoardFilter } from './board-filter';

const TODAY = '2026-11-15';

// Invented companies.
const email = (label: Contact['label']): Contact => ({ method: 'email', value: 'hi@x.example', label });

function lead(company: string, extra: Partial<Lead> = {}): Lead {
  return {
    key: `https://${company.toLowerCase()}.example|${company.toLowerCase()}`,
    foundOn: '2026-11-14',
    type: 'post',
    company,
    companyUrl: `https://www.${company.toLowerCase()}.example`,
    about: '',
    role: 'Frontend Engineer',
    fit: '',
    postedAt: null,
    postedAtApprox: false,
    likes: 'unknown',
    round: '',
    location: 'Remote',
    people: [{ name: 'Someone', role: 'Founder', contacts: [email('published')], emailedOn: [], followupsSent: [] }],
    hooks: [],
    sources: [{ kind: 'post', url: 'https://www.linkedin.com/posts/x', seen: '2026-11-14' }],
    signals: [],
    tier: 'A',
    status: 'new',
    statusHistory: [],
    snoozeUntil: null,
    attention: null,
    notes: '',
    sample: false,
    ...extra,
  };
}

const LEADS = [
  lead('Ledgerly', { about: 'Bookkeeping for fintech startups.', location: 'Lagos, Nigeria' }),
  lead('Zoë Labs', { type: 'funding', round: '$2M seed', role: '', foundOn: '2026-10-01', signals: ['outside-domains'], status: 'emailed' }),
  lead('Threadly', {
    sources: [{ kind: 'community', url: 'https://news.ycombinator.com/item?id=1', seen: '2026-11-10' }],
    people: [{ name: 'A', role: 'CTO', contacts: [email('pattern')], emailedOn: [], followupsSent: [] }],
    status: 'skip',
  }),
  lead('Guessco', { people: [{ name: 'B', role: 'CEO', contacts: [email('guess')], emailedOn: [], followupsSent: [] }] }),
  lead('Nobodyco', { people: [] }),
];

const names = (filter: Partial<BoardFilter>) => filterLeads(LEADS, { ...NO_FILTER, ...filter }, TODAY).map((entry) => entry.company);

describe('Board search and filter (FR-6.6)', () => {
  it('shows everything with no filter', () => {
    expect(names({})).toEqual(['Ledgerly', 'Zoë Labs', 'Threadly', 'Guessco', 'Nobodyco']);
    expect(isFiltering(NO_FILTER)).toBe(false);
  });

  it('searches company, role, place, what they do and web address, ignoring case and accents', () => {
    expect(names({ text: 'FINTECH' })).toEqual(['Ledgerly']);
    expect(names({ text: 'lagos' })).toEqual(['Ledgerly']);
    expect(names({ text: 'zoe' })).toEqual(['Zoë Labs']);
    expect(names({ text: 'guessco.example' })).toEqual(['Guessco']);
    expect(names({ text: 'news.ycombinator' })).toEqual(['Threadly']);
    // Every word must be found.
    expect(names({ text: 'frontend lagos' })).toEqual(['Ledgerly']);
    expect(names({ text: 'frontend nowhere' })).toEqual([]);
  });

  it('filters by type, with community threads apart from posts', () => {
    expect(names({ type: 'funding' })).toEqual(['Zoë Labs']);
    expect(names({ type: 'community' })).toEqual(['Threadly']);
    expect(names({ type: 'post' })).toEqual(['Ledgerly', 'Guessco', 'Nobodyco']);
  });

  it("shows the leads checked and found to mention none of the profile's fields", () => {
    expect(names({ fields: 'out' })).toEqual(['Zoë Labs']);
  });

  it('works on leads the Hacker News stage judged, not hand-made signals', () => {
    const profile = { ...emptyProfile(), roles: ['Frontend'], skills: ['React'], location: 'Lagos', floor: '$60k', domains: ['fintech'] };
    const verdict: Verdict = {
      commentId: '1',
      company: 'Acme',
      role: 'Frontend',
      about: '',
      location: 'Remote',
      pay: '',
      verdict: 'keep',
      reason: 'fits',
      evidence: 'Frontend | Remote',
      fit: 'Frontend role.',
      hook: '',
    };
    const judged = (id: string, company: string, text: string) => {
      const result = judge({ ...verdict, commentId: id, company }, { id, text, postedAt: '2026-11-14T00:00:00Z', author: 'x' }, profile, new Date(`${TODAY}T09:00:00Z`));
      if (result.kind !== 'keep') throw new Error('expected a lead');
      return result.lead;
    };
    const leads = [
      judged('1', 'Acme', 'Acme | Frontend | Remote. Payroll for fintech teams.'),
      judged('2', 'Globex', 'Globex | Frontend | Remote. Games for kids.'),
    ];
    expect(filterLeads(leads, { ...NO_FILTER, fields: 'out' }, TODAY).map((lead) => lead.company)).toEqual(['Globex']);
  });

  it('filters by the best address label', () => {
    expect(names({ label: 'published' })).toEqual(['Ledgerly', 'Zoë Labs']);
    expect(names({ label: 'pattern' })).toEqual(['Threadly']);
    expect(names({ label: 'guess' })).toEqual(['Guessco']);
    expect(names({ label: 'none' })).toEqual(['Nobodyco']);
  });

  it('filters by when it was found, and by status', () => {
    expect(names({ found: '7' })).toEqual(['Ledgerly', 'Threadly', 'Guessco', 'Nobodyco']);
    expect(names({ found: '30' })).not.toContain('Zoë Labs');
    expect(names({ statuses: ['emailed', 'skip'] })).toEqual(['Zoë Labs', 'Threadly']);
  });

  it('combines filters', () => {
    expect(names({ type: 'post', label: 'guess', text: 'frontend' })).toEqual(['Guessco']);
    expect(isFiltering({ ...NO_FILTER, text: '  ' })).toBe(false);
    expect(isFiltering({ ...NO_FILTER, statuses: ['new'] })).toBe(true);
  });
});
