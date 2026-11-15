import { describe, expect, it } from 'vitest';
import { writeCsv } from './csv';
import { leadToRow, rowLosesData, rowToLead } from './lead-row';
import { LEADS_CSV_HEADER, parseLeadsCsv, writeLeadsCsv } from './leads-csv';
import { buildSamplePipeline } from './sample-leads';

const NOW = new Date('2026-11-16T09:00:00Z');

function imported(csvRow: string) {
  const parsed = parseLeadsCsv(`${LEADS_CSV_HEADER.join(',')}\n${csvRow}\n`);
  if (!parsed.ok) throw new Error('bad header');
  return parsed.leads[0]!;
}

describe('a lead as a leads.csv row (FRD §11.2)', () => {
  it('writes the 17 columns, with lists joined by "; " and contacts item for item with their confidence', () => {
    const lead = buildSamplePipeline(NOW)[0]!;
    const row = leadToRow(lead);
    expect(Object.keys(row)).toEqual([...LEADS_CSV_HEADER]);
    const contacts = row.contacts.split('; ');
    expect(contacts).toHaveLength(row.contact_confidence.split('; ').length);
    expect(row.status).toBe('emailed');
    expect(row.next_action_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('reads a row back to the same CSV columns', () => {
    const lead = { ...buildSamplePipeline(NOW)[0]!, sample: false };
    const row = leadToRow(lead);
    const parsed = parseLeadsCsv(writeLeadsCsv([row]));
    if (!parsed.ok) throw new Error('bad csv');
    expect(leadToRow(rowToLead(parsed.leads[0]!))).toMatchObject({
      company: row.company,
      source_url: row.source_url,
      posted_at: row.posted_at,
      status: row.status,
      role: row.role,
    });
  });
});

describe('reading a row the skill wrote, with no JSON beside it', () => {
  it('matches contacts to people item for item when the counts agree', () => {
    const lead = rowToLead(
      imported(
        '2026-11-10,funding,Larkspur,https://larkspur.example,https://news.example/larkspur,2026-11-09,,n/a,$1.2M pre-seed,,Payroll,Ana (CEO); Ben (CTO),ana@larkspur.example; ben@larkspur.example,published (https://larkspur.example/team); pattern (from hi@larkspur.example),,new,',
      ),
    );
    expect(lead.people.map((person) => [person.name, person.role, person.contacts.map((contact) => contact.label)])).toEqual([
      ['Ana', 'CEO', ['published']],
      ['Ben', 'CTO', ['pattern']],
    ]);
    expect(lead.sources[0]?.kind).toBe('funding');
  });

  it('loads a row with lists of different lengths, and says it needs review (§11.2)', () => {
    const lead = rowToLead(
      imported('2026-11-10,post,Mosswood,,https://mosswood.example/jobs,~2026-11-03,,unknown,,Design Engineer,,Lee (CTO),lee@mosswood.example; jo@mosswood.example,guess,,new,'),
    );
    expect(lead.company).toBe('Mosswood');
    expect(lead.postedAtApprox).toBe(true);
    expect(lead.people[0]?.contacts.map((contact) => contact.value)).toEqual(['lee@mosswood.example', 'jo@mosswood.example']);
    expect(lead.notes).toBe('Needs review after import: contact-lists.');
  });

  it('never trusts "published" without a page to point at', () => {
    const lead = rowToLead(
      imported('2026-11-10,post,Fernwell,,https://fernwell.example/jobs,,,unknown,,Engineer,,Kim (CEO),kim@fernwell.example,published (somewhere),,new,'),
    );
    expect(lead.people[0]?.contacts[0]?.label).toBe('guess');
  });
});

describe("rows the app can't hold in full (FR-9.3, a linked folder never loses rows)", () => {
  const clean: Record<string, string> = {
    found_on: '2026-11-15',
    type: 'post',
    company: 'Kettle Labs',
    company_url: 'https://kettle.example',
    source_url: 'https://news.example/post/1',
    posted_at: '2026-11-15T08:00:00Z',
    age_hours: '4',
    likes: '12',
    round: '',
    role: 'Design engineer',
    fit: 'React and motion',
    people: 'Ada Obi (Founder)',
    contacts: 'ada@kettle.example',
    contact_confidence: 'published (https://kettle.example/team)',
    hooks: 'Ships every week',
    status: 'new',
    next_action_on: '',
  };
  const row = (changes: Record<string, string>, extra: string[] = []) =>
    imported(writeCsv([[...LEADS_CSV_HEADER.map((name) => changes[name] ?? clean[name] ?? ''), ...extra]]).trimEnd());

  it('holds a clean row, and a row the app wrote itself', () => {
    expect(rowLosesData(row({}))).toBe(false);
    const lead = { ...buildSamplePipeline(NOW)[0]!, sample: false };
    const parsed = parseLeadsCsv(writeLeadsCsv([leadToRow(lead)]));
    if (!parsed.ok) throw new Error('bad csv');
    expect(rowLosesData(parsed.leads[0]!)).toBe(false);
  });

  it.each([
    ['a row marked for review', { status: 'maybe-later' }],
    ['a web address that is not one', { source_url: 'ftp://files.example/x', hooks: '' }],
    ['a company address that is not one', { company_url: 'kettle dot example' }],
    ['a post time that is not a time', { posted_at: 'yesterday' }],
    ['likes that are not a number', { likes: 'lots' }],
    ['hooks with no source to point at', { source_url: '' }],
    ['a return date that is not a date', { status: 'not-now', next_action_on: 'soon' }],
    ['text on more than one line', { fit: 'React\nand motion' }],
    ["a contact the app won't keep", { contacts: 'ada@kettle.example?subject=hi' }],
  ])('keeps %s as written', (_, changes) => {
    expect(rowLosesData(row(changes))).toBe(true);
  });

  it('keeps a row with fields past the 17th as written', () => {
    expect(rowLosesData(row({}, ['an extra column']))).toBe(true);
  });
});
