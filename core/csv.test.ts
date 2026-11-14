import { describe, expect, it } from 'vitest';
import { parseCsv, writeCsv } from './csv';

describe('parseCsv', () => {
  it('reads plain rows', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('reads quoted fields with commas, quotes and line breaks', () => {
    const text = 'name,note\n"Quarry, Finch & Co","She said ""hi""\nthen left"\n';
    expect(parseCsv(text)).toEqual([
      ['name', 'note'],
      ['Quarry, Finch & Co', 'She said "hi"\nthen left'],
    ]);
  });

  it('keeps empty fields, at the start, middle and end', () => {
    expect(parseCsv(',a,,b,\n')).toEqual([['', 'a', '', 'b', '']]);
  });

  it('reads a last row with no line ending', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a,b\n1,')).toEqual([
      ['a', 'b'],
      ['1', ''],
    ]);
  });

  it('accepts CRLF and lone CR line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a,b\r1,2\r')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps a CRLF inside a quoted field as written', () => {
    expect(parseCsv('"one\r\ntwo",x\n')).toEqual([['one\r\ntwo', 'x']]);
  });

  it('drops a leading BOM', () => {
    expect(parseCsv('﻿a,b\n')).toEqual([['a', 'b']]);
  });

  it('skips empty and whitespace-only lines', () => {
    expect(parseCsv('a,b\n\n   \n1,2\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps a row that is one quoted empty field', () => {
    expect(parseCsv('a\n""\n')).toEqual([['a'], ['']]);
  });

  it('keeps spaces around unquoted fields', () => {
    expect(parseCsv(' a , b \n')).toEqual([[' a ', ' b ']]);
  });

  it('treats a quote in the middle of an unquoted field as text', () => {
    expect(parseCsv('5" screen,ok\n')).toEqual([['5" screen', 'ok']]);
  });

  it('takes the rest of the text when a quote is never closed', () => {
    expect(parseCsv('a,"b,c\nd')).toEqual([['a', 'b,c\nd']]);
  });

  it('reads non-ASCII text', () => {
    expect(parseCsv('Zoë Ålund,“quoted” — café ☕\n')).toEqual([['Zoë Ålund', '“quoted” — café ☕']]);
  });

  it('returns no rows for empty text', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('\n')).toEqual([]);
  });
});

describe('writeCsv', () => {
  it('writes LF line endings and ends with one LF', () => {
    expect(
      writeCsv([
        ['a', 'b'],
        ['1', '2'],
      ]),
    ).toBe('a,b\n1,2\n');
  });

  it('quotes only the fields that need it', () => {
    expect(writeCsv([['plain', 'has,comma', 'has "quote"', 'two\nlines', 'a\rb', ' padded ', '']])).toBe(
      'plain,"has,comma","has ""quote""","two\nlines","a\rb"," padded ",\n',
    );
  });

  it('writes no BOM by default, and one for Excel copies', () => {
    expect(writeCsv([['a']])).toBe('a\n');
    expect(writeCsv([['a']], { bom: true })).toBe('﻿a\n');
  });

  it('writes nothing for no rows', () => {
    expect(writeCsv([])).toBe('');
  });

  it('round-trips awkward values', () => {
    const rows = [
      ['', ' ', '"', '""', ',', '\n', '\r\n', 'a,"b"\nc'],
      ['; ', 'x; y', 'it is', 'Zoë', '\t', 'trailing ', ' leading', 'end'],
    ];
    expect(parseCsv(writeCsv(rows))).toEqual(rows);
    expect(parseCsv(writeCsv(rows, { bom: true }))).toEqual(rows);
  });
});
