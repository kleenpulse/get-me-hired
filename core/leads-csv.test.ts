import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { leadKey } from './lead-key';
import {
  joinList,
  LEAD_STATUSES,
  LEADS_CSV_HEADER,
  parseLeadsCsv,
  splitList,
  writeLeadsCsv,
  type ImportedLead,
  type LeadRow,
} from './leads-csv';

// The header exactly as FRD §11.2 gives it.
const FRD_HEADER =
  'found_on,type,company,company_url,source_url,posted_at,age_hours,likes,round,role,fit,people,contacts,contact_confidence,hooks,status,next_action_on';

// A leads.csv as older versions of the agent skill wrote it. Every company and person is invented.
const skillCsv = readFileSync(new URL('../fixtures/skill-hunt-folder/leads.csv', import.meta.url), 'utf8');

function load(text: string): ImportedLead[] {
  const result = parseLeadsCsv(text);
  if (!result.ok) throw new Error(`expected the file to load, got: ${result.reason}`);
  return result.leads;
}

function row(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    found_on: '2026-11-14',
    type: 'post',
    company: 'Northpeak Labs',
    company_url: 'https://northpeak.example',
    source_url: 'https://northpeak.example/careers',
    posted_at: '2026-11-14',
    age_hours: '',
    likes: 'n/a',
    round: '',
    role: 'Design Engineer',
    fit: 'Matches your motion work',
    people: 'Ada Quill (CEO)',
    contacts: 'ada@northpeak.example',
    contact_confidence: 'guess',
    hooks: 'Shipped a new editor',
    status: 'new',
    next_action_on: '',
    ...overrides,
  };
}

describe('the header', () => {
  it('matches FRD §11.2 exactly (AC-9.2)', () => {
    expect(LEADS_CSV_HEADER.join(',')).toBe(FRD_HEADER);
    expect(LEADS_CSV_HEADER).toHaveLength(17);
  });

  it('is the first line of every written file', () => {
    expect(writeLeadsCsv([])).toBe(`${FRD_HEADER}\n`);
  });
});

describe('a file written by the agent skill (AC-9.4)', () => {
  const leads = load(skillCsv);

  it('loads every row', () => {
    expect(leads.map((lead) => lead.row.company)).toEqual([
      'Northpeak Labs',
      'Tidewater AI',
      'Harbor Grid',
      'Kestrel Works',
      'Quarry, Finch & Co',
      'Larkspur',
    ]);
    expect(leads.map((lead) => lead.rowNumber)).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('goes back out byte for byte', () => {
    expect(writeLeadsCsv(leads.map((lead) => lead.row))).toBe(skillCsv);
  });

  it('keeps the raw text of fields the skill writes its own way', () => {
    const harbor = leads[2]?.row;
    expect(harbor?.likes).toBe('n/a (HN)');
    expect(harbor?.posted_at).toBe('~2026-11-03');
    expect(harbor?.age_hours).toBe('~264');
    expect(leads[0]?.row.contact_confidence).toBe('published (https://northpeak.example/team); post asks for DM');
  });

  it('reads quoted commas and doubled quotes', () => {
    expect(leads[1]?.row.round).toBe('$4M seed (Lumen Ridge Capital, with angels)');
    expect(splitList(leads[0]?.row.hooks ?? '')).toEqual([
      'Post asks for "someone who sweats animation"',
      'shipped a new editor on 2026-11-10 (https://northpeak.example/blog/editor)',
    ]);
  });

  it('loads two companies that share one thread URL, under different keys', () => {
    const [harbor, kestrel] = [leads[2]?.row, leads[3]?.row];
    expect(harbor?.source_url).toBe(kestrel?.source_url);
    const keys = leads.map((lead) => leadKey(lead.row.source_url, lead.row.company));
    expect(new Set(keys).size).toBe(leads.length);
  });

  it('marks only the row with mismatched contact lists for review', () => {
    expect(leads.map((lead) => lead.needsReview)).toEqual([[], [], [], [], ['contact-lists'], []]);
    const quarry = leads[4]?.row;
    expect(splitList(quarry?.contacts ?? '')).toHaveLength(2);
    expect(splitList(quarry?.contact_confidence ?? '')).toHaveLength(1);
  });

  it('uses only statuses the app knows', () => {
    for (const lead of leads) expect(LEAD_STATUSES).toContain(lead.row.status);
  });
});

describe('parseLeadsCsv', () => {
  it('refuses a file with a different header', () => {
    const text = 'company,email\nNorthpeak Labs,ada@northpeak.example\n';
    expect(parseLeadsCsv(text)).toEqual({ ok: false, reason: 'wrong-header', found: ['company', 'email'] });
  });

  it('refuses a header with the right names in the wrong order', () => {
    const swapped = FRD_HEADER.replace('found_on,type', 'type,found_on');
    expect(parseLeadsCsv(`${swapped}\n`)).toMatchObject({ ok: false, reason: 'wrong-header' });
  });

  it('refuses an empty file', () => {
    expect(parseLeadsCsv('')).toEqual({ ok: false, reason: 'empty', found: [] });
  });

  it('loads a file with a header and no rows', () => {
    expect(parseLeadsCsv(`${FRD_HEADER}\n`)).toEqual({ ok: true, leads: [] });
  });

  it('accepts a BOM, CRLF line endings and spaces around header names', () => {
    const spaced = FRD_HEADER.replaceAll(',', ' , ');
    const text = `﻿${spaced}\r\n${writeLeadsCsv([row()]).split('\n')[1]}\r\n`;
    expect(load(text).map((lead) => lead.row)).toEqual([row()]);
  });

  it('pads a short row and marks it for review', () => {
    const [lead] = load(`${FRD_HEADER}\n2026-11-14,post,Northpeak Labs\n`);
    expect(lead?.row.company).toBe('Northpeak Labs');
    expect(lead?.row.status).toBe('');
    expect(lead?.needsReview).toEqual(['field-count', 'unknown-status']);
  });

  it('keeps the extra fields of a long row and marks it for review', () => {
    const line = writeLeadsCsv([row()]).split('\n')[1];
    const [lead] = load(`${FRD_HEADER}\n${line},extra one,extra two\n`);
    expect(lead?.row).toEqual(row());
    expect(lead?.extraFields).toEqual(['extra one', 'extra two']);
    expect(lead?.needsReview).toEqual(['field-count']);
  });

  it('marks an unknown type or status for review, and still loads the row', () => {
    const [lead] = load(writeLeadsCsv([row({ type: 'referral', status: 'interested' })]));
    expect(lead?.needsReview).toEqual(['unknown-type', 'unknown-status']);
    expect(lead?.row.status).toBe('interested');
  });

  it('accepts every status in FRD §8.1', () => {
    const leads = load(writeLeadsCsv(LEAD_STATUSES.map((status) => row({ status }))));
    expect(leads).toHaveLength(9);
    expect(leads.every((lead) => lead.needsReview.length === 0)).toBe(true);
  });
});

describe('writeLeadsCsv', () => {
  it('writes UTF-8 text with no BOM and LF line endings', () => {
    const text = writeLeadsCsv([row({ company: 'Zoë & Søn', fit: 'two\nlines' })]);
    expect(text.startsWith('found_on,')).toBe(true);
    expect(text).not.toContain('\r');
    expect(text.endsWith('\n')).toBe(true);
  });

  it('adds a BOM only for the Excel copy', () => {
    expect(writeLeadsCsv([], { bom: true })).toBe(`﻿${FRD_HEADER}\n`);
  });

  it('round-trips rows with awkward text', () => {
    const rows = [
      row({ company: 'Quarry, Finch & Co', hooks: 'Said "ship it"; then shipped', fit: 'line one\nline two' }),
      row({ company: ' Padded ', round: '$4M pre-seed (lead investor)', next_action_on: '2026-11-23' }),
    ];
    expect(load(writeLeadsCsv(rows)).map((lead) => lead.row)).toEqual(rows);
  });
});

describe('lists inside a field', () => {
  it('joins with a semicolon and a space', () => {
    expect(joinList(['Ada Quill (CEO)', 'Bo Ferris (CTO)'])).toBe('Ada Quill (CEO); Bo Ferris (CTO)');
  });

  it('splits with or without the space, and drops empty items', () => {
    expect(splitList('a; b;c ;  d;')).toEqual(['a', 'b', 'c', 'd']);
    expect(splitList('')).toEqual([]);
    expect(splitList('   ')).toEqual([]);
  });

  it('round-trips a list', () => {
    const items = ['ada@northpeak.example', 'DM: LinkedIn', 'form: https://northpeak.example/apply'];
    expect(splitList(joinList(items))).toEqual(items);
  });
});
