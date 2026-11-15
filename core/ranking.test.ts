import { describe, expect, it } from 'vitest';
import type { Contact, Lead, LeadSource, Person, Signal } from './lead';
import { markEmailed, markFollowupSent, setStatus } from './lifecycle';
import { ageHours, buildToday, computeTier, countDoneToday, newGroupOf } from './ranking';

const NOW = new Date('2026-11-16T12:00:00Z');
const NOW_MS = NOW.getTime();
const TODAY = '2026-11-16';
const HOUR_MS = 3_600_000;

const email = (label: Contact['label']): Contact => ({ method: 'email', value: 'someone@northpeak.example', label });

function person(label: Contact['label'] = 'published', name = 'Ada Quill'): Person {
  return { name, role: 'CEO', contacts: [email(label)], emailedOn: [], followupsSent: [] };
}

interface Spec {
  company: string;
  type?: Lead['type'];
  kind?: LeadSource['kind'];
  hoursAgo?: number | null;
  signals?: Signal[];
  people?: Person[];
}

function lead(spec: Spec): Lead {
  const type = spec.type ?? 'post';
  const people = spec.people ?? [person()];
  const signals = spec.signals ?? [];
  const hoursAgo = spec.hoursAgo === undefined ? 5 : spec.hoursAgo;
  return {
    key: `https://${spec.company.toLowerCase()}.example|${spec.company.toLowerCase()}`,
    foundOn: TODAY,
    type,
    company: spec.company,
    companyUrl: '',
    about: '',
    role: '',
    fit: '',
    postedAt: hoursAgo === null ? null : new Date(NOW_MS - hoursAgo * HOUR_MS).toISOString(),
    postedAtApprox: false,
    likes: 'unknown',
    round: '',
    location: '',
    people,
    hooks: [],
    sources: [{ kind: spec.kind ?? (type === 'funding' ? 'funding' : 'post'), url: '', seen: TODAY }],
    signals,
    tier: computeTier({ type, signals, people }),
    status: 'new',
    statusHistory: [{ status: 'new', at: NOW.toISOString() }],
    snoozeUntil: null,
    attention: null,
    notes: '',
    sample: false,
  };
}

const order = (leads: Lead[], dailyTarget = 100) =>
  buildToday(leads, { today: TODAY, nowMs: NOW_MS, dailyTarget }).entries.map((entry) => entry.lead.company);

describe('computeTier (§9.3)', () => {
  const tier = (signals: Signal[], label: Contact['label'] = 'published', type: Lead['type'] = 'post') =>
    computeTier({ type, signals, people: [person(label)] });

  it('gives A to a lead with at most 1 signal and a checked address', () => {
    expect(tier([])).toBe('A');
    expect(tier(['pay-unknown'])).toBe('A');
    expect(tier(['pay-unknown'], 'pattern')).toBe('A');
  });

  it('gives B to a lead with 2 or 3 signals', () => {
    expect(tier(['pay-unknown', 'timezone'])).toBe('B');
    expect(tier(['pay-unknown', 'timezone', 'relocation'])).toBe('B');
  });

  it('gives B when every address is a guess, however few the signals', () => {
    expect(tier([], 'guess')).toBe('B');
    expect(tier(['guess-only'], 'guess')).toBe('B');
  });

  it('gives C to a lead with 4 or more signals, or equity only', () => {
    expect(tier(['pay-unknown', 'timezone', 'relocation', 'visa-unknown'])).toBe('C');
    expect(tier(['equity-only'])).toBe('C');
  });

  it('does not count "no open role" against a funding lead', () => {
    expect(tier(['no-open-role', 'pay-unknown'], 'published', 'funding')).toBe('A');
    expect(tier(['no-open-role', 'pay-unknown'], 'published', 'post')).toBe('B');
    expect(tier(['no-open-role', 'pay-unknown', 'timezone', 'relocation'], 'published', 'funding')).toBe('B');
  });

  it('gives B when a lead has no email address at all', () => {
    const dmOnly: Person = { name: 'A', role: '', contacts: [{ method: 'dm', value: 'LinkedIn' }], emailedOn: [], followupsSent: [] };
    expect(computeTier({ type: 'post', signals: [], people: [dmOnly] })).toBe('B');
    expect(computeTier({ type: 'post', signals: [], people: [] })).toBe('B');
  });

  it('counts a checked address on any one person', () => {
    expect(computeTier({ type: 'funding', signals: [], people: [person('guess'), person('pattern')] })).toBe('A');
  });
});

describe('ageHours and groups', () => {
  it('measures age from the publish time', () => {
    expect(ageHours({ postedAt: new Date(NOW_MS - 4 * HOUR_MS).toISOString() }, NOW_MS)).toBe(4);
    expect(ageHours({ postedAt: null }, NOW_MS)).toBeNull();
    expect(ageHours({ postedAt: 'not a date' }, NOW_MS)).toBeNull();
  });

  it('groups a community thread opening apart from a fresh post', () => {
    expect(newGroupOf(lead({ company: 'A' }))).toBe('post');
    expect(newGroupOf(lead({ company: 'B', type: 'funding' }))).toBe('funding');
    expect(newGroupOf(lead({ company: 'C', kind: 'community' }))).toBe('community');
  });

  it('puts a lead with both a post and a funding round with the posts (FR-4.16)', () => {
    const merged = lead({ company: 'D', type: 'funding' });
    merged.sources.push({ kind: 'post', url: '', seen: TODAY });
    expect(newGroupOf(merged)).toBe('post');
  });
});

describe("Today's order (§9.4, AC-6.1)", () => {
  it('lists follow-ups, then attention, then posts, funding and community', () => {
    const followup = markEmailed(lead({ company: 'Followup' }), 0, '2026-11-09', NOW);
    const signal = { ...lead({ company: 'Signal' }), attention: 'new-signal' as const };
    expect(
      order([
        lead({ company: 'Community', kind: 'community' }),
        lead({ company: 'Funding', type: 'funding' }),
        signal,
        lead({ company: 'Post' }),
        followup,
      ]),
    ).toEqual(['Followup', 'Signal', 'Post', 'Funding', 'Community']);
  });

  it('lists the oldest follow-up first', () => {
    const older = markEmailed(lead({ company: 'Older' }), 0, '2026-11-02', NOW);
    const newer = markEmailed(lead({ company: 'Newer' }), 0, '2026-11-09', NOW);
    expect(order([newer, older])).toEqual(['Older', 'Newer']);
  });

  it('orders new leads by tier, then youngest first', () => {
    expect(
      order([
        lead({ company: 'B-young', hoursAgo: 1, signals: ['pay-unknown', 'timezone'] }),
        lead({ company: 'A-old', hoursAgo: 20 }),
        lead({ company: 'C-young', hoursAgo: 2, signals: ['equity-only'] }),
        lead({ company: 'A-young', hoursAgo: 3 }),
      ]),
    ).toEqual(['A-young', 'A-old', 'B-young', 'C-young']);
  });

  it('lists a lead of unknown age last in its tier', () => {
    expect(
      order([lead({ company: 'Unknown', hoursAgo: null }), lead({ company: 'Old', hoursAgo: 23 }), lead({ company: 'Young', hoursAgo: 1 })]),
    ).toEqual(['Young', 'Old', 'Unknown']);
  });

  it('keeps tier C posts ahead of tier A funding, because posts go stale in hours', () => {
    expect(
      order([lead({ company: 'Funding-A', type: 'funding' }), lead({ company: 'Post-C', signals: ['equity-only'] })]),
    ).toEqual(['Post-C', 'Funding-A']);
  });

  it('gives each entry the facts for its "why it is here" line', () => {
    const followup = markEmailed(lead({ company: 'Followup' }), 0, '2026-11-09', NOW);
    const { entries } = buildToday([followup, lead({ company: 'Post', hoursAgo: 4 })], {
      today: TODAY,
      nowMs: NOW_MS,
      dailyTarget: 20,
    });
    expect(entries.map((entry) => entry.reason)).toEqual([
      { kind: 'followup', number: 1, dueOn: '2026-11-16' },
      { kind: 'new', group: 'post', ageHours: 4, tier: 'A' },
    ]);
  });

  it('holds a fixed order for 30 mixed leads', () => {
    const tiers: Signal[][] = [[], ['pay-unknown', 'timezone'], ['equity-only']];
    const leads: Lead[] = [];
    for (let index = 0; index < 24; index++) {
      const kind = (['post', 'funding', 'community'] as const)[index % 3];
      leads.push(
        lead({
          company: `${kind}-${String(index).padStart(2, '0')}`,
          type: kind === 'funding' ? 'funding' : 'post',
          kind,
          hoursAgo: index % 5 === 4 ? null : (index * 7) % 23,
          signals: tiers[(index >> 1) % 3],
        }),
      );
    }
    for (let index = 0; index < 4; index++) {
      leads.push(markEmailed(lead({ company: `followup-${index}` }), 0, `2026-11-0${9 - index * 2}`, NOW));
    }
    leads.push({ ...lead({ company: 'attention-0' }), attention: 'new-signal' });
    leads.push({ ...lead({ company: 'attention-1' }), attention: 'back-from-not-now' });
    expect(leads).toHaveLength(30);

    const { entries } = buildToday(leads, { today: TODAY, nowMs: NOW_MS, dailyTarget: 100 });
    expect(entries).toHaveLength(30);

    // The groups come in the order of §9.4, with no group split in two.
    const groups = entries.map((entry) => entry.group);
    expect(groups.filter((group, index) => group !== groups[index - 1])).toEqual([
      'followup',
      'attention',
      'post',
      'funding',
      'community',
    ]);

    // Follow-ups: oldest due date first.
    const due = entries.flatMap((entry) => (entry.reason.kind === 'followup' ? [entry.reason.dueOn] : []));
    expect(due).toEqual([...due].sort());

    // Inside each new group: tier A to C, then youngest first, unknown ages last.
    for (const group of ['post', 'funding', 'community'] as const) {
      const ranks = entries.flatMap((entry) =>
        entry.reason.kind === 'new' && entry.reason.group === group
          ? ['ABC'.indexOf(entry.reason.tier) * 1000 + (entry.reason.ageHours ?? 999)]
          : [],
      );
      expect(ranks.length).toBeGreaterThan(0);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }

    expect(entries.map((entry) => entry.lead.company)).toMatchInlineSnapshot(`
      [
        "followup-3",
        "followup-2",
        "followup-1",
        "followup-0",
        "attention-0",
        "attention-1",
        "post-00",
        "post-18",
        "post-12",
        "post-06",
        "post-21",
        "post-15",
        "post-03",
        "post-09",
        "funding-07",
        "funding-01",
        "funding-13",
        "funding-19",
        "funding-10",
        "funding-22",
        "funding-16",
        "funding-04",
        "community-20",
        "community-08",
        "community-02",
        "community-14",
        "community-23",
        "community-17",
        "community-11",
        "community-05",
      ]
    `);
  });
});

describe('the daily target', () => {
  const three = (company: string) =>
    lead({ company, type: 'funding', people: [person('published', 'A'), person('guess', 'B'), person('guess', 'C')] });

  it('counts people, not leads', () => {
    const list = buildToday([three('One'), three('Two'), three('Three')], { today: TODAY, nowMs: NOW_MS, dailyTarget: 5 });
    // One (3 people) and Two (3 more) reach the target of 5. Three is left out.
    expect(list.entries.map((entry) => entry.lead.company)).toEqual(['One', 'Two']);
    expect(list.people.funding).toBe(6);
    expect(list.leftOut).toBe(1);
  });

  it('shrinks the list as people are emailed today', () => {
    const leads = [lead({ company: 'A' }), lead({ company: 'B' }), lead({ company: 'C' })];
    expect(order(leads, 2)).toEqual(['A', 'B']);

    const after = [markEmailed(leads[0] as Lead, 0, TODAY, NOW), leads[1] as Lead, leads[2] as Lead];
    const list = buildToday(after, { today: TODAY, nowMs: NOW_MS, dailyTarget: 2 });
    expect(list.done).toEqual({ emailed: 1, followups: 0 });
    expect(list.entries.map((entry) => entry.lead.company)).toEqual(['B']);
  });

  it('lists nothing once the target is met', () => {
    const leads = [markEmailed(lead({ company: 'A' }), 0, TODAY, NOW), lead({ company: 'B' })];
    expect(buildToday(leads, { today: TODAY, nowMs: NOW_MS, dailyTarget: 1 }).entries).toEqual([]);
  });

  it('keeps a lead in the list while the user is partway through its people', () => {
    const partway = markEmailed(three('Partway'), 0, TODAY, NOW);
    const list = buildToday([partway], { today: TODAY, nowMs: NOW_MS, dailyTarget: 20 });
    expect(list.entries.map((entry) => entry.people)).toEqual([2]);
  });

  it('drops a lead from the list once everyone on it is emailed', () => {
    let done = three('Done');
    for (const index of [0, 1, 2]) done = markEmailed(done, index, TODAY, NOW);
    expect(order([done])).toEqual([]);
  });

  it('does not list a lead that was started on an earlier day', () => {
    const yesterday = markEmailed(three('Yesterday'), 0, '2026-11-13', NOW);
    expect(order([yesterday])).toEqual([]);
  });

  it('leaves out leads that are closed or parked', () => {
    const base = lead({ company: 'X' });
    for (const status of ['replied', 'call', 'offer', 'rejected', 'skip', 'no-reply', 'not-now'] as const) {
      expect(order([setStatus(base, status, TODAY, NOW)])).toEqual([]);
    }
  });

  it('counts first emails and follow-ups sent today (FR-6.11)', () => {
    const emailedToday = markEmailed(lead({ company: 'A' }), 0, TODAY, NOW);
    const followedToday = markFollowupSent(markEmailed(lead({ company: 'B' }), 0, '2026-11-09', NOW), 0, TODAY);
    const earlier = markEmailed(lead({ company: 'C' }), 0, '2026-11-13', NOW);
    expect(countDoneToday([emailedToday, followedToday, earlier], TODAY)).toEqual({ emailed: 1, followups: 1 });
  });
});
