// Reads and writes `leads.csv`, the file shared with the agent skill (FRD §11.2).
//
// A row is kept as the 17 raw strings from the file. Nothing is rewritten on
// load, so a file written by the skill goes back out unchanged (AC-9.4).

import { parseCsv, writeCsv, type WriteCsvOptions } from './csv';

/** The exact header, in order. It changes only with a `format_version` bump (FRD §11.4). */
export const LEADS_CSV_HEADER = [
  'found_on',
  'type',
  'company',
  'company_url',
  'source_url',
  'posted_at',
  'age_hours',
  'likes',
  'round',
  'role',
  'fit',
  'people',
  'contacts',
  'contact_confidence',
  'hooks',
  'status',
  'next_action_on',
] as const;

export type LeadColumn = (typeof LEADS_CSV_HEADER)[number];
export type LeadRow = Record<LeadColumn, string>;

export const LEAD_TYPES = ['post', 'funding'] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

/** Every status in FRD §8.1. The skill writes a subset of these. */
export const LEAD_STATUSES = [
  'new',
  'emailed',
  'replied',
  'call',
  'offer',
  'not-now',
  'no-reply',
  'rejected',
  'skip',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Why a row is marked "Needs review" on import. The row still loads. */
export type ReviewReason =
  /** The row has more or fewer than 17 fields. */
  | 'field-count'
  /** `contacts` and `contact_confidence` have different lengths, as older skill versions wrote them. */
  | 'contact-lists'
  | 'unknown-type'
  | 'unknown-status';

export interface ImportedLead {
  row: LeadRow;
  /** Empty when the row is fine. */
  needsReview: ReviewReason[];
  /** 1-based row number in the file, counting the header as row 1. */
  rowNumber: number;
  /** Fields past the 17th, kept so nothing from the file is lost. */
  extraFields: string[];
}

export type LeadsCsvResult =
  | { ok: true; leads: ImportedLead[] }
  | { ok: false; reason: 'empty' | 'wrong-header'; found: string[] };

const LIST_SEPARATOR = '; ';

/** Splits a list field. Reads `;` with or without the space, because older files vary. */
export function splitList(field: string): string[] {
  return field
    .split(';')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

/** Joins list items with `; ` (FRD §11.2). */
export function joinList(items: readonly string[]): string {
  return items.join(LIST_SEPARATOR);
}

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

function reviewRow(row: LeadRow, fieldCount: number): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  if (fieldCount !== LEADS_CSV_HEADER.length) reasons.push('field-count');
  if (splitList(row.contacts).length !== splitList(row.contact_confidence).length) reasons.push('contact-lists');
  if (!isOneOf(LEAD_TYPES, row.type)) reasons.push('unknown-type');
  if (!isOneOf(LEAD_STATUSES, row.status)) reasons.push('unknown-status');
  return reasons;
}

/**
 * Reads `leads.csv`. The header must match exactly (spaces around names are
 * allowed). Rows are read leniently: a short row is padded with empty fields,
 * and anything odd is marked for review instead of being dropped.
 */
export function parseLeadsCsv(text: string): LeadsCsvResult {
  const [header, ...records] = parseCsv(text);
  if (!header) return { ok: false, reason: 'empty', found: [] };

  const found = header.map((name) => name.trim());
  const headerMatches =
    found.length === LEADS_CSV_HEADER.length && LEADS_CSV_HEADER.every((name, index) => found[index] === name);
  if (!headerMatches) return { ok: false, reason: 'wrong-header', found };

  const leads = records.map((fields, index): ImportedLead => {
    const row = Object.fromEntries(LEADS_CSV_HEADER.map((name, column) => [name, fields[column] ?? ''])) as LeadRow;
    return {
      row,
      needsReview: reviewRow(row, fields.length),
      rowNumber: index + 2,
      extraFields: fields.slice(LEADS_CSV_HEADER.length),
    };
  });

  return { ok: true, leads };
}

/** Writes `leads.csv` with the exact header and the 17 columns in order. */
export function writeLeadsCsv(rows: readonly LeadRow[], options?: WriteCsvOptions): string {
  return writeCsv(
    [LEADS_CSV_HEADER, ...rows.map((row) => LEADS_CSV_HEADER.map((name) => row[name]))],
    options,
  );
}
