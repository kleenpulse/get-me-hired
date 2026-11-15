// The do-not-contact list (FR-5.7): people, addresses and whole domains the
// user never wants to see again, in any run, saved leads included. It is kept
// until the user removes an entry (FRD §13.2).
//
//   domain   drops every lead whose own company domain is on it, subdomains
//            too (AC-5.7), and takes any address on it off other leads. A
//            company's domain is its site, or, with no site, the one mail
//            domain all its addresses share. One stray address never removes
//            a whole company. Shared hosts (gmail.com, news.ycombinator.com)
//            can't be blocked as domains: that would hit everyone on them.
//   email    takes that address off every lead
//   person   takes that person off every lead at one company. A name alone is
//            too loose (two people share names), so a person is always blocked
//            at a company: its name, or its domain.

import { isPlainEmail } from './evidence';
import type { Lead } from './lead';

export type BlockEntry =
  | { kind: 'email'; value: string; addedOn: string }
  | { kind: 'domain'; value: string; addedOn: string }
  /** `at` is the company's domain when it has one, else its name, in lower case. */
  | { kind: 'person'; value: string; at: string; addedOn: string };

const PERSON_PREFIX = 'person: ';
const AT = ' | ';
const DOMAIN = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

/** Lower case, and without a scheme, a leading "@" or "www.", a path or a trailing dot. */
export function bareDomain(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^@/, '')
    .replace(/^www\./, '')
    .replace(/[/?#:].*$/, '')
    .replace(/\.$/, '');
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Hosts many unrelated people share. Blocking one as a domain would remove
 * every lead with a contact there, so they can only be blocked address by address.
 */
export const SHARED_DOMAINS: readonly string[] = [
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'gmx.de',
  'aol.com',
  'zoho.com',
  'yandex.com',
  'mail.com',
  'ymail.com',
  'rocketmail.com',
  'fastmail.com',
  'fastmail.fm',
  'hey.com',
  'duck.com',
  'pm.me',
  'tutanota.com',
  'tuta.io',
  'gmx.net',
  'web.de',
  'mail.ru',
  'qq.com',
  '163.com',
  '126.com',
  'naver.com',
  'news.ycombinator.com',
  'ycombinator.com',
  'linkedin.com',
  'x.com',
  'twitter.com',
  'github.com',
  'medium.com',
  'substack.com',
  'notion.site',
  'google.com',
  'docs.google.com',
];

/** Free-mail brands that run a host per country: yahoo.co.uk, hotmail.fr, outlook.de, live.ca and so on. */
const SHARED_BRANDS = /^(?:yahoo|hotmail|outlook|live|gmx|aol|yandex)\.[a-z]{2,3}(?:\.[a-z]{2})?$/;

export function isSharedDomain(domain: string): boolean {
  const bare = bareDomain(domain);
  return SHARED_BRANDS.test(bare) || SHARED_DOMAINS.some((shared) => bare === shared || bare.endsWith(`.${shared}`));
}

export type TypedEntry = { ok: true; entry: BlockEntry } | { ok: false; reason: 'invalid' | 'shared' };

/** What the user typed on the Data screen: an address or a domain. People are blocked from a lead. */
export function readTypedEntry(text: string, addedOn: string): TypedEntry {
  const value = oneLine(text);
  if (value.includes('@') && !value.startsWith('@')) {
    return isPlainEmail(value) ? { ok: true, entry: { kind: 'email', value: value.toLowerCase(), addedOn } } : { ok: false, reason: 'invalid' };
  }
  const domain = bareDomain(value);
  if (!DOMAIN.test(domain)) return { ok: false, reason: 'invalid' };
  if (isSharedDomain(domain)) return { ok: false, reason: 'shared' };
  return { ok: true, entry: { kind: 'domain', value: domain, addedOn } };
}

/** Where a lead's people work, for a person block: its domain when known, else its name. */
export function companyScope(lead: Pick<Lead, 'company' | 'companyUrl'>): string {
  const host = URL.canParse(lead.companyUrl) ? bareDomain(new URL(lead.companyUrl).host) : '';
  return DOMAIN.test(host) ? host : oneLine(lead.company).toLowerCase();
}

/** A person block for someone on a lead. */
export function personEntry(name: string, lead: Pick<Lead, 'company' | 'companyUrl'>, addedOn: string): BlockEntry | null {
  const value = oneLine(name).toLowerCase();
  const at = companyScope(lead);
  return value.length >= 2 && at ? { kind: 'person', value, at, addedOn } : null;
}

/** An entry as one line of the backup's `do_not_contact` list (FRD §11.3). */
export function blockEntryText(entry: BlockEntry): string {
  return entry.kind === 'person' ? `${PERSON_PREFIX}${entry.value}${AT}${entry.at}` : entry.value;
}

/** Reads one line of a backup's list back. Anything that isn't a valid entry is `null`. */
export function readBlockLine(line: unknown, addedOn: string): BlockEntry | null {
  if (typeof line !== 'string') return null;
  const text = oneLine(line);
  if (text.toLowerCase().startsWith(PERSON_PREFIX)) {
    const [name = '', at = ''] = text.slice(PERSON_PREFIX.length).split(AT);
    const value = oneLine(name).toLowerCase();
    const scope = oneLine(at).toLowerCase();
    return value.length >= 2 && scope.length >= 2 ? { kind: 'person', value, at: scope, addedOn } : null;
  }
  const typed = readTypedEntry(text, addedOn);
  return typed.ok ? typed.entry : null;
}

export function sameEntry(a: BlockEntry, b: BlockEntry): boolean {
  return a.kind === b.kind && a.value === b.value && (a.kind !== 'person' || (b.kind === 'person' && a.at === b.at));
}

/** True when `host` is `domain` or one of its subdomains. `notacme.example` is not on `acme.example`. */
export function onDomain(host: string, domain: string): boolean {
  const bare = bareDomain(host);
  return bare === domain || bare.endsWith(`.${domain}`);
}

function mailDomain(address: string): string {
  return bareDomain(address.split('@')[1] ?? '');
}

/**
 * The company's own domain: its site, or, with no site, the one mail domain
 * every address on the lead shares (and not a shared host). `null` when unsure.
 */
export function companyDomain(lead: Lead): string | null {
  const site = URL.canParse(lead.companyUrl) ? bareDomain(new URL(lead.companyUrl).host) : '';
  if (DOMAIN.test(site) && !isSharedDomain(site)) return site;
  const mail = new Set(
    lead.people.flatMap((person) => person.contacts.filter((contact) => contact.method === 'email').map((contact) => mailDomain(contact.value))),
  );
  const [only] = [...mail];
  return mail.size === 1 && only && !isSharedDomain(only) ? only : null;
}

export type Blocked = { kind: 'drop' } | { kind: 'keep'; lead: Lead };

/**
 * Applies the list to one lead. A blocked domain drops it. Otherwise blocked
 * addresses and people are taken off, and the lead stays: the company itself
 * wasn't blocked. A lead left with nobody shows "Nobody found to write to yet."
 */
export function applyBlockList(lead: Lead, list: readonly BlockEntry[]): Blocked {
  if (list.length === 0) return { kind: 'keep', lead };
  const domains = list.flatMap((entry) => (entry.kind === 'domain' ? [entry.value] : []));
  const own = companyDomain(lead);
  if (own && domains.some((domain) => onDomain(own, domain))) return { kind: 'drop' };

  const emails = new Set(list.flatMap((entry) => (entry.kind === 'email' ? [entry.value] : [])));
  const scope = companyScope(lead);
  const company = oneLine(lead.company).toLowerCase();
  const names = new Set(
    list.flatMap((entry) => (entry.kind === 'person' && (entry.at === scope || entry.at === company || onDomain(scope, entry.at)) ? [entry.value] : [])),
  );

  let changed = false;
  const people = lead.people.flatMap((person) => {
    if (names.has(oneLine(person.name).toLowerCase())) {
      changed = true;
      return [];
    }
    // A blocked address, or any address on a blocked domain, comes off. The lead stays.
    const contacts = person.contacts.filter(
      (contact) =>
        !(contact.method === 'email' && (emails.has(contact.value.toLowerCase()) || domains.some((domain) => onDomain(mailDomain(contact.value), domain)))),
    );
    if (contacts.length !== person.contacts.length) changed = true;
    return [{ ...person, contacts }];
  });
  return { kind: 'keep', lead: changed ? { ...lead, people } : lead };
}
