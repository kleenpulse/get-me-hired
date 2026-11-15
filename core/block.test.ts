import { describe, expect, it } from 'vitest';
import {
  applyBlockList,
  blockEntryText,
  companyDomain,
  onDomain,
  personEntry,
  readBlockLine,
  readTypedEntry,
  type BlockEntry,
} from './block';
import type { Lead, Person } from './lead';

const DAY = '2026-11-15';

const person = (name: string, ...emails: string[]): Person => ({
  name,
  role: 'Founder',
  contacts: emails.map((value) => ({ method: 'email', value, label: 'published', evidence: 'https://acme.example/team' })),
  emailedOn: [],
  followupsSent: [],
});

// Invented companies and people.
function lead(company: string, companyUrl: string, people: Person[]): Lead {
  return {
    key: `${companyUrl}|${company.toLowerCase()}`,
    foundOn: DAY,
    type: 'post',
    company,
    companyUrl,
    about: '',
    role: 'Engineer',
    fit: '',
    postedAt: null,
    postedAtApprox: false,
    likes: 'n/a',
    round: '',
    location: '',
    people,
    hooks: [],
    sources: [{ kind: 'post', url: `${companyUrl || 'https://board.example'}/job`, seen: DAY }],
    signals: [],
    tier: 'B',
    status: 'new',
    statusHistory: [{ status: 'new', at: `${DAY}T09:00:00.000Z` }],
    snoozeUntil: null,
    attention: null,
    notes: '',
    sample: false,
  };
}

const entry = (text: string): BlockEntry => {
  const read = readTypedEntry(text, DAY);
  if (!read.ok) throw new Error(`not an entry: ${text}`);
  return read.entry;
};

describe('reading what the user types', () => {
  it('reads addresses and domains, dropping case, a scheme, "www." and a path', () => {
    expect(entry('Ana@Acme.example')).toEqual({ kind: 'email', value: 'ana@acme.example', addedOn: DAY });
    expect(entry('https://www.Acme.example/about')).toEqual({ kind: 'domain', value: 'acme.example', addedOn: DAY });
    expect(entry('@acme.example')).toEqual({ kind: 'domain', value: 'acme.example', addedOn: DAY });
  });

  it('refuses shared hosts as domains, since that would hit everyone on them', () => {
    expect(readTypedEntry('gmail.com', DAY)).toEqual({ ok: false, reason: 'shared' });
    expect(readTypedEntry('news.ycombinator.com', DAY)).toEqual({ ok: false, reason: 'shared' });
    for (const host of ['yahoo.co.uk', 'hotmail.fr', 'outlook.de', 'live.ca', 'ymail.com', 'pm.me', 'web.de', 'qq.com', 'mail.yahoo.com']) {
      expect(readTypedEntry(host, DAY)).toEqual({ ok: false, reason: 'shared' });
    }
    // A company whose name merely starts with a brand is not a shared host.
    expect(readTypedEntry('outlookanalytics.example', DAY).ok).toBe(true);
    // One address there can still be blocked.
    expect(readTypedEntry('ana@gmail.com', DAY).ok).toBe(true);
  });

  it('refuses what is neither', () => {
    expect(readTypedEntry('just a name', DAY)).toEqual({ ok: false, reason: 'invalid' });
    expect(readTypedEntry('ana@acme.example?subject=hi', DAY)).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('matching domains', () => {
  it('matches the domain and its subdomains, never a look-alike', () => {
    expect(onDomain('acme.example', 'acme.example')).toBe(true);
    expect(onDomain('jobs.acme.example', 'acme.example')).toBe(true);
    expect(onDomain('WWW.Acme.example', 'acme.example')).toBe(true);
    expect(onDomain('notacme.example', 'acme.example')).toBe(false);
    expect(onDomain('acme.example.evil', 'acme.example')).toBe(false);
  });

  it("finds a company's own domain from its site, or else from addresses that all share one", () => {
    expect(companyDomain(lead('Acme', 'https://www.acme.example', []))).toBe('acme.example');
    expect(companyDomain(lead('Acme', '', [person('Ana', 'ana@acme.example'), person('Ben', 'ben@acme.example')]))).toBe('acme.example');
    // Two different mail domains, or a shared host: not sure, so no company domain.
    expect(companyDomain(lead('Acme', '', [person('Ana', 'ana@acme.example'), person('Ben', 'ben@other.example')]))).toBeNull();
    expect(companyDomain(lead('Acme', '', [person('Ana', 'ana@gmail.com')]))).toBeNull();
  });
});

describe('applying the list (FR-5.7)', () => {
  it("drops a lead on a blocked company domain, subdomains too (AC-5.7)", () => {
    expect(applyBlockList(lead('Acme', 'https://jobs.acme.example', []), [entry('acme.example')])).toEqual({ kind: 'drop' });
    expect(applyBlockList(lead('Notacme', 'https://notacme.example', []), [entry('acme.example')]).kind).toBe('keep');
  });

  it('only takes off a stray address on a blocked domain, and keeps the company', () => {
    const stray = lead('Bravo', 'https://bravo.example', [person('Cy', 'cy@bravo.example', 'cy@acme.example')]);
    const result = applyBlockList(stray, [entry('acme.example')]);
    expect(result.kind === 'keep' && result.lead.people[0]?.contacts.map((contact) => contact.value)).toEqual(['cy@bravo.example']);
  });

  it('takes a blocked address off, and a lead whose only contact it was stays, with nobody to write to', () => {
    const only = lead('Acme', 'https://acme.example', [person('Ana', 'ana@acme.example')]);
    const result = applyBlockList(only, [entry('ana@acme.example')]);
    expect(result.kind).toBe('keep');
    expect(result.kind === 'keep' && result.lead.people[0]?.contacts).toEqual([]);
  });

  it('takes a blocked person off only at their own company', () => {
    const block = personEntry('Ana Quill', lead('Acme', 'https://acme.example', []), DAY)!;
    const acme = lead('Acme', 'https://acme.example', [person('Ana Quill', 'ana@acme.example'), person('Ben', 'ben@acme.example')]);
    const other = lead('Bravo', 'https://bravo.example', [person('Ana Quill', 'ana@bravo.example')]);
    const atAcme = applyBlockList(acme, [block]);
    expect(atAcme.kind === 'keep' && atAcme.lead.people.map((entry) => entry.name)).toEqual(['Ben']);
    expect(applyBlockList(other, [block])).toEqual({ kind: 'keep', lead: other });
  });

  it('never blocks a shared host by domain, even from a backup line', () => {
    expect(readBlockLine('gmail.com', DAY)).toBeNull();
  });
});

describe('the list in a backup (FRD §11.3)', () => {
  it('writes each entry as one line, and reads it back', () => {
    const entries: BlockEntry[] = [
      entry('ana@acme.example'),
      entry('acme.example'),
      personEntry('Ana Quill', lead('Acme', 'https://acme.example', []), DAY)!,
    ];
    const lines = entries.map(blockEntryText);
    expect(lines).toEqual(['ana@acme.example', 'acme.example', 'person: ana quill | acme.example']);
    expect(lines.map((line) => readBlockLine(line, DAY))).toEqual(entries);
  });

  it('refuses lines that are not entries', () => {
    for (const line of [42, null, '', 'person: x', 'person:  | acme.example', 'not a thing', 'a@b?c=d']) {
      expect(readBlockLine(line, DAY)).toBeNull();
    }
  });
});
