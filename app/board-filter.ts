// Search and filter on the Board (FR-6.6): by status, type, field, location,
// date and label.
//
// "Domain" in this FRD means a field, like "fintech" or "AI dev tools" (FR-3.3's
// preferred domains), not a web address. Leads don't store a field, so the search
// reads the about line, and the field filter shows the leads whose opening was
// checked and mentions none of the profile's fields (the outside-domains signal,
// set in code by the Hacker News stage). There's no "in my fields" choice: a lead
// without the signal may simply never have been checked (FRD §4 principle 2).
// The search also reads the company's web address and its sources, as a bonus.
//
// The filter is kept in memory only: it isn't saved, and a reload clears it.

import { daysBetween } from '@/core/dates';
import { emailContacts, type ContactLabel, type Lead, type LeadStatus } from '@/core/lead';
import { newGroupOf } from '@/core/ranking';

export type TypeFilter = 'any' | 'post' | 'funding' | 'community';
/** `out`: checked, and mentions none of the profile's fields. */
export type FieldFilter = 'any' | 'out';
/** The best address a lead has: published, then pattern, then guess, or none. */
export type LabelFilter = 'any' | ContactLabel | 'none';
export type FoundFilter = 'any' | '7' | '30';

export interface BoardFilter {
  text: string;
  type: TypeFilter;
  fields: FieldFilter;
  label: LabelFilter;
  found: FoundFilter;
  /** The status columns shown. `null` shows every column. */
  statuses: readonly LeadStatus[] | null;
}

export const NO_FILTER: BoardFilter = { text: '', type: 'any', fields: 'any', label: 'any', found: 'any', statuses: null };

export function isFiltering(filter: BoardFilter): boolean {
  return (
    filter.text.trim() !== '' ||
    filter.type !== 'any' ||
    filter.fields !== 'any' ||
    filter.label !== 'any' ||
    filter.found !== 'any' ||
    filter.statuses !== null
  );
}

/** Lower case, accents off, one space between words. */
function fold(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function host(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** What the search reads on a lead. */
function searchable(lead: Lead): string {
  return fold([lead.company, lead.role, lead.location, lead.about, host(lead.companyUrl), ...lead.sources.map((source) => host(source.url))].join(' '));
}

function bestLabel(lead: Lead): ContactLabel | 'none' {
  const labels = new Set(emailContacts(lead).map((contact) => contact.label ?? 'guess'));
  return labels.has('published') ? 'published' : labels.has('pattern') ? 'pattern' : labels.has('guess') ? 'guess' : 'none';
}

function typeOf(lead: Lead): Exclude<TypeFilter, 'any'> {
  if (lead.type === 'funding') return 'funding';
  return newGroupOf(lead) === 'community' ? 'community' : 'post';
}

/** The leads that pass the filter on `today`. Every word of the search must be found. */
export function filterLeads(leads: readonly Lead[], filter: BoardFilter, today: string): Lead[] {
  const words = fold(filter.text).split(' ').filter(Boolean);
  return leads.filter((lead) => {
    if (filter.statuses && !filter.statuses.includes(lead.status)) return false;
    if (filter.type !== 'any' && typeOf(lead) !== filter.type) return false;
    if (filter.fields === 'out' && !lead.signals.includes('outside-domains')) return false;
    if (filter.label !== 'any' && bestLabel(lead) !== filter.label) return false;
    if (filter.found !== 'any' && daysBetween(lead.foundOn, today) > Number(filter.found)) return false;
    if (words.length > 0) {
      const text = searchable(lead);
      if (!words.every((word) => text.includes(word))) return false;
    }
    return true;
  });
}
