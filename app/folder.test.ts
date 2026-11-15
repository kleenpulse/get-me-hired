import { describe, expect, it } from 'vitest';
import { emptyProfile } from '@/core/profile';
import { buildSampleFinds } from '@/core/sample-leads';
import { ZIP_LIMITS } from '@/core/zip';
import { backupFiles } from './backup';
import { emptyData, type AppData } from './data';
import { readFolder, type FolderHandle } from './folder';

const NOW = new Date('2026-11-15T12:00:00Z');

// Invented leads and an invented profile, as the skill would write them.
function folderData(): AppData {
  const leads = buildSampleFinds(NOW).community.map((lead) => ({ ...lead, sample: false }));
  return {
    ...emptyData(),
    leads,
    profile: { ...emptyProfile(), roles: ['Design engineer'], skills: ['React'], location: 'Lagos, Nigeria', floor: '$60k a year' },
    runs: [{ at: '2026-11-15T09:00:00.000Z', date: '2026-11-15', status: 'completed', kept: 1, dropped: [], sample: false, report: '# Hunt: 2026-11-15\n', reportName: '2026-11-15.md' }],
  };
}

/**
 * An in-memory folder. Every way to write (create, change, remove) throws and is
 * counted, so a test can prove reading never writes.
 */
function standInFolder(files: Record<string, Uint8Array>, writes: string[]): FolderHandle {
  const make = (prefix: string, name: string): FolderHandle => {
    const children = () => {
      const names = new Map<string, 'file' | 'directory'>();
      for (const path of Object.keys(files)) {
        if (!path.startsWith(prefix)) continue;
        const [first, ...rest] = path.slice(prefix.length).split('/');
        if (first) names.set(first, rest.length > 0 ? 'directory' : 'file');
      }
      return names;
    };
    const refuse = (what: string) => () => {
      writes.push(what);
      throw new Error(`write attempted: ${what}`);
    };
    return {
      name,
      async getFileHandle(child: string, options?: { create?: boolean }) {
        if (options?.create) refuse(`create ${prefix}${child}`)();
        const data = files[`${prefix}${child}`];
        if (!data) throw new DOMException('missing', 'NotFoundError');
        return {
          getFile: async () => ({ size: data.length, arrayBuffer: async () => data.slice().buffer }),
          createWritable: refuse(`write ${prefix}${child}`),
        } as unknown as Awaited<ReturnType<FolderHandle['getFileHandle']>>;
      },
      async getDirectoryHandle(child: string, options?: { create?: boolean }) {
        if (options?.create) refuse(`mkdir ${prefix}${child}`)();
        if (children().get(child) !== 'directory') throw new DOMException('missing', 'NotFoundError');
        return make(`${prefix}${child}/`, child);
      },
      removeEntry: refuse(`remove in ${prefix}`),
      async *values() {
        for (const [child, kind] of children()) yield { kind, name: child };
      },
    } as FolderHandle;
  };
  return make('', 'job-hunt');
}

const asFiles = (data: AppData) => Object.fromEntries(backupFiles(data).map((file) => [file.name, file.data]));

describe('reading a linked folder (FR-9.3)', () => {
  it("reads the skill's files through the same checks as a backup", async () => {
    const writes: string[] = [];
    const data = folderData();
    const result = await readFolder(standInFolder(asFiles(data), writes));
    if (!result.ok) throw new Error(result.problem);
    expect(result.incoming.leads.map((lead) => lead.key).sort()).toEqual(data.leads.map((lead) => lead.key).sort());
    expect(result.incoming.profile?.roles).toEqual(['Design engineer']);
    expect(result.incoming.runs.map((run) => run.reportName)).toEqual(['2026-11-15.md']);
  });

  it('never creates, changes or removes anything, and leaves every byte as it was (AC-9.4)', async () => {
    const writes: string[] = [];
    const files = asFiles(folderData());
    const before = Object.fromEntries(Object.entries(files).map(([name, data]) => [name, Array.from(data)]));
    await readFolder(standInFolder(files, writes));
    expect(writes).toEqual([]);
    expect(Object.fromEntries(Object.entries(files).map(([name, data]) => [name, Array.from(data)]))).toEqual(before);
  });

  it('reads only the exact paths the skill uses, and opens no other folder', async () => {
    const writes: string[] = [];
    const files = {
      ...asFiles(folderData()),
      'notes.txt': new TextEncoder().encode('not ours'),
      'runs/draft.md': new TextEncoder().encode('# not a report'),
      'runs/2026-11-15-2.md': new TextEncoder().encode('# Hunt: 2026-11-15\n'),
      'private/leads.csv': new TextEncoder().encode('company\nShould not be read\n'),
    };
    const result = await readFolder(standInFolder(files, writes));
    if (!result.ok) throw new Error(result.problem);
    expect(result.incoming.runs.map((run) => run.reportName).sort()).toEqual(['2026-11-15-2.md', '2026-11-15.md']);
    expect(JSON.stringify(result.incoming)).not.toContain('Should not be read');
  });

  it('says plainly when the folder has none of the skill’s files, or a file is too big', async () => {
    const empty = await readFolder(standInFolder({ 'notes.txt': new Uint8Array(3) }, []));
    expect(empty).toEqual({ ok: false, problem: 'not-backup' });
    const huge = await readFolder(standInFolder({ 'leads.csv': new Uint8Array(ZIP_LIMITS.entryBytes + 1) }, []));
    expect(huge).toEqual({ ok: false, problem: 'too-big' });
  });
});
