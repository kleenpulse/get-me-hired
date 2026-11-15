// "Delete a person" (FR-9.5, AC-9.5): takes one person's name and addresses out
// of everything the app stores, and keeps the company lead.
//
// - The lead loses the person. A hook, the about line or the fit line that names
//   them or holds one of their addresses is dropped, not edited: those were
//   copied from a page, and a half-edited quote would misquote it.
// - Saved run reports can't be written again (their inputs aren't kept), so their
//   text is cleaned. Only lines the report writer made for this lead change: its
//   contact line for the person becomes "(removed)", and a hook or fit line that
//   names them goes. Their addresses are taken out of every line. A name is never
//   replaced blindly, so "Ana" leaves "Banana" and other leads alone.
// - A name that is also the company's (an HN poster named "quillstack" at
//   Quillstack) is matched only by the person's addresses, so the company's own
//   facts stay.
// - The user's own notes stay as written. The screen says they may still mention
//   the person.

import { companyDomain } from '@/core/block';
import type { Hook, Lead, Person } from '@/core/lead';
import type { AppData, RunRecord } from './data';
import { strings } from './strings';

const r = strings.report;
const CONTACT = '- Contact: ';
const HOOK = '- Hook: ';
const FIT = '- Fit: ';

/** One line, as the report writer prints every value (`one` in run-report.ts). */
function one(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Lower case, accents and extra spaces taken off, for comparing names. */
function fold(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const WORD = /[\p{L}\p{N}]/u;

/**
 * True when `text` holds the whole name: "Ana Lima" is in "Thanks, Ana Lima!",
 * but "Ana" is not in "Banana". Case and accents don't matter.
 */
export function namesPerson(text: string, name: string): boolean {
  const wanted = fold(name);
  if (wanted.length < 2) return false;
  const haystack = fold(text);
  for (let at = haystack.indexOf(wanted); at !== -1; at = haystack.indexOf(wanted, at + 1)) {
    const before = haystack[at - 1];
    const after = haystack[at + wanted.length];
    if ((!before || !WORD.test(before)) && (!after || !WORD.test(after))) return true;
  }
  return false;
}

/**
 * True when the name can't be told apart from the company: Hacker News names a
 * poster by their username, and a company often posts as itself ("quillstack" at
 * Quillstack). Matching that name would delete the company's own facts, so then
 * only the person's exact addresses are matched in the text.
 */
export function nameIsCompany(name: string, lead: Lead): boolean {
  const wanted = fold(name);
  if (wanted.length < 2) return false;
  const company = fold(lead.company);
  const domain = companyDomain(lead);
  // Every label of the domain but the last: "quillstack" from quillstack.example.
  const labels = domain ? domain.split('.').slice(0, -1) : [];
  return wanted === company || company.split(/[^\p{L}\p{N}]+/u).includes(wanted) || labels.includes(wanted);
}

/** The person's email addresses, in lower case. */
function addressesOf(person: Person): string[] {
  return person.contacts
    .filter((contact) => contact.method === 'email')
    .map((contact) => one(contact.value).toLowerCase())
    .filter((value) => value.length > 0);
}

function holdsAddress(text: string, addresses: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return addresses.some((address) => lower.includes(address));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function withoutAddresses(line: string, addresses: readonly string[]): string {
  return addresses.reduce((text, address) => text.replace(new RegExp(escapeRegExp(address), 'gi'), r.removed), line);
}

/** The lead without the person, and the hooks that went with them. */
export function erasePerson(lead: Lead, index: number): { lead: Lead; droppedHooks: Hook[] } {
  const person = lead.people[index];
  if (!person) return { lead, droppedHooks: [] };
  const addresses = addressesOf(person);
  const byName = !nameIsCompany(person.name, lead);
  const names = (text: string) => (byName && namesPerson(text, person.name)) || holdsAddress(text, addresses);
  const droppedHooks = lead.hooks.filter((hook) => names(hook.text));
  return {
    lead: {
      ...lead,
      people: lead.people.filter((_, at) => at !== index),
      hooks: lead.hooks.filter((hook) => !droppedHooks.includes(hook)),
      about: names(lead.about) ? '' : lead.about,
      fit: names(lead.fit) ? '' : lead.fit,
    },
    droppedHooks,
  };
}

/** A run report with the person taken out of the lead's entry, and their addresses out of every line. */
export function scrubReport(report: string, lead: Lead, person: Person, droppedHooks: readonly Hook[]): string {
  const addresses = addressesOf(person);
  const heading = `### ${one(lead.company)}: `;
  const hookLines = new Set(droppedHooks.map((hook) => r.hook(one(hook.text), one(hook.url))));
  const byName = !nameIsCompany(person.name, lead);
  const names = (text: string) => byName && namesPerson(text, person.name);
  const out: string[] = [];
  let inEntry = false;

  for (const line of report.split('\n')) {
    // An entry is a "### Company: …" heading and the lines under it, up to a blank line.
    if (line.startsWith('#') || line.trim() === '') inEntry = line.startsWith(heading);
    if (inEntry && line.startsWith(CONTACT)) {
      const shown = line.slice(CONTACT.length).split(' (')[0] ?? '';
      if (fold(shown) === fold(person.name) || holdsAddress(line, addresses)) {
        // One "(removed)" line for the person, however many addresses they had.
        if (out.at(-1) !== r.contactRemoved) out.push(r.contactRemoved);
        continue;
      }
    }
    if (inEntry && line.startsWith(HOOK) && (hookLines.has(line) || names(line))) continue;
    if (inEntry && line.startsWith(FIT) && names(line)) {
      out.push(r.fit(r.removed));
      continue;
    }
    out.push(withoutAddresses(line, addresses));
  }
  return out.join('\n');
}

/**
 * The data with one person deleted (FR-9.5). `name` guards against a stale
 * index: when the person at `index` isn't `name`, nothing changes and the
 * result is `null`.
 */
export function deletePerson(data: AppData, key: string, index: number, name: string): AppData | null {
  const lead = data.leads.find((entry) => entry.key === key);
  const person = lead?.people[index];
  if (!lead || !person || person.name !== name) return null;
  const erased = erasePerson(lead, index);
  const runs = data.runs.map((run): RunRecord =>
    run.report ? { ...run, report: scrubReport(run.report, lead, person, erased.droppedHooks) } : run,
  );
  return {
    ...data,
    leads: data.leads.map((entry) => (entry.key === key ? erased.lead : entry)),
    runs,
  };
}
