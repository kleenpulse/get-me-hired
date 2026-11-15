import { describe, expect, it } from 'vitest';
import { writeCsv } from '@/core/csv';
import { rowToLead } from '@/core/lead-row';
import { LEADS_CSV_HEADER, parseLeadsCsv } from '@/core/leads-csv';
import { emptyProfile, writeProfileMd } from '@/core/profile';
import { buildSampleFinds } from '@/core/sample-leads';
import { parseCsv } from '@/core/csv';
import { backupFiles } from './backup';
import { emptyData, FORMAT_VERSION, type AppData, type RunRecord } from './data';
import { BACKUP_FOLDER, planFolderWrite, writeFolder, type WritableFolder } from './folder-write';

const NOW = new Date('2026-11-15T12:00:00Z');
const DAY = '2026-11-15';
const enc = (text: string) => new TextEncoder().encode(text);
const dec = (bytes: Uint8Array | undefined) => (bytes ? new TextDecoder().decode(bytes) : undefined);

/**
 * An in-memory folder that can be written. Every change is logged in order,
 * and a write can be made to fail when its new copy is closed.
 */
function memFolder(files: Map<string, Uint8Array>, options: { failOn?: string } = {}) {
  const log: string[] = [];
  const dirs = new Set<string>();
  const isDir = (path: string) => dirs.has(path) || [...files.keys()].some((name) => name.startsWith(`${path}/`));
  const make = (prefix: string, name: string): WritableFolder => ({
    name,
    async getFileHandle(child, opts) {
      const path = `${prefix}${child}`;
      if (isDir(path)) throw new DOMException('a folder', 'TypeMismatchError');
      if (!files.has(path)) {
        if (!opts?.create) throw new DOMException('missing', 'NotFoundError');
        files.set(path, new Uint8Array());
        log.push(`create ${path}`);
      }
      return {
        getFile: async () => {
          const data = files.get(path) ?? new Uint8Array();
          return { size: data.length, arrayBuffer: async () => data.slice().buffer };
        },
        createWritable: async () => {
          let next: Uint8Array = new Uint8Array();
          return {
            write: async (data: Uint8Array) => {
              next = data;
            },
            close: async () => {
              if (options.failOn === path) throw new Error('disk full');
              files.set(path, next);
              log.push(`write ${path}`);
            },
            abort: async () => {
              log.push(`abort ${path}`);
            },
          };
        },
      };
    },
    async getDirectoryHandle(child, opts) {
      const path = `${prefix}${child}`;
      if (!isDir(path)) {
        if (!opts?.create) throw new DOMException('missing', 'NotFoundError');
        dirs.add(path);
      }
      return make(`${path}/`, child);
    },
    async removeEntry(child) {
      files.delete(`${prefix}${child}`);
      log.push(`remove ${prefix}${child}`);
    },
    async *values() {
      const seen = new Map<string, 'file' | 'directory'>();
      for (const path of [...files.keys(), ...dirs]) {
        if (!path.startsWith(prefix)) continue;
        const [first, ...rest] = path.slice(prefix.length).split('/');
        if (first) seen.set(first, rest.length > 0 || dirs.has(`${prefix}${first}`) ? 'directory' : 'file');
      }
      for (const [child, kind] of seen) yield { kind, name: child };
    },
  });
  return { folder: make('', 'job-hunt'), log, files };
}

const profile = { ...emptyProfile(), roles: ['Design engineer'], skills: ['React'], location: 'Lagos, Nigeria', floor: '$60k a year' };

function appData(changes: Partial<AppData> = {}): AppData {
  const leads = buildSampleFinds(NOW).community.map((lead) => ({ ...lead, sample: false }));
  return { ...emptyData(), leads, profile, ...changes };
}

const run = (report: string, reportName: string, at = `${DAY}T09:00:00.000Z`): RunRecord => ({ at, date: DAY, status: 'completed', kept: 1, dropped: [], sample: false, report, reportName });

/** A leads.csv row the way the skill writes it, from a few changes to a clean row. */
const clean: Record<string, string> = {
  found_on: DAY,
  type: 'post',
  company: 'Kettle Labs',
  company_url: 'https://kettle.example',
  source_url: 'https://news.example/post/1',
  posted_at: '2026-11-15T08:00:00Z',
  age_hours: '4',
  likes: '12',
  round: '',
  role: 'Design engineer',
  fit: 'React and motion',
  people: 'Ada Obi (Founder)',
  contacts: 'ada@kettle.example',
  contact_confidence: 'published (https://kettle.example/team)',
  hooks: 'Ships every week',
  status: 'new',
  next_action_on: '',
};
const fields = (changes: Record<string, string>, extra: string[] = []) => [...LEADS_CSV_HEADER.map((name) => changes[name] ?? clean[name] ?? ''), ...extra];
const csv = (...rows: string[][]) => writeCsv([[...LEADS_CSV_HEADER], ...rows]);

describe('planning a save to a linked folder (FR-9.3)', () => {
  it('writes the same bytes as the export to an empty folder, with no sample leads and no keys', () => {
    const data = appData();
    data.leads.push({ ...buildSampleFinds(NOW).funding[0]!, company: 'Sample Only Co', sample: true });
    const plan = planFolderWrite([], data);
    const exported = backupFiles(data);
    expect(new Map(plan.writes.map((file) => [file.name, dec(file.data)]))).toEqual(new Map(exported.map((file) => [file.name, dec(file.data)])));
    expect(plan.writes.map((file) => dec(file.data)).join('')).not.toContain('Sample Only Co');
    expect(plan.writes.map((file) => file.name).sort()).toEqual(['get-me-hired.json', 'leads.csv', 'profile.md']);
  });

  it('never overwrites a report: a different one with the same name gets the next free name', () => {
    const existing = [
      { name: 'runs/2026-11-15.md', data: enc('# Theirs\n') },
      { name: 'runs/2026-11-15-2.md', data: enc('# Theirs too\n') },
    ];
    const data = appData({ runs: [run('# Ours\n', '2026-11-15.md'), run('# Theirs\n', '2026-11-15.md', `${DAY}T10:00:00.000Z`)] });
    const plan = planFolderWrite(existing, data);
    const names = plan.writes.map((file) => file.name);
    expect(names).toContain('runs/2026-11-15-3.md');
    expect(names).not.toContain('runs/2026-11-15.md');
    expect(names).not.toContain('runs/2026-11-15-2.md');
    expect(dec(plan.writes.find((file) => file.name === 'runs/2026-11-15-3.md')?.data)).toBe('# Ours\n');
    // The JSON points each run at the file that holds its words.
    const json = JSON.parse(dec(plan.writes.find((file) => file.name === 'get-me-hired.json')?.data) ?? '{}') as { runs: { report_name: string }[] };
    expect(json.runs.map((entry) => entry.report_name)).toEqual(['2026-11-15-3.md', '2026-11-15.md']);
  });

  it('writes new reports first and get-me-hired.json last, and skips files that would not change', () => {
    const data = appData({ runs: [run('# Ours\n', '2026-11-15.md')] });
    const first = planFolderWrite([], data);
    expect(first.writes.map((file) => file.name)).toEqual(['runs/2026-11-15.md', 'leads.csv', 'profile.md', 'get-me-hired.json']);
    expect(planFolderWrite(first.writes, data).writes).toEqual([]);
  });

  it('never writes over a profile.md the app can’t read, and leaves one that reads the same', () => {
    const odd = [{ name: 'profile.md', data: enc('just some notes\n') }];
    expect(planFolderWrite(odd, appData()).writes.map((file) => file.name)).not.toContain('profile.md');
    const same = [{ name: 'profile.md', data: enc(`${writeProfileMd(profile)}\n\n`) }];
    expect(planFolderWrite(same, appData()).writes.map((file) => file.name)).not.toContain('profile.md');
  });
});

describe('saving to a linked folder (FR-9.3)', () => {
  it('keeps every row the app can’t hold, repeats of a key, and takes out only blocked leads', async () => {
    const good = fields({});
    const odd = fields({ company: 'Odd Status Co', source_url: 'https://news.example/post/2', status: 'maybe-later' });
    const extra = fields({ company: 'Extra Column Co', source_url: 'https://news.example/post/3' }, ['kept as is']);
    const repeat = fields({ fit: 'A second row with the same key' });
    const badContact = fields({ company: 'Mailto Co', source_url: 'https://news.example/post/4', contacts: 'hi@mailto.example?subject=x' });
    const blocked = fields({ company: 'Blocked Co', company_url: 'https://blocked.example', source_url: 'https://news.example/post/5' });
    const { folder, files } = memFolder(new Map([['leads.csv', enc(csv(good, odd, extra, repeat, badContact, blocked))]]));

    // This browser has the clean lead, moved on to emailed.
    const parsed = parseLeadsCsv(csv(good));
    if (!parsed.ok) throw new Error('bad csv');
    const lead = rowToLead(parsed.leads[0]!);
    const emailed = { ...lead, status: 'emailed' as const, statusHistory: [...lead.statusHistory, { status: 'emailed' as const, at: `${DAY}T11:00:00.000Z` }] };
    const current = { ...emptyData(), leads: [emailed], doNotContact: [{ kind: 'domain' as const, value: 'blocked.example', addedOn: DAY }] };

    const result = await writeFolder(folder, current, DAY);
    if (!result.ok) throw new Error(result.problem);
    expect(result.keptAsWritten).toBe(4);
    expect(result.blockedRows).toBe(1);

    const rows = parseCsv(dec(files.get('leads.csv')) ?? '');
    expect(rows[0]).toEqual([...LEADS_CSV_HEADER]);
    const body = rows.slice(1);
    expect(body).toHaveLength(5);
    // Written by the app: the clean row, now with this browser's status.
    expect(body[0]?.[2]).toBe('Kettle Labs');
    expect(body[0]?.[15]).toBe('emailed');
    // The post's age as the skill measured it is kept.
    expect(body[0]?.[6]).toBe('4');
    // Left exactly as the file had them.
    expect(body).toContainEqual(odd);
    expect(body).toContainEqual(extra);
    expect(body).toContainEqual(repeat);
    expect(body).toContainEqual(badContact);
    expect(body.some((row) => row[2] === 'Blocked Co')).toBe(false);
  });

  it('merges the folder in first, so leads and runs the skill added since are kept', async () => {
    const skills = fields({ company: 'Added By Skill', source_url: 'https://news.example/post/9' });
    // Another browser saved here: its JSON lists a run this browser doesn't have.
    const theirs = backupFiles({ ...emptyData(), runs: [run('# From elsewhere\n', '2026-11-14.md', '2026-11-14T09:00:00.000Z')] });
    const json = theirs.find((file) => file.name === 'get-me-hired.json')!;
    const { folder, files } = memFolder(
      new Map([
        ['leads.csv', enc(csv(skills))],
        ['get-me-hired.json', json.data],
        ['runs/2026-11-14.md', enc('# From elsewhere\n')],
      ]),
    );
    const result = await writeFolder(folder, appData(), DAY);
    if (!result.ok) throw new Error(result.problem);
    expect(result.summary?.added).toBe(1);
    // Merged in, so the app writes it, rather than only leaving it as it was.
    expect(result.keptAsWritten).toBe(0);
    const written = JSON.parse(dec(files.get('get-me-hired.json')) ?? '{}') as { runs: { at: string; report_name: string }[] };
    expect(written.runs).toContainEqual(expect.objectContaining({ at: '2026-11-14T09:00:00.000Z', report_name: '2026-11-14.md' }));
    expect(result.incoming?.leads.map((lead) => lead.company)).toEqual(['Added By Skill']);
    expect(dec(files.get('leads.csv'))).toContain('Added By Skill');
    expect(dec(files.get('leads.csv'))).toContain(appData().leads[0]!.company);
  });

  it('copies the folder to a dated backup before the first save of the day, and only once', async () => {
    const before = enc(csv(fields({})));
    const { folder, files, log } = memFolder(new Map([['leads.csv', before], ['runs/2026-11-14.md', enc('# Old\n')]]));
    const first = await writeFolder(folder, appData(), DAY);
    if (!first.ok) throw new Error(first.problem);
    expect(first.backedUp).toBe(true);
    expect(files.get(`${BACKUP_FOLDER}/backups/${DAY}/leads.csv`)).toEqual(before);
    expect(dec(files.get(`${BACKUP_FOLDER}/backups/${DAY}/runs/2026-11-14.md`))).toBe('# Old\n');
    // Every backup file is written before any of the folder's own files.
    const firstOwn = log.findIndex((entry) => entry.startsWith('write ') && !entry.includes(BACKUP_FOLDER));
    const lastBackup = log.findLastIndex((entry) => entry.startsWith('write ') && entry.includes(BACKUP_FOLDER));
    expect(lastBackup).toBeLessThan(firstOwn);

    const second = await writeFolder(folder, { ...appData(), runs: [run('# New\n', '2026-11-15.md')] }, DAY);
    if (!second.ok) throw new Error(second.problem);
    expect(second.backedUp).toBe(false);
    expect(files.get(`${BACKUP_FOLDER}/backups/${DAY}/leads.csv`)).toEqual(before);
  });

  it('a save with nothing new writes nothing', async () => {
    const { folder, log } = memFolder(new Map());
    const data = appData();
    const first = await writeFolder(folder, data, DAY);
    if (!first.ok) throw new Error(first.problem);
    const writes = log.length;
    const again = await writeFolder(folder, data, DAY);
    if (!again.ok) throw new Error(again.problem);
    expect(again.wrote).toBe(0);
    expect(log.slice(writes)).toEqual([]);
  });

  it('a write that fails keeps the old file and writes nothing after it', async () => {
    const before = enc(csv(fields({})));
    const { folder, files, log } = memFolder(new Map([['leads.csv', before]]), { failOn: 'leads.csv' });
    const result = await writeFolder(folder, { ...appData(), runs: [run('# Ours\n', '2026-11-15.md')] }, DAY);
    expect(result).toMatchObject({ ok: false, problem: 'write-failed' });
    expect(files.get('leads.csv')).toEqual(before);
    expect(log).toContain('abort leads.csv');
    expect(files.has('get-me-hired.json')).toBe(false);
    expect(files.has('profile.md')).toBe(false);
  });

  it('a new file that fails is removed again, not left empty', async () => {
    const { folder, files } = memFolder(new Map(), { failOn: 'runs/2026-11-15.md' });
    const result = await writeFolder(folder, { ...appData(), runs: [run('# Ours\n', '2026-11-15.md')] }, DAY);
    expect(result).toMatchObject({ ok: false, problem: 'write-failed' });
    expect(files.has('runs/2026-11-15.md')).toBe(false);
    expect(files.has('leads.csv')).toBe(false);
  });

  it.each([
    ['a leads.csv with another header', 'leads.csv', 'name,email\nAda,ada@x.example\n', 'not-backup'],
    ['a damaged get-me-hired.json', 'get-me-hired.json', '{ not json', 'damaged'],
    ['a newer format', 'get-me-hired.json', JSON.stringify({ format_version: FORMAT_VERSION + 1 }), 'newer'],
  ])('never writes over %s', async (_, name, text, problem) => {
    const { folder, log, files } = memFolder(new Map([[name, enc(text)]]));
    const result = await writeFolder(folder, appData(), DAY);
    expect(result).toMatchObject({ ok: false, problem });
    expect(log).toEqual([]);
    expect(dec(files.get(name))).toBe(text);
  });
});
