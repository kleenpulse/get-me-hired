// A lead as a row of `leads.csv` (FRD §11.2), and back. The 17 columns hold
// what the agent skill reads. Everything else a lead has (emailed dates, status
// history, notes, hook links) travels in `get-me-hired.json` (§11.3).
//
// Reading a row is lenient, because the skill wrote some files before its
// format settled (§11.5): odd rows load, and say why they need review. Values
// that become links or `mailto:` addresses are checked here, at the seam.

import { isPlainEmail, isWebUrl } from './evidence';
import type { Contact, ContactLabel, Lead, LeadSource, Person } from './lead';
import { leadKey } from './lead-key';
import { joinList, LEAD_STATUSES, LEAD_TYPES, splitList, type ImportedLead, type LeadRow } from './leads-csv';
import { nextActionOn, type Cadence } from './lifecycle';
import { computeTier } from './ranking';

function contactText(contact: Contact): string {
  if (contact.method === 'email') return contact.value;
  if (contact.method === 'dm') return `DM: ${contact.value}`;
  return `${contact.method}: ${contact.value}`;
}

function confidenceText(contact: Contact): string {
  if (contact.method !== 'email') return 'method';
  if (contact.label === 'published') return `published (${contact.evidence ?? ''})`;
  if (contact.label === 'pattern') return `pattern (from ${contact.evidence ?? ''})`;
  return 'guess';
}

/** Hours from the post to the moment the lead was found, with one decimal, or ''. */
function ageHours(lead: Lead): string {
  const found = lead.statusHistory[0]?.at;
  if (!lead.postedAt || !found) return '';
  const hours = (Date.parse(found) - Date.parse(lead.postedAt)) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) return '';
  return `${lead.postedAtApprox ? '~' : ''}${hours.toFixed(1)}`;
}

/** One line per field: a line break inside a CSV value is legal, but no reader of these files expects one. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function leadToRow(lead: Lead, cadence?: Cadence): LeadRow {
  const contacts = lead.people.flatMap((person) => person.contacts);
  return {
    found_on: lead.foundOn,
    type: lead.type,
    company: oneLine(lead.company),
    company_url: lead.companyUrl,
    source_url: lead.sources[0]?.url ?? '',
    posted_at: lead.postedAt ? `${lead.postedAtApprox ? '~' : ''}${lead.postedAt}` : '',
    age_hours: ageHours(lead),
    likes: String(lead.likes),
    round: oneLine(lead.round),
    role: oneLine(lead.role),
    fit: oneLine(lead.fit),
    people: joinList(lead.people.map((person) => `${oneLine(person.name)} (${oneLine(person.role)})`)),
    contacts: joinList(contacts.map(contactText)),
    contact_confidence: joinList(contacts.map(confidenceText)),
    hooks: joinList(lead.hooks.map((hook) => oneLine(hook.text).replaceAll(';', ','))),
    status: lead.status,
    next_action_on: nextActionOn(lead, cadence) ?? '',
  };
}

function parsePerson(item: string): { name: string; role: string } {
  const match = item.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  return match ? { name: (match[1] ?? '').trim(), role: (match[2] ?? '').trim() } : { name: item.trim(), role: '' };
}

/** One contact from its text and its confidence, or `null` when it can't be used safely. */
function parseContact(text: string, confidence: string): Contact | null {
  const dm = text.match(/^DM:\s*(.+)$/i);
  if (dm) return { method: 'dm', value: (dm[1] ?? '').trim() };
  const linked = text.match(/^(form|apply):\s*(\S+)$/i);
  if (linked) {
    const url = linked[2] ?? '';
    return isWebUrl(url) ? { method: (linked[1] ?? '').toLowerCase() as 'form' | 'apply', value: url } : null;
  }
  // An address must be plain, so a `mailto:` link can never carry a subject or body (AC-6.5).
  if (!isPlainEmail(text)) return null;
  const published = confidence.match(/^published\s*\((.*)\)$/i);
  const pattern = confidence.match(/^pattern\s*\(from\s+(.*)\)$/i);
  let label: ContactLabel = 'guess';
  let evidence = '';
  if (published) {
    label = 'published';
    evidence = (published[1] ?? '').trim();
  } else if (pattern) {
    label = 'pattern';
    evidence = (pattern[1] ?? '').trim();
  }
  // "Published" needs a page to point at. Without one, it is not shown as checked.
  if (label === 'published' && !isWebUrl(evidence)) label = 'guess';
  return { method: 'email', value: text.toLowerCase(), label, ...(evidence && label !== 'guess' ? { evidence } : {}) };
}

function sourceKind(type: Lead['type'], url: string): LeadSource['kind'] {
  if (type === 'funding') return 'funding';
  return /(^|\.)news\.ycombinator\.com$/i.test(URL.canParse(url) ? new URL(url).host : '') ? 'community' : 'post';
}

/**
 * A lead from a row, for files with no `get-me-hired.json` beside them (the
 * skill writes only the CSV). Contacts are matched to people item for item
 * when the counts agree, and otherwise all go to the first person.
 */
export function rowToLead(imported: ImportedLead): Lead {
  const { row, needsReview } = imported;
  const type = (LEAD_TYPES as readonly string[]).includes(row.type) ? (row.type as Lead['type']) : 'post';
  const status = (LEAD_STATUSES as readonly string[]).includes(row.status) ? (row.status as Lead['status']) : 'new';
  const sourceUrl = isWebUrl(row.source_url) ? row.source_url : '';
  const approx = row.posted_at.startsWith('~');
  const posted = row.posted_at.replace(/^~/, '');
  const postedAt = Number.isNaN(Date.parse(posted)) ? null : new Date(posted).toISOString();
  const likes = /^\d+$/.test(row.likes) ? Number(row.likes) : row.likes === 'n/a' ? 'n/a' : 'unknown';

  const contactTexts = splitList(row.contacts);
  const confidences = splitList(row.contact_confidence);
  const contacts = contactTexts.flatMap((text, index) => parseContact(text, confidences[index] ?? 'guess') ?? []);
  const named = splitList(row.people).map(parsePerson);
  const people: Person[] = named.map((person, index) => ({
    ...person,
    contacts: named.length === contacts.length ? [contacts[index]].filter((c): c is Contact => !!c) : index === 0 ? contacts : [],
    emailedOn: [],
    followupsSent: [],
  }));
  if (people.length === 0 && contacts.length > 0) {
    people.push({ name: '', role: '', contacts, emailedOn: [], followupsSent: [] });
  }

  const base = { type, people, signals: [] as Lead['signals'] };
  const foundAt = /^\d{4}-\d{2}-\d{2}$/.test(row.found_on) ? `${row.found_on}T00:00:00.000Z` : new Date(0).toISOString();
  return {
    ...base,
    key: leadKey(sourceUrl || row.source_url, row.company),
    foundOn: row.found_on,
    company: row.company,
    companyUrl: isWebUrl(row.company_url) ? row.company_url : '',
    about: '',
    role: row.role,
    fit: row.fit,
    postedAt,
    postedAtApprox: approx,
    likes,
    round: row.round,
    location: '',
    hooks: sourceUrl ? splitList(row.hooks).map((text) => ({ text, url: sourceUrl })) : [],
    sources: sourceUrl ? [{ kind: sourceKind(type, sourceUrl), url: sourceUrl, seen: row.found_on }] : [],
    tier: computeTier(base),
    status,
    statusHistory: [{ status, at: foundAt }],
    snoozeUntil: status === 'not-now' && /^\d{4}-\d{2}-\d{2}$/.test(row.next_action_on) ? row.next_action_on : null,
    attention: null,
    // An odd row still loads, and says why it needs a look (FRD §11.2, lenient import).
    notes: needsReview.length > 0 ? `Needs review after import: ${needsReview.join(', ')}.` : '',
    sample: false,
  };
}
