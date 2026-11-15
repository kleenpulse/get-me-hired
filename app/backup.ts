// Backup and restore (FR-9.2, AC-9.2): one ZIP of the agent skill's files.
//
//   profile.md          the profile (FR-3.5)
//   leads.csv           the 17 columns (FRD §11.2)
//   runs/<date>.md      each hunt's report (FR-8.1)
//   get-me-hired.json   everything the CSV can't hold (§11.3)
//
// Never in a backup: keys (they are stored apart, and this file never sees
// them), and sample leads or sample runs (FR-1.4).
//
// Importing reads only those exact paths and ignores everything else. Every
// address and link from the file is checked again before it is kept, because a
// backup is a file from outside, like any other.

import { isPlainEmail, isWebUrl } from '@/core/evidence';
import { DROP_REASONS } from '@/core/hunt';
import { SIGNALS, type Attention, type Contact, type Hook, type Lead, type LeadSource, type Person, type StatusChange } from '@/core/lead';
import { normaliseUrl } from '@/core/lead-key';
import { leadToRow, rowToLead } from '@/core/lead-row';
import { LEAD_STATUSES, parseLeadsCsv, writeLeadsCsv } from '@/core/leads-csv';
import type { Cadence } from '@/core/lifecycle';
import { looksLikeProfileMd, readProfileMd, writeProfileMd, type Profile } from '@/core/profile';
import { isProviderId } from '@/core/providers';
import { readZip, writeZip, ZipError, type Inflate, type ZipFile } from '@/core/zip';
import { FORMAT_VERSION, type AppData, type RunRecord } from './data';

export const APP_VERSION = '0.1.0';

const PROFILE_PATH = 'profile.md';
const LEADS_PATH = 'leads.csv';
const EXTRAS_PATH = 'get-me-hired.json';
const RUN_PATH = /^runs\/(\d{4}-\d{2}-\d{2}(?:-\d+)?\.md)$/;

/** The only paths a backup is read from. Everything else in the ZIP is skipped unread. */
function isBackupPath(name: string): boolean {
  return name === PROFILE_PATH || name === LEADS_PATH || name === EXTRAS_PATH || RUN_PATH.test(name);
}

/** The extras for one lead in `get-me-hired.json` (§11.3), with the app's other fields. */
interface LeadExtras {
  people: Person[];
  sources: LeadSource[];
  signals: string[];
  tier: string;
  status_history: StatusChange[];
  snooze_until: string | null;
  notes: string;
  about: string;
  location: string;
  hooks: Hook[];
  attention: Attention | null;
}

interface RunExtras {
  at: string;
  date: string;
  status: RunRecord['status'];
  kept: number;
  dropped: RunRecord['dropped'];
  provider: string | null;
  problem: string | null;
  report_name: string | null;
}

interface Extras {
  format_version: number;
  app_version: string;
  settings: { daily_target: number; cadence: Cadence };
  leads: Record<string, LeadExtras>;
  runs: RunExtras[];
  do_not_contact: string[];
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** The files of a backup. Sample leads and runs are left out (FR-1.4), and there is nothing about keys. */
export function backupFiles(data: AppData): ZipFile[] {
  const leads = data.leads.filter((lead) => !lead.sample);
  const runs = data.runs.filter((run) => !run.sample);
  const extras: Extras = {
    format_version: FORMAT_VERSION,
    app_version: APP_VERSION,
    settings: { daily_target: data.settings.dailyTarget, cadence: data.settings.cadence },
    leads: Object.fromEntries(
      leads.map((lead) => [
        lead.key,
        {
          people: lead.people,
          sources: lead.sources,
          signals: lead.signals,
          tier: lead.tier,
          status_history: lead.statusHistory,
          snooze_until: lead.snoozeUntil,
          notes: lead.notes,
          about: lead.about,
          location: lead.location,
          hooks: lead.hooks,
          attention: lead.attention,
        } satisfies LeadExtras,
      ]),
    ),
    runs: runs.map((run) => ({
      at: run.at,
      date: run.date,
      status: run.status,
      kept: run.kept,
      dropped: run.dropped,
      provider: run.provider ?? null,
      problem: run.problem ?? null,
      report_name: run.report && run.reportName ? run.reportName : null,
    })),
    do_not_contact: [],
  };

  const files: ZipFile[] = [];
  if (data.profile) files.push({ name: PROFILE_PATH, data: encoder.encode(writeProfileMd(data.profile)) });
  files.push({ name: LEADS_PATH, data: encoder.encode(writeLeadsCsv(leads.map((lead) => leadToRow(lead, data.settings.cadence)))) });
  for (const run of runs) {
    if (run.report && run.reportName) files.push({ name: `runs/${run.reportName}`, data: encoder.encode(run.report) });
  }
  files.push({ name: EXTRAS_PATH, data: encoder.encode(`${JSON.stringify(extras, null, 2)}\n`) });
  return files;
}

export function backupZip(data: AppData, now: Date): Uint8Array {
  return writeZip(backupFiles(data), now);
}

export function backupFileName(today: string): string {
  return `get-me-hired-backup-${today}.zip`;
}

/** Why a file couldn't be read as a backup (FRD §10.2). */
export type ImportProblem = 'not-zip' | 'not-backup' | 'newer' | 'damaged' | 'too-big' | 'unsupported';

export interface Incoming {
  profile: Profile | null;
  leads: Lead[];
  runs: RunRecord[];
  settings: { dailyTarget: number; cadence: Cadence } | null;
  /** Rows the lenient reader marked "Needs review". */
  needsReview: number;
}

export type ReadResult = { ok: true; incoming: Incoming } | { ok: false; problem: ImportProblem };

// Reading the JSON: every value is checked for its shape, and anything else is dropped.

const isString = (value: unknown): value is string => typeof value === 'string';
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isDay = (value: unknown): value is string => isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);

function readContact(value: unknown): Contact | null {
  if (!isObject(value) || !isString(value.value)) return null;
  if (value.method === 'email') {
    if (!isPlainEmail(value.value)) return null;
    const label = value.label === 'published' || value.label === 'pattern' || value.label === 'guess' ? value.label : 'guess';
    const evidence = isString(value.evidence) ? value.evidence : undefined;
    // "Published" must point at a page (AC-5.3). Without one, it isn't shown as checked.
    const safeLabel = label === 'published' && !(evidence && isWebUrl(evidence)) ? 'guess' : label;
    return { method: 'email', value: value.value, label: safeLabel, ...(evidence && safeLabel !== 'guess' ? { evidence } : {}) };
  }
  if (value.method === 'dm') return { method: 'dm', value: value.value };
  if ((value.method === 'form' || value.method === 'apply') && isWebUrl(value.value)) return { method: value.method, value: value.value };
  return null;
}

function readPerson(value: unknown): Person | null {
  if (!isObject(value) || !isString(value.name)) return null;
  return {
    name: value.name,
    role: isString(value.role) ? value.role : '',
    contacts: Array.isArray(value.contacts) ? value.contacts.flatMap((contact) => readContact(contact) ?? []) : [],
    emailedOn: Array.isArray(value.emailedOn) ? value.emailedOn.filter(isDay) : [],
    followupsSent: Array.isArray(value.followupsSent) ? value.followupsSent.filter(isDay) : [],
  };
}

function readSource(value: unknown): LeadSource | null {
  if (!isObject(value) || !isString(value.url) || !isWebUrl(value.url)) return null;
  const kind = value.kind === 'post' || value.kind === 'funding' || value.kind === 'community' ? value.kind : 'post';
  const readBy = isProviderId(value.readBy) ? value.readBy : undefined;
  return { kind, url: value.url, seen: isDay(value.seen) ? value.seen : '', ...(readBy ? { readBy } : {}) };
}

function readHistory(value: unknown): StatusChange | null {
  if (!isObject(value) || !isString(value.at) || Number.isNaN(Date.parse(value.at))) return null;
  return (LEAD_STATUSES as readonly unknown[]).includes(value.status) ? { status: value.status as Lead['status'], at: value.at } : null;
}

/** Lays the JSON extras over a lead read from its CSV row. The 17 columns stay as the CSV has them. */
function withExtras(lead: Lead, extras: unknown): Lead {
  if (!isObject(extras)) return lead;
  const people = Array.isArray(extras.people) ? extras.people.flatMap((person) => readPerson(person) ?? []) : lead.people;
  const sources = Array.isArray(extras.sources) ? extras.sources.flatMap((source) => readSource(source) ?? []) : lead.sources;
  const history = Array.isArray(extras.status_history) ? extras.status_history.flatMap((change) => readHistory(change) ?? []) : [];
  const hooks = Array.isArray(extras.hooks)
    ? extras.hooks.flatMap((hook) => (isObject(hook) && isString(hook.text) && isString(hook.url) && isWebUrl(hook.url) ? [{ text: hook.text, url: hook.url }] : []))
    : lead.hooks;
  const tier = extras.tier === 'A' || extras.tier === 'B' || extras.tier === 'C' ? extras.tier : lead.tier;
  return {
    ...lead,
    people,
    sources: sources.length > 0 ? sources : lead.sources,
    signals: Array.isArray(extras.signals) ? extras.signals.filter((signal): signal is Lead['signals'][number] => (SIGNALS as readonly unknown[]).includes(signal)) : lead.signals,
    tier,
    statusHistory: history.length > 0 ? history : lead.statusHistory,
    snoozeUntil: isDay(extras.snooze_until) ? extras.snooze_until : null,
    notes: isString(extras.notes) ? extras.notes : lead.notes,
    about: isString(extras.about) ? extras.about : lead.about,
    location: isString(extras.location) ? extras.location : lead.location,
    hooks,
    attention: extras.attention === 'new-signal' || extras.attention === 'back-from-not-now' ? extras.attention : null,
  };
}

function readRun(value: unknown, reports: Map<string, string>): RunRecord | null {
  if (!isObject(value) || !isString(value.at) || !isDay(value.date)) return null;
  const status = value.status === 'completed' || value.status === 'cancelled' || value.status === 'failed' ? value.status : null;
  if (!status) return null;
  const reportName = isString(value.report_name) ? value.report_name : null;
  const report = reportName ? reports.get(reportName) : undefined;
  const provider = isProviderId(value.provider) ? value.provider : null;
  return {
    at: value.at,
    date: value.date,
    status,
    kept: typeof value.kept === 'number' ? value.kept : 0,
    dropped: Array.isArray(value.dropped)
      ? value.dropped.flatMap((drop) =>
          // Only reasons the app knows, so a report can always name them (and nothing extra rides along).
          isObject(drop) && isString(drop.company) && isString(drop.sourceUrl) && (DROP_REASONS as readonly unknown[]).includes(drop.reason)
            ? [{ company: drop.company, reason: drop.reason as RunRecord['dropped'][number]['reason'], sourceUrl: drop.sourceUrl }]
            : [],
        )
      : [],
    sample: false,
    provider,
    ...(report && reportName ? { report, reportName } : {}),
  };
}

const isWholeIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

/**
 * Settings from a backup, only when every value is in the ranges the app
 * allows: FRD §8.2's delays of 3 to 10 working days, 0 to 3 follow-ups, and a
 * daily target of 1 to 100. Anything else is ignored, so the defaults stay. A
 * huge delay would make every follow-up date take minutes to work out, at every
 * open, which would leave the app stuck for good.
 */
function readSettings(value: unknown): Incoming['settings'] {
  if (!isObject(value) || !isObject(value.cadence)) return null;
  const { daily_target: dailyTarget } = value;
  const { followupDelays, closeAfter } = value.cadence;
  if (!isWholeIn(dailyTarget, 1, 100) || !isWholeIn(closeAfter, 3, 10)) return null;
  if (!Array.isArray(followupDelays) || followupDelays.length > 3) return null;
  if (!followupDelays.every((delay) => isWholeIn(delay, 3, 10))) return null;
  return { dailyTarget, cadence: { followupDelays: followupDelays as number[], closeAfter } };
}

/** Reads a backup ZIP. Only the exact paths above are read. Nothing is saved here. */
export async function readBackup(bytes: Uint8Array, inflate: Inflate): Promise<ReadResult> {
  let files: ZipFile[];
  try {
    files = await readZip(bytes, inflate, isBackupPath);
  } catch (error) {
    if (!(error instanceof ZipError)) return { ok: false, problem: 'damaged' };
    if (/not a ZIP/.test(error.message)) return { ok: false, problem: 'not-zip' };
    if (/too big|too many/.test(error.message)) return { ok: false, problem: 'too-big' };
    if (/compression/.test(error.message)) return { ok: false, problem: 'unsupported' };
    return { ok: false, problem: 'damaged' };
  }

  const text = (name: string) => {
    const file = files.find((entry) => entry.name === name);
    return file ? decoder.decode(file.data) : null;
  };
  const reports = new Map<string, string>();
  for (const file of files) {
    const match = file.name.match(RUN_PATH);
    if (match?.[1]) reports.set(match[1], decoder.decode(file.data));
  }

  const leadsText = text(LEADS_PATH);
  const profileText = text(PROFILE_PATH);
  const extrasText = text(EXTRAS_PATH);
  if (leadsText === null && profileText === null && extrasText === null) return { ok: false, problem: 'not-backup' };

  let extras: Record<string, unknown> = {};
  if (extrasText !== null) {
    try {
      const parsed: unknown = JSON.parse(extrasText);
      if (!isObject(parsed)) return { ok: false, problem: 'not-backup' };
      extras = parsed;
    } catch {
      return { ok: false, problem: 'damaged' };
    }
    const version = extras.format_version;
    if (typeof version !== 'number' || !Number.isInteger(version)) return { ok: false, problem: 'not-backup' };
    // A newer format is refused (FRD §11.4). Version 1 is the only one so far, so nothing needs migrating yet.
    if (version > FORMAT_VERSION) return { ok: false, problem: 'newer' };
  }

  let leads: Lead[] = [];
  let needsReview = 0;
  if (leadsText !== null) {
    const parsed = parseLeadsCsv(leadsText);
    if (!parsed.ok) {
      if (parsed.reason !== 'empty') return { ok: false, problem: 'not-backup' };
    } else {
      const leadExtras = isObject(extras.leads) ? extras.leads : {};
      leads = parsed.leads.map((imported) => {
        if (imported.needsReview.length > 0) needsReview += 1;
        const lead = rowToLead(imported);
        return withExtras(lead, leadExtras[lead.key]);
      });
    }
  }

  const listed = Array.isArray(extras.runs) ? extras.runs.flatMap((run) => readRun(run, reports) ?? []) : [];
  // Reports with no entry in the JSON (written by the skill) still come in, as completed runs.
  const named = new Set(listed.map((run) => run.reportName));
  const loose: RunRecord[] = [...reports.entries()]
    .filter(([name]) => !named.has(name))
    .map(([name, report]) => {
      const date = name.slice(0, 10);
      return { at: `${date}T00:00:00.000Z`, date, status: 'completed', kept: 0, dropped: [], sample: false, report, reportName: name };
    });

  return {
    ok: true,
    incoming: {
      profile: profileText !== null && looksLikeProfileMd(profileText) ? readProfileMd(profileText) : null,
      leads,
      runs: [...listed, ...loose].sort((a, b) => a.at.localeCompare(b.at)),
      settings: readSettings(extras.settings),
      needsReview,
    },
  };
}

export interface MergeSummary {
  added: number;
  /** Leads already here. This browser's status, marks and notes were kept. */
  alreadyHere: number;
  profile: 'added' | 'replaced' | 'kept' | 'none';
  runsAdded: number;
  needsReview: number;
}

/**
 * Brings a backup into the data already here, by lead key (FR-6.8). A lead in
 * both keeps this browser's status, emailed marks and notes, and only gains the
 * history entries and sources it didn't have, so nothing moves backwards. The
 * profile is replaced only when the user says so.
 */
export function mergeBackup(current: AppData, incoming: Incoming, replaceProfile: boolean): { data: AppData; summary: MergeSummary } {
  const byKey = new Map(current.leads.map((lead) => [lead.key, lead]));
  let added = 0;
  let alreadyHere = 0;
  for (const lead of incoming.leads) {
    const mine = byKey.get(lead.key);
    if (!mine) {
      byKey.set(lead.key, lead);
      added += 1;
      continue;
    }
    alreadyHere += 1;
    const seenHistory = new Set(mine.statusHistory.map((change) => `${change.status}|${change.at}`));
    const seenSources = new Set(mine.sources.map((source) => normaliseUrl(source.url)));
    byKey.set(lead.key, {
      ...mine,
      statusHistory: [...mine.statusHistory, ...lead.statusHistory.filter((change) => !seenHistory.has(`${change.status}|${change.at}`))].sort(
        (a, b) => a.at.localeCompare(b.at),
      ),
      sources: [...mine.sources, ...lead.sources.filter((source) => !seenSources.has(normaliseUrl(source.url)))],
    });
  }

  const knownRuns = new Set(current.runs.map((run) => run.at));
  const newRuns = incoming.runs.filter((run) => !knownRuns.has(run.at));
  const fresh = current.leads.length === 0 && current.profile === null && current.runs.length === 0;
  const profile =
    incoming.profile === null ? 'none' : current.profile === null ? 'added' : replaceProfile ? 'replaced' : 'kept';

  return {
    data: {
      ...current,
      profile: profile === 'added' || profile === 'replaced' ? incoming.profile : current.profile,
      leads: [...byKey.values()],
      runs: [...current.runs, ...newRuns].sort((a, b) => a.at.localeCompare(b.at)),
      // Settings come in only to a fresh browser, so a backup never quietly changes them.
      settings: fresh && incoming.settings ? { ...current.settings, ...incoming.settings } : current.settings,
    },
    summary: { added, alreadyHere, profile, runsAdded: newRuns.length, needsReview: incoming.needsReview },
  };
}

