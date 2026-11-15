import { describe, expect, it } from 'vitest';
import { BOMB_ZIP, BY_HAND_ZIP, NEWER_ZIP } from '@/fixtures/backup-zips';
import { LEADS_CSV_HEADER } from '@/core/leads-csv';
import { NOTES_MAX } from '@/core/lead';
import { emptyProfile, type Profile } from '@/core/profile';
import { buildSampleFinds, buildSamplePipeline } from '@/core/sample-leads';
import { readZip, writeZip } from '@/core/zip';
import { backupFiles, backupZip, mergeBackup, readBackup } from './backup';
import { emptyData, type AppData, type RunRecord } from './data';
import { inflateRaw } from './inflate';

const NOW = new Date('2026-11-15T12:00:00Z');
const KEY = 'test-key-not-real-0000';

const fromBase64 = (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

// Invented people only: the sample leads, made "real" for the round trip.
function realData(): AppData {
  const finds = buildSampleFinds(NOW);
  const leads = [...buildSamplePipeline(NOW), ...finds.posts, ...finds.funding, ...finds.community].map((lead) => ({
    ...lead,
    sample: false,
    notes: lead.company === 'Quarry & Finch' ? 'Said to write again in January.' : '',
  }));
  const profile: Profile = {
    ...emptyProfile(),
    roles: ['Design engineer'],
    skills: ['React', 'Motion'],
    location: 'Lagos, Nigeria',
    remote: 'remote',
    floor: '$60k a year',
    proofLinks: [{ url: 'https://ada.example/work', line: 'A booking app' }],
  };
  const run: RunRecord = {
    at: '2026-11-15T09:00:00.000Z',
    date: '2026-11-15',
    status: 'completed',
    kept: 3,
    dropped: [{ company: 'Brindle Talent', reason: 'recruiter', sourceUrl: 'https://news.ycombinator.com/item?id=2' }],
    sample: false,
    provider: 'gemini',
    report: '# Hunt: 2026-11-15\n\nCompleted.\n',
    reportName: '2026-11-15.md',
  };
  const sampleRun: RunRecord = { ...run, at: '2026-11-15T10:00:00.000Z', sample: true, reportName: '2026-11-15.md', report: '# sample\n' };
  const sampleLead = { ...leads[0]!, key: 'https://sample.example/x|sample co', company: 'Sample Co', sample: true };
  const base = emptyData();
  return {
    ...base,
    profile,
    leads: [...leads, sampleLead],
    runs: [run, sampleRun],
    settings: { ...base.settings, welcomeDone: true, provider: 'gemini' },
  };
}

describe('the backup (FR-9.2, AC-9.2)', () => {
  it('round-trips the leads, people, statuses, notes, profile and history into a fresh browser', async () => {
    const data = realData();
    const read = await readBackup(backupZip(data, NOW), inflateRaw);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const { data: restored, summary } = mergeBackup(emptyData(), read.incoming, false);

    expect(restored.leads).toEqual(data.leads.filter((lead) => !lead.sample));
    expect(restored.profile).toEqual(data.profile);
    expect(restored.runs).toEqual(data.runs.filter((run) => !run.sample));
    expect(summary).toEqual({ added: data.leads.length - 1, alreadyHere: 0, profile: 'added', runsAdded: 1, needsReview: 0, blocked: 0 });
  });

  it("writes the skill's files, with the leads.csv header exactly as FRD §11.2 says", async () => {
    const names = backupFiles(realData()).map((file) => file.name);
    expect(names).toEqual(['profile.md', 'leads.csv', 'runs/2026-11-15.md', 'get-me-hired.json']);
    const files = await readZip(backupZip(realData(), NOW));
    const csv = new TextDecoder().decode(files.find((file) => file.name === 'leads.csv')?.data);
    expect(csv.split('\n')[0]).toBe(LEADS_CSV_HEADER.join(','));
  });

  it('never exports sample leads, sample runs, or a key (FR-1.4, §11.1)', () => {
    const data = realData();
    const text = new TextDecoder().decode(backupZip(data, NOW));
    expect(text).not.toContain('Sample Co');
    expect(text).not.toContain('# sample');
    expect(text).not.toContain(KEY);
    expect(text).not.toMatch(/"keys"|apiKey/);
  });

  it('reads a backup someone zipped by hand, ignoring stray paths and refusing unsafe values', async () => {
    const read = await readBackup(fromBase64(BY_HAND_ZIP), inflateRaw);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const { leads, profile, runs, needsReview } = read.incoming;
    expect(profile?.roles).toEqual(['Frontend engineer']);
    expect(leads.map((lead) => lead.company)).toEqual(['Quillstack', 'Mosswood']);
    expect(leads[0]?.people[0]?.contacts).toEqual([
      { method: 'email', value: 'ana@quillstack.example', label: 'published', evidence: 'https://news.ycombinator.com/item?id=90000101' },
    ]);
    // An address with "?subject=" and a "javascript:" form are refused at the seam (AC-6.5).
    expect(leads[1]?.people.flatMap((person) => person.contacts)).toEqual([]);
    expect(runs.map((run) => run.reportName)).toEqual(['2026-11-10.md']);
    // Its lists match in length, so the row itself is fine: only the unsafe values were refused.
    expect(needsReview).toBe(0);
    // The planted key in the JSON is never read.
    expect(JSON.stringify(read.incoming)).not.toContain('planted-key');
  });

  it('refuses a backup from a newer version (FRD §11.4)', async () => {
    expect(await readBackup(fromBase64(NEWER_ZIP), inflateRaw)).toEqual({ ok: false, problem: 'newer' });
  });

  it('stops unpacking a ZIP bomb as soon as it passes the limit', async () => {
    expect(await readBackup(fromBase64(BOMB_ZIP), inflateRaw)).toEqual({ ok: false, problem: 'too-big' });
  });

  it('says plainly when a file is not a ZIP, or not a backup', async () => {
    expect(await readBackup(new TextEncoder().encode('company,role\n'), inflateRaw)).toEqual({ ok: false, problem: 'not-zip' });
    const other = writeZip([{ name: 'photo.txt', data: new TextEncoder().encode('hello') }]);
    expect(await readBackup(other, inflateRaw)).toEqual({ ok: false, problem: 'not-backup' });
  });
});

describe('importing into data already here (FR-6.8)', () => {
  it("keeps this browser's status, marks and notes for a lead in both, and only adds what it lacks", async () => {
    const data = realData();
    const read = await readBackup(backupZip(data, NOW), inflateRaw);
    if (!read.ok) throw new Error('backup unreadable');
    const mine = { ...data.leads[0]!, status: 'replied' as const, notes: 'Mine', statusHistory: [{ status: 'replied' as const, at: '2026-11-14T08:00:00.000Z' }] };
    const current: AppData = { ...emptyData(), leads: [mine], profile: { ...emptyProfile(), roles: ['Mine'] } };

    const { data: merged, summary } = mergeBackup(current, read.incoming, false);
    const lead = merged.leads.find((entry) => entry.key === mine.key);
    expect(lead?.status).toBe('replied');
    expect(lead?.notes).toBe('Mine');
    // The backup's history is added, in time order, and nothing moves the status back.
    expect(lead?.statusHistory.at(-1)).toEqual({ status: 'replied', at: '2026-11-14T08:00:00.000Z' });
    expect(lead?.statusHistory.length).toBeGreaterThan(1);
    expect(merged.profile?.roles).toEqual(['Mine']);
    expect(summary.profile).toBe('kept');
    expect(summary.alreadyHere).toBe(1);

    expect(mergeBackup(current, read.incoming, true).data.profile).toEqual(data.profile);
  });

  it('brings settings only into a fresh browser', async () => {
    const data = realData();
    data.settings.dailyTarget = 12;
    const read = await readBackup(backupZip(data, NOW), inflateRaw);
    if (!read.ok) throw new Error('backup unreadable');
    expect(mergeBackup(emptyData(), read.incoming, false).data.settings.dailyTarget).toBe(12);
    const used: AppData = { ...emptyData(), leads: [data.leads[0]!] };
    expect(mergeBackup(used, read.incoming, false).data.settings.dailyTarget).toBe(20);
  });
});

describe('a hostile backup', () => {
  const zipWith = (extras: unknown) =>
    writeZip([
      { name: 'get-me-hired.json', data: new TextEncoder().encode(JSON.stringify(extras)) },
      { name: 'leads.csv', data: new TextEncoder().encode(`${LEADS_CSV_HEADER.join(',')}\n`) },
    ]);
  const settingsOf = async (settings: unknown) => {
    const read = await readBackup(zipWith({ format_version: 1, settings }), inflateRaw);
    if (!read.ok) throw new Error('backup unreadable');
    return read.incoming.settings;
  };
  const cadence = (followupDelays: unknown, closeAfter: unknown, dailyTarget: unknown = 20) => ({
    daily_target: dailyTarget,
    cadence: { followupDelays, closeAfter },
  });

  it('keeps settings that are in range (FRD §8.2)', async () => {
    expect(await settingsOf(cadence([5, 7], 7, 12))).toEqual({ dailyTarget: 12, cadence: { followupDelays: [5, 7], closeAfter: 7 } });
    expect(await settingsOf(cadence([], 3))).toEqual({ dailyTarget: 20, cadence: { followupDelays: [], closeAfter: 3 } });
  });

  it('ignores settings out of range, which could otherwise freeze the app for good', async () => {
    for (const bad of [
      cadence([1e9], 7),
      cadence([5, 7], 1e9),
      cadence([2.5], 7),
      cadence([-1], 7),
      cadence([5, 5, 5, 5], 7),
      cadence([2], 7),
      cadence([11], 7),
      cadence('5', 7),
      cadence([5, 7], 7, 0),
      cadence([5, 7], 7, 1e9),
      cadence([5, 7], 7, 2.5),
    ]) {
      expect(await settingsOf(bad)).toBeNull();
    }
  });

  it('keeps only drop reasons the app knows', async () => {
    const read = await readBackup(
      zipWith({
        format_version: 1,
        runs: [
          {
            at: '2026-11-15T09:00:00.000Z',
            date: '2026-11-15',
            status: 'completed',
            kept: 0,
            dropped: [
              { company: 'Fennel', reason: 'location', sourceUrl: 'https://fennel.example', extra: 'ignored' },
              { company: 'Odd', reason: 'because I said so', sourceUrl: 'https://odd.example' },
            ],
          },
        ],
      }),
      inflateRaw,
    );
    if (!read.ok) throw new Error('backup unreadable');
    expect(read.incoming.runs[0]?.dropped).toEqual([{ company: 'Fennel', reason: 'location', sourceUrl: 'https://fennel.example' }]);
  });

  it('never unpacks an entry it will not read', async () => {
    const wanted: string[] = [];
    const inflate: typeof inflateRaw = async (data, max) => {
      wanted.push('inflated');
      return inflateRaw(data, max);
    };
    // The hand-made fixture holds ../evil.txt and notes/secret.txt beside the 4 backup files.
    const read = await readBackup(fromBase64(BY_HAND_ZIP), inflate);
    expect(read.ok).toBe(true);
    expect(wanted).toHaveLength(4);
  });
});

describe('the do-not-contact list in a backup (FR-5.7)', () => {
  const blocked: AppData['doNotContact'] = [
    { kind: 'domain', value: 'quarryfinch.example', addedOn: '2026-11-14' },
    { kind: 'email', value: 'someone@else.example', addedOn: '2026-11-14' },
  ];

  it('travels in the backup, and comes back', async () => {
    const data = { ...realData(), doNotContact: blocked };
    const read = await readBackup(backupZip(data, NOW), inflateRaw);
    if (!read.ok) throw new Error('backup unreadable');
    expect(read.incoming.doNotContact.map((entry) => entry.value)).toEqual(['quarryfinch.example', 'someone@else.example']);
  });

  it('only grows on import, and keeps a blocked lead out even when the backup holds it', async () => {
    const read = await readBackup(backupZip(realData(), NOW), inflateRaw);
    if (!read.ok) throw new Error('backup unreadable');
    const here: AppData = { ...emptyData(), doNotContact: blocked };
    const { data, summary } = mergeBackup(here, read.incoming, false);
    expect(data.doNotContact).toEqual(blocked);
    expect(data.leads.map((lead) => lead.company)).not.toContain('Quarry & Finch');
    expect(summary.blocked).toBe(1);
  });
});

describe('the round trip keeps notes', () => {
  it('brings a note back exactly', async () => {
    const data = realData();
    expect(data.leads.some((lead) => lead.notes === 'Said to write again in January.')).toBe(true);
    const read = await readBackup(backupZip(data, NOW), inflateRaw);
    if (!read.ok) throw new Error('backup unreadable');
    expect(read.incoming.leads.find((lead) => lead.company === 'Quarry & Finch')?.notes).toBe('Said to write again in January.');
  });
});

describe('notes in a backup (FR-6.7)', () => {
  it('come in cleaned and capped, like typed notes', async () => {
    const data = realData();
    const lead = data.leads[0]!;
    data.leads[0] = { ...lead, notes: `ok${'x'.repeat(NOTES_MAX + 10)}` };
    const result = await readBackup(backupZip(data, NOW), inflateRaw);
    if (!result.ok) throw new Error('backup unreadable');
    const notes = result.incoming.leads.find((entry) => entry.key === lead.key)?.notes ?? '';
    expect(notes).toHaveLength(NOTES_MAX);
    expect(notes.startsWith('okx')).toBe(true);
  });
});

describe('the monthly cap in a backup (AC-4.13)', () => {
  const zipWith = (extras: unknown) =>
    writeZip([
      { name: 'get-me-hired.json', data: new TextEncoder().encode(JSON.stringify(extras)) },
      { name: 'leads.csv', data: new TextEncoder().encode(`${LEADS_CSV_HEADER.join(',')}\n`) },
    ]);
  const read = async (extras: unknown) => {
    const result = await readBackup(zipWith({ format_version: 1, ...(extras as object) }), inflateRaw);
    if (!result.ok) throw new Error('backup unreadable');
    return result.incoming;
  };
  const settings = (monthlyCap: unknown) => ({ daily_target: 20, cadence: { followupDelays: [5], closeAfter: 7 }, monthly_cap: monthlyCap });
  const run = (listCost: unknown) => ({ at: '2026-11-15T09:00:00.000Z', date: '2026-11-15', status: 'completed', kept: 0, dropped: [], list_cost: listCost });

  it('travels in the backup with each run’s cost', async () => {
    const data: AppData = {
      ...emptyData(),
      settings: { ...emptyData().settings, monthlyCap: 40 },
      runs: [{ at: '2026-11-15T09:00:00.000Z', date: '2026-11-15', status: 'completed', kept: 0, dropped: [], sample: false, listCost: 0.03, unreported: 1 }],
    };
    const result = await readBackup(backupZip(data, NOW), inflateRaw);
    if (!result.ok) throw new Error('backup unreadable');
    expect(result.incoming.settings?.monthlyCap).toBe(40);
    expect(result.incoming.runs[0]).toMatchObject({ listCost: 0.03, unreported: 1 });
  });

  it('keeps a cap in range, and ignores one outside it while keeping the other settings', async () => {
    expect((await read({ settings: settings(50) })).settings?.monthlyCap).toBe(50);
    for (const bad of [0, -5, 2.5, 501, 1e9, '10', null]) {
      const incoming = await read({ settings: settings(bad) });
      expect(incoming.settings).not.toBeNull();
      expect(incoming.settings).not.toHaveProperty('monthlyCap');
    }
  });

  it('carries the retention period in range, and which reports retention deleted (FR-9.7)', async () => {
    const data: AppData = {
      ...emptyData(),
      settings: { ...emptyData().settings, retentionDays: 90 },
      runs: [{ at: '2026-01-10T09:00:00.000Z', date: '2026-01-10', status: 'completed', kept: 2, dropped: [], sample: false, reportExpired: true }],
    };
    const result = await readBackup(backupZip(data, NOW), inflateRaw);
    if (!result.ok) throw new Error('backup unreadable');
    expect(result.incoming.settings?.retentionDays).toBe(90);
    expect(result.incoming.runs[0]).toMatchObject({ reportExpired: true, kept: 2 });
    for (const bad of [29, 366, 90.5, '90', null]) {
      const incoming = await read({ settings: { ...settings(5), retention_days: bad } });
      expect(incoming.settings).not.toHaveProperty('retentionDays');
    }
  });

  it('carries the source switches, and takes only a real true or false (FR-10.3)', async () => {
    const data: AppData = { ...emptyData(), settings: { ...emptyData().settings, sources: { community: false } } };
    const result = await readBackup(backupZip(data, NOW), inflateRaw);
    if (!result.ok) throw new Error('backup unreadable');
    expect(result.incoming.settings?.sources).toEqual({ community: false });
    for (const bad of [{ community: 'false' }, 'off', null, {}]) {
      const incoming = await read({ settings: { ...settings(5), sources: bad } });
      expect(incoming.settings).not.toBeNull();
      expect(incoming.settings).not.toHaveProperty('sources');
    }
  });

  it('carries run on open, and takes only a real true or false (FR-4.2)', async () => {
    const data: AppData = { ...emptyData(), settings: { ...emptyData().settings, runOnOpen: true } };
    const result = await readBackup(backupZip(data, NOW), inflateRaw);
    if (!result.ok) throw new Error('backup unreadable');
    expect(result.incoming.settings?.runOnOpen).toBe(true);
    for (const bad of ['true', 1, null]) {
      const incoming = await read({ settings: { ...settings(5), run_on_open: bad } });
      expect(incoming.settings).not.toHaveProperty('runOnOpen');
    }
    expect((await read({ settings: { ...settings(5), run_on_open: false } })).settings?.runOnOpen).toBe(false);
  });

  it('reads a cost that is not a sane dollar figure as unknown, never as $0', async () => {
    expect((await read({ runs: [run(0.5)] })).runs[0]?.listCost).toBe(0.5);
    expect((await read({ runs: [run(null)] })).runs[0]?.listCost).toBeNull();
    for (const bad of [-1, 1e9, '0.5', Number.NaN]) expect((await read({ runs: [run(bad)] })).runs[0]?.listCost).toBeNull();
    expect((await read({ runs: [{ ...run(0), list_cost: undefined }] })).runs[0]).not.toHaveProperty('listCost');
  });
});
