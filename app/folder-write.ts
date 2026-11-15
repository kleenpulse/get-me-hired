// Saving to a linked folder (FR-9.3), the writing side. It runs only when the
// user clicks Save, and is built so the folder never loses anything:
//
// - The folder is read again and merged in first (mergeBackup's rules), so rows
//   the skill added since the last read are kept. A folder the app can't read
//   (a damaged or unknown file, or a newer format) is never written over.
// - A row the app can't hold in full (rowLosesData), a second row with the same
//   key, and every row of a lead the app doesn't have stay exactly as the file
//   has them. Only rows of leads on the do-not-contact list are taken out.
// - Before the first save of each day, the folder's files are copied to
//   .get-me-hired/backups/<date>/. After a save that made a new one, only the
//   14 newest complete day folders are kept (pruneBackups, the one place this
//   app deletes in the user's folder, held to exact names).
// - A report is never overwritten: one with the same name but other words is
//   saved under the next free name, <date>-2.md and so on.
// - The files are the export's files (backupFiles): no sample data, no keys.
// - Each file is written through createWritable, which changes the file only
//   when the new copy is complete. New reports go first and get-me-hired.json
//   last, so a failure partway leaves every file either old or new, never torn.

import { applyBlockList } from '@/core/block';
import { writeCsv } from '@/core/csv';
import { leadToRow, rowLosesData, rowToLead } from '@/core/lead-row';
import { LEADS_CSV_HEADER, parseLeadsCsv } from '@/core/leads-csv';
import { looksLikeProfileMd, readProfileMd } from '@/core/profile';
import type { ZipFile } from '@/core/zip';
import { backupFiles, mergeBackup, readBackupFiles, type ImportProblem, type Incoming, type MergeSummary } from './backup';
import type { AppData } from './data';
import type { Lead } from '@/core/lead';
import { collectFolderFiles, RUN_FILE, TOP_FILES, type FolderFile, type FolderHandle } from './folder';

/** The writing parts of the File System Access API, so tests can pass stand-ins. */
export interface Writable {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

export interface WritableFile extends FolderFile {
  createWritable(): Promise<Writable>;
}

export interface WritableFolder extends FolderHandle {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<WritableFile>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<WritableFolder>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
}

export const BACKUP_FOLDER = '.get-me-hired';
/** Written last into a day's backup, so a backup cut short is made again. */
const BACKUP_DONE = '.complete';
/** How many complete day folders of backups are kept. */
export const KEEP_BACKUPS = 14;
const BACKUP_DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface FolderPlan {
  /** The files to write, in the order they are written. */
  writes: ZipFile[];
  /** Rows left exactly as the file had them. */
  keptAsWritten: number;
  /** Rows taken out because the do-not-contact list blocks their lead. */
  blockedRows: number;
  /**
   * Rows left as they were that name a person or address the app's copy of the
   * lead no longer has, for example after deleting a person (FR-9.5).
   */
  heldPeople: number;
}

const decoder = new TextDecoder();
const encoder = new TextEncoder();
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((byte, index) => byte === b[index]);

/** The next report name not taken: 2026-11-15.md, then 2026-11-15-2.md, -3 and so on. */
function freeName(wanted: string, taken: ReadonlySet<string>): string {
  if (!taken.has(wanted)) return wanted;
  const day = wanted.slice(0, 10);
  for (let n = 2; ; n += 1) {
    const name = `${day}-${n}.md`;
    if (!taken.has(name)) return name;
  }
}

/** leads.csv for the folder: the app's rows, with the rows it can't hold left as they were. */
/** True when the row names someone, or an address, that the app's lead doesn't have. */
function namesOthers(row: Lead, ours: Lead): boolean {
  const names = new Set(ours.people.map((person) => person.name.trim().toLowerCase()));
  const values = new Set(ours.people.flatMap((person) => person.contacts.map((contact) => contact.value.trim().toLowerCase())));
  return row.people.some(
    (person) =>
      (person.name.trim() !== '' && !names.has(person.name.trim().toLowerCase())) ||
      person.contacts.some((contact) => !values.has(contact.value.trim().toLowerCase())),
  );
}

function mergedLeadsCsv(existing: string, data: AppData): { text: string; keptAsWritten: number; blockedRows: number; heldPeople: number } {
  const parsed = parseLeadsCsv(existing);
  // The caller has checked the file reads; an empty one has no rows to keep.
  const imported = parsed.ok ? parsed.leads : [];
  const mine = new Map(data.leads.filter((lead) => !lead.sample).map((lead) => [lead.key, lead]));
  const written = new Set<string>();
  const rows: string[][] = [];
  let keptAsWritten = 0;
  let blockedRows = 0;
  let heldPeople = 0;

  for (const row of imported) {
    const lead = rowToLead(row);
    if (applyBlockList(lead, data.doNotContact).kind === 'drop') {
      blockedRows += 1;
      continue;
    }
    const ours = mine.get(lead.key);
    if (ours && !written.has(lead.key) && !rowLosesData(row)) {
      written.add(lead.key);
      const line = leadToRow(ours, data.settings.cadence);
      // The skill measures a post's age when it finds it; the app can't always
      // work it out again from the day alone, and it never changes, so it stays.
      if (line.age_hours === '') line.age_hours = row.row.age_hours;
      rows.push(LEADS_CSV_HEADER.map((name) => line[name]));
      continue;
    }
    // Left as it is: the app can't hold it in full, it repeats a key, or the app doesn't have it.
    keptAsWritten += 1;
    if (ours && namesOthers(lead, ours)) heldPeople += 1;
    if (ours) written.add(lead.key);
    rows.push([...LEADS_CSV_HEADER.map((name) => row.row[name]), ...row.extraFields]);
  }
  for (const [key, lead] of mine) {
    if (written.has(key)) continue;
    const line = leadToRow(lead, data.settings.cadence);
    rows.push(LEADS_CSV_HEADER.map((name) => line[name]));
  }
  return { text: writeCsv([LEADS_CSV_HEADER, ...rows]), keptAsWritten, blockedRows, heldPeople };
}

/**
 * What to write, from the folder's files as they are and the merged data. Pure,
 * so every guard can be tested without a folder.
 */
export function planFolderWrite(existing: readonly ZipFile[], data: AppData): FolderPlan {
  const byName = new Map(existing.map((file) => [file.name, file.data]));
  const taken = new Set(existing.flatMap((file) => (file.name.startsWith('runs/') ? [file.name.slice(5)] : [])));
  const reports = new Map(existing.flatMap((file) => (file.name.startsWith('runs/') ? [[decoder.decode(file.data), file.name.slice(5)] as const] : [])));

  // Each report keeps the name of the folder's copy with the same words, or gets a free one.
  const newReports: ZipFile[] = [];
  const runs = data.runs.map((run) => {
    if (run.sample || !run.report || !run.reportName) return run;
    const there = reports.get(run.report);
    if (there) return { ...run, reportName: there };
    const name = freeName(RUN_FILE.test(run.reportName) ? run.reportName : `${run.date}.md`, taken);
    taken.add(name);
    reports.set(run.report, name);
    newReports.push({ name: `runs/${name}`, data: encoder.encode(run.report) });
    return { ...run, reportName: name };
  });

  const exported = backupFiles({ ...data, runs });
  const file = (name: string) => exported.find((entry) => entry.name === name);
  let keptAsWritten = 0;
  let blockedRows = 0;
  let heldPeople = 0;

  const writes: ZipFile[] = [...newReports];
  const leads = file('leads.csv');
  const oldLeads = byName.get('leads.csv');
  if (leads) {
    if (oldLeads) {
      const merged = mergedLeadsCsv(decoder.decode(oldLeads), data);
      keptAsWritten = merged.keptAsWritten;
      blockedRows = merged.blockedRows;
      heldPeople = merged.heldPeople;
      writes.push({ name: 'leads.csv', data: encoder.encode(merged.text) });
    } else {
      writes.push(leads);
    }
  }

  const profile = file('profile.md');
  const oldProfile = byName.get('profile.md');
  const oldText = oldProfile ? decoder.decode(oldProfile) : null;
  // A profile.md the app can't read is never written over. One that reads the
  // same is left alone too, so the skill's own layout stays.
  const keepProfile = oldText !== null && (!looksLikeProfileMd(oldText) || JSON.stringify(readProfileMd(oldText)) === JSON.stringify(data.profile));
  if (profile && !keepProfile) writes.push(profile);

  const extras = file('get-me-hired.json');
  if (extras) writes.push(extras);

  return {
    // A file whose bytes wouldn't change isn't written at all.
    writes: writes.filter((entry) => {
      const old = byName.get(entry.name);
      return !old || !same(old, entry.data);
    }),
    keptAsWritten,
    blockedRows,
    heldPeople,
  };
}

export type WriteProblem = ImportProblem | 'write-failed';

export type WriteResult =
  | {
      ok: true;
      /** What the folder held, to merge into this browser too. `null` for a folder with none of the skill's files. */
      incoming: Incoming | null;
      summary: MergeSummary | null;
      wrote: number;
      keptAsWritten: number;
      blockedRows: number;
      heldPeople: number;
      backedUp: boolean;
    }
  | { ok: false; problem: WriteProblem; incoming: Incoming | null };

async function exists(folder: WritableFolder, name: string, kind: 'file' | 'directory'): Promise<boolean> {
  try {
    await (kind === 'file' ? folder.getFileHandle(name) : folder.getDirectoryHandle(name));
    return true;
  } catch {
    return false;
  }
}

/** Writes one file through createWritable. A file this call created is removed again if the write fails. */
async function writeOne(folder: WritableFolder, path: string, data: Uint8Array): Promise<void> {
  const parts = path.split('/');
  const name = parts.pop() ?? path;
  let dir = folder;
  for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
  const isNew = !(await exists(dir, name, 'file'));
  const handle = await dir.getFileHandle(name, { create: true });
  let writable: Writable | null = null;
  try {
    writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
  } catch (error) {
    await writable?.abort().catch(() => {});
    if (isNew) await dir.removeEntry(name).catch(() => {});
    throw error;
  }
}

/** Copies the folder's files to .get-me-hired/backups/<day>/, once a day. False when today's copy was already there. */
async function backUp(folder: WritableFolder, files: readonly ZipFile[], day: string): Promise<boolean> {
  const backups = await (await folder.getDirectoryHandle(BACKUP_FOLDER, { create: true })).getDirectoryHandle('backups', { create: true });
  if ((await exists(backups, day, 'directory')) && (await exists(await backups.getDirectoryHandle(day), BACKUP_DONE, 'file'))) return false;
  for (const file of files) await writeOne(backups, `${day}/${file.name}`, file.data);
  await writeOne(backups, `${day}/${BACKUP_DONE}`, new Uint8Array());
  return true;
}

/**
 * Keeps the newest complete day folders of backups and deletes the older ones.
 * It deletes only folders directly inside .get-me-hired/backups/ that are named
 * like a day and hold the .complete marker this app writes; anything else there
 * is left alone. Returns the names it deleted.
 */
export async function pruneBackups(folder: WritableFolder, keep = KEEP_BACKUPS): Promise<string[]> {
  let backups: WritableFolder;
  try {
    backups = await (await folder.getDirectoryHandle(BACKUP_FOLDER)).getDirectoryHandle('backups');
  } catch {
    return [];
  }
  const complete: string[] = [];
  for await (const entry of backups.values()) {
    if (entry.kind !== 'directory' || !BACKUP_DAY.test(entry.name)) continue;
    if (await exists(await backups.getDirectoryHandle(entry.name), BACKUP_DONE, 'file')) complete.push(entry.name);
  }
  // Day names sort as dates, so the newest come first when sorted down.
  const old = complete.sort().reverse().slice(keep);
  const removed: string[] = [];
  for (const name of old) {
    try {
      await backups.removeEntry(name, { recursive: true });
      removed.push(name);
    } catch {
      // A folder that can't be removed stays; the save itself already succeeded.
    }
  }
  return removed;
}

/**
 * Saves the app's data to the folder: read, merge, back up, then write. Call it
 * only after the user clicked Save and the browser granted write access.
 */
export async function writeFolder(folder: WritableFolder, current: AppData, day: string): Promise<WriteResult> {
  const collected = await collectFolderFiles(folder);
  if (!collected.ok) return { ok: false, problem: collected.problem, incoming: null };

  let data = current;
  let incoming: Incoming | null = null;
  let summary: MergeSummary | null = null;
  if (collected.files.some((file) => (TOP_FILES as readonly string[]).includes(file.name))) {
    const read = readBackupFiles(collected.files);
    // Never write over files the app can't read: they would be lost.
    if (!read.ok) return { ok: false, problem: read.problem, incoming: null };
    const merged = mergeBackup(current, read.incoming, false);
    data = merged.data;
    incoming = read.incoming;
    summary = merged.summary;
  }

  const plan = planFolderWrite(collected.files, data);
  let backedUp = false;
  try {
    if (plan.writes.length > 0 && collected.files.length > 0) backedUp = await backUp(folder, collected.files, day);
    for (const file of plan.writes) await writeOne(folder, file.name, file.data);
  } catch {
    return { ok: false, problem: 'write-failed', incoming };
  }
  // Only after today's backup and the whole save succeeded.
  if (backedUp) await pruneBackups(folder).catch(() => []);
  return {
    ok: true,
    incoming,
    summary,
    wrote: plan.writes.length,
    keptAsWritten: plan.keptAsWritten,
    blockedRows: plan.blockedRows,
    heldPeople: plan.heldPeople,
    backedUp,
  };
}
