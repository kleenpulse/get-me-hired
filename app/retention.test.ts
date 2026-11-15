import { describe, expect, it } from 'vitest';
import type { Lead, LeadStatus, Person } from '@/core/lead';
import { emptyData, type AppData, type RunRecord } from './data';
import { applyRetention, closedOn, isScrubbed, REMOVED, retentionDue } from './retention';

const TODAY = '2026-11-15';
const DAYS = 180;

// Invented people and companies.
const person = (name: string, email: string): Person => ({
  name,
  role: 'Founder',
  contacts: [{ method: 'email', value: email, label: 'published', evidence: 'https://news.ycombinator.com/item?id=1' }],
  emailedOn: ['2026-04-01'],
  followupsSent: [],
});

/** A lead that entered `status` at local noon on `on`. */
function lead(company: string, status: LeadStatus, on: string, extra: Partial<Lead> = {}): Lead {
  const url = `https://news.ycombinator.com/item?id=${company.length}`;
  return {
    key: `${url}|${company.toLowerCase()}`,
    foundOn: '2026-03-01',
    type: 'post',
    company,
    companyUrl: '',
    about: '',
    role: 'Frontend Engineer',
    fit: 'They want React.',
    postedAt: null,
    postedAtApprox: false,
    likes: 'n/a',
    round: '',
    location: '',
    people: [person('Ana Lima', 'ana@tidewell.example'), person('Bo Chen', 'bo@tidewell.example')],
    hooks: [{ text: 'Ana Lima built the first version.', url }, { text: 'They ship weekly.', url }],
    sources: [{ kind: 'community', url, seen: '2026-03-01' }],
    signals: [],
    tier: 'A',
    status,
    statusHistory: [
      { status: 'new', at: '2026-03-01T12:00:00' },
      { status, at: `${on}T12:00:00` },
    ],
    snoozeUntil: null,
    attention: null,
    notes: '',
    sample: false,
    ...extra,
  };
}

const REPORT = [
  '# Hunt: 2026-04-01',
  '',
  '## Community threads',
  '',
  '### Tidewell: Frontend Engineer',
  '- Contact: Ana Lima (Founder). ana@tidewell.example (published, https://news.ycombinator.com/item?id=8)',
  '- Contact: Bo Chen (Founder). bo@tidewell.example (published, https://news.ycombinator.com/item?id=8)',
  '- Hook: Ana Lima built the first version. https://news.ycombinator.com/item?id=8',
  '- Hook: They ship weekly. https://news.ycombinator.com/item?id=8',
  '',
].join('\n');

const run = (date: string, extra: Partial<RunRecord> = {}): RunRecord => ({
  at: `${date}T09:00:00.000Z`,
  date,
  status: 'completed',
  kept: 3,
  dropped: [{ company: 'Brindle', reason: 'recruiter', sourceUrl: 'https://news.ycombinator.com/item?id=9' }],
  sample: false,
  listCost: 0.03,
  unreported: 0,
  report: REPORT,
  reportName: `${date}.md`,
  ...extra,
});

function withLeads(leads: Lead[], runs: RunRecord[] = []): AppData {
  return { ...emptyData(), leads, runs };
}

describe('when a closed lead closed (FR-9.7)', () => {
  it('is the newest history entry with its current status', () => {
    const reopened = lead('Tidewell', 'skip', '2026-05-20', {
      statusHistory: [
        { status: 'skip', at: '2026-03-02T12:00:00' },
        { status: 'new', at: '2026-04-01T12:00:00' },
        { status: 'skip', at: '2026-05-20T12:00:00' },
      ],
    });
    expect(closedOn(reopened)).toBe('2026-05-20');
  });

  it('falls back to the day it was found when no entry says, which errs toward privacy', () => {
    expect(closedOn(lead('Tidewell', 'rejected', '2026-05-01', { statusHistory: [] }))).toBe('2026-03-01');
  });

  it('is null for a lead that is still open', () => {
    expect(closedOn(lead('Tidewell', 'emailed', '2026-04-01'))).toBeNull();
  });
});

describe('retention (FR-9.7, FRD §13.2)', () => {
  it("replaces a closed lead's people with one (removed), and scrubs them from reports", () => {
    const old = lead('Tidewell', 'no-reply', '2026-05-01', { notes: 'My own note: liked their blog.' });
    const after = applyRetention(withLeads([old], [run('2026-10-01')]), TODAY, DAYS);
    const kept = after.leads[0]!;
    expect(kept.people).toEqual([{ name: REMOVED, role: '', contacts: [], emailedOn: [], followupsSent: [] }]);
    expect(isScrubbed(kept)).toBe(true);
    expect(kept.company).toBe('Tidewell');
    expect(kept.status).toBe('no-reply');
    expect(kept.hooks.map((hook) => hook.text)).toEqual(['They ship weekly.']);
    // The user's own notes stay (FR-6.7).
    expect(kept.notes).toBe('My own note: liked their blog.');
    const report = after.runs[0]?.report ?? '';
    expect(report).not.toMatch(/Ana Lima|Bo Chen|@tidewell\.example/);
    expect(report).toContain('### Tidewell: Frontend Engineer');
    expect(report).toContain('- Hook: They ship weekly.');
    expect(JSON.stringify(after.leads)).not.toMatch(/Ana Lima|Bo Chen|@tidewell\.example/);
  });

  it('waits the whole period: exactly 180 days is not yet', () => {
    const edge = lead('Tidewell', 'skip', '2026-05-19');
    expect(applyRetention(withLeads([edge]), TODAY, DAYS).leads[0]).toBe(edge);
    expect(isScrubbed(applyRetention(withLeads([edge]), '2026-11-16', DAYS).leads[0]!)).toBe(true);
  });

  it('leaves a lead reopened before the deadline, and keeps a scrubbed one scrubbed after it reopens', () => {
    const reopened = lead('Tidewell', 'emailed', '2026-04-01', {
      statusHistory: [
        { status: 'skip', at: '2026-03-02T12:00:00' },
        { status: 'emailed', at: '2026-04-01T12:00:00' },
      ],
    });
    expect(applyRetention(withLeads([reopened]), TODAY, DAYS).leads[0]).toBe(reopened);
    const scrubbed = applyRetention(withLeads([lead('Tidewell', 'rejected', '2026-01-01')]), TODAY, DAYS).leads[0]!;
    const back = { ...scrubbed, status: 'new' as const };
    expect(applyRetention(withLeads([back]), TODAY, DAYS).leads[0]).toBe(back);
    expect(isScrubbed(back)).toBe(true);
  });

  it('never touches open leads, sample leads or the do-not-contact list', () => {
    const open = (['new', 'emailed', 'replied', 'call', 'offer', 'not-now'] as const).map((status) => lead(`Open ${status}`, status, '2025-01-01'));
    const sample = lead('Sample Co', 'skip', '2025-01-01', { sample: true });
    const blocked = { kind: 'person' as const, value: 'ana lima', at: 'tidewell.example', addedOn: '2025-01-01' };
    const data = { ...withLeads([...open, sample]), doNotContact: [blocked] };
    const after = applyRetention(data, TODAY, DAYS);
    expect(after).toBe(data);
    expect(after.doNotContact).toEqual([blocked]);
  });

  it('deletes reports older than the period and keeps their counts', () => {
    const data = withLeads([], [run('2026-01-10'), run('2026-11-01'), run('2025-01-01', { sample: true })]);
    const after = applyRetention(data, TODAY, DAYS);
    const [old, recent, sample] = after.runs;
    expect(old).not.toHaveProperty('report');
    expect(old).not.toHaveProperty('reportName');
    expect(old).toMatchObject({ reportExpired: true, kept: 3, listCost: 0.03, unreported: 0 });
    expect(old?.dropped).toHaveLength(1);
    expect(recent?.report).toBe(REPORT);
    expect(sample?.report).toBe(REPORT);
  });

  it('changes nothing, and returns the same data, when nothing is due', () => {
    const data = withLeads([lead('Tidewell', 'skip', '2026-10-01')], [run('2026-10-01')]);
    expect(applyRetention(data, TODAY, DAYS)).toBe(data);
  });

  it('counts what a shorter period would clear, to ask first', () => {
    const data = withLeads([lead('Tidewell', 'skip', '2026-09-01'), lead('Quarry', 'skip', '2026-11-10')], [run('2026-09-01')]);
    expect(retentionDue(data, TODAY, DAYS)).toEqual({ leads: 0, reports: 0 });
    expect(retentionDue(data, TODAY, 30)).toEqual({ leads: 1, reports: 1 });
  });
});
