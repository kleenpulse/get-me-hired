// A linked folder (FR-9.3), the reading side. In Chrome and Edge the user can
// link the folder the get-me-hired agent skill writes to, and the app reads its
// profile.md, leads.csv, get-me-hired.json and runs/ through the same checks as
// a backup import (backup.ts), then merges them the same way.
//
// Nothing in this file writes, so opening a folder leaves its files exactly as
// they are (AC-9.4). Saving to the folder is in folder-write.ts, and runs only
// when the user clicks Save.
//
// Only the exact paths the skill uses are read, and no other subfolder is
// opened. Files are capped like ZIP entries are.

import { ZIP_LIMITS, type ZipFile } from '@/core/zip';
import type { ReadResult } from './backup';

/** The parts of the File System Access API used here, so tests can pass stand-ins. */
export interface FolderFile {
  getFile(): Promise<{ size: number; arrayBuffer(): Promise<ArrayBuffer> }>;
}

export interface FolderHandle {
  readonly name: string;
  getFileHandle(name: string): Promise<FolderFile>;
  getDirectoryHandle(name: string): Promise<FolderHandle>;
  values(): AsyncIterable<{ kind: 'file' | 'directory'; name: string }>;
}

export type FolderAccess = 'granted' | 'prompt' | 'denied';
export type FolderMode = 'read' | 'readwrite';

/** A linked folder's handle as the browser gives it, with the permission calls TypeScript doesn't know yet. */
export interface LinkedFolder extends FolderHandle {
  queryPermission(options: { mode: FolderMode }): Promise<FolderAccess>;
  requestPermission(options: { mode: FolderMode }): Promise<FolderAccess>;
}

export const TOP_FILES = ['profile.md', 'leads.csv', 'get-me-hired.json'] as const;
export const RUN_FILE = /^\d{4}-\d{2}-\d{2}(?:-\d+)?\.md$/;
/**
 * How many entries of runs/ are looked at in all, reports or not, before the
 * folder counts as too big. Reports alone are capped at `ZIP_LIMITS.entries`.
 */
export const RUNS_SCAN_LIMIT = ZIP_LIMITS.entries * 10;

/** True in browsers that can link a folder (Chrome and Edge today). */
export function canLinkFolder(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/** Asks the user to pick the folder, for reading only. Must run from a click. */
export async function pickFolder(): Promise<LinkedFolder> {
  const picker = (window as unknown as { showDirectoryPicker(options: { id: string; mode: 'read' }): Promise<LinkedFolder> }).showDirectoryPicker;
  return picker({ id: 'get-me-hired', mode: 'read' });
}

function isMissing(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'TypeMismatchError');
}

/** One file's bytes, or `null` when it isn't there. Throws a size problem past the cap. */
async function readOne(handle: Promise<FolderFile>): Promise<Uint8Array | null> {
  let file: Awaited<ReturnType<FolderFile['getFile']>>;
  try {
    file = await (await handle).getFile();
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  if (file.size > ZIP_LIMITS.entryBytes) throw new FolderTooBig();
  return new Uint8Array(await file.arrayBuffer());
}

class FolderTooBig extends Error {}

export type Collected = { ok: true; files: ZipFile[] } | { ok: false; problem: 'too-big' | 'damaged' };

/** The skill's files in a folder, as they are, before any checks. It never creates, changes or removes anything. */
export async function collectFolderFiles(folder: FolderHandle): Promise<Collected> {
  const files: ZipFile[] = [];
  let total = 0;
  const add = (name: string, data: Uint8Array | null) => {
    if (!data) return;
    total += data.length;
    if (total > ZIP_LIMITS.totalBytes) throw new FolderTooBig();
    files.push({ name, data });
  };
  try {
    for (const name of TOP_FILES) add(name, await readOne(folder.getFileHandle(name)));

    let runs: FolderHandle | null = null;
    try {
      runs = await folder.getDirectoryHandle('runs');
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    if (runs) {
      let count = 0;
      let seen = 0;
      for await (const entry of runs.values()) {
        // Every entry counts toward a looser cap, so a huge folder isn't walked to the end.
        seen += 1;
        if (seen > RUNS_SCAN_LIMIT) throw new FolderTooBig();
        // Only report files named like the skill names them. Nothing deeper is opened.
        if (entry.kind !== 'file' || !RUN_FILE.test(entry.name)) continue;
        count += 1;
        if (count > ZIP_LIMITS.entries) throw new FolderTooBig();
        add(`runs/${entry.name}`, await readOne(runs.getFileHandle(entry.name)));
      }
    }
  } catch (error) {
    if (error instanceof FolderTooBig) return { ok: false, problem: 'too-big' };
    return { ok: false, problem: 'damaged' };
  }
  return { ok: true, files };
}

/** Reads the skill's files from a folder. It never creates, changes or removes anything. */
export async function readFolder(folder: FolderHandle): Promise<ReadResult> {
  const collected = await collectFolderFiles(folder);
  if (!collected.ok) return collected;
  // Loaded only when a folder is read, like the backup reader on import.
  const { readBackupFiles } = await import('./backup');
  return readBackupFiles(collected.files);
}
