// A small RFC 4180 reader and writer for the hunt files (FRD §11.2).
//
// The reader is lenient because files may come from the agent skill, a
// spreadsheet or a text editor. The writer is strict: UTF-8 with no BOM, LF
// line endings, and quotes only where a field needs them.

const BOM = '﻿';

/**
 * Parses CSV text into rows of fields. Accepts LF, CRLF or CR line endings and
 * a leading BOM. Empty lines are skipped. It never throws: a quote that is
 * never closed takes the rest of the text as its field.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  // True once the current field began with a quote, so `""` is an empty field and not a missing one.
  let quoted = false;

  const endRow = () => {
    row.push(field);
    const blank = row.length === 1 && field.trim() === '' && !quoted;
    if (!blank) rows.push(row);
    row = [];
    field = '';
    quoted = false;
  };

  let i = text.startsWith(BOM) ? 1 : 0;
  for (; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char !== '"') {
        field += char;
      } else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = false;
      }
      continue;
    }

    if (char === '"' && field === '' && !quoted) {
      inQuotes = true;
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
      quoted = false;
    } else if (char === '\n') {
      endRow();
    } else if (char === '\r') {
      if (text[i + 1] === '\n') i++;
      endRow();
    } else {
      field += char;
    }
  }

  // The last row may have no line ending.
  if (field !== '' || quoted || row.length > 0) endRow();

  return rows;
}

export interface WriteCsvOptions {
  /** Start the file with a BOM so Excel reads it as UTF-8. Only for "Export for Excel" copies. */
  bom?: boolean;
}

const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;

function writeField(value: string): string {
  return NEEDS_QUOTES.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Writes rows as CSV with LF line endings, ending with one LF. */
export function writeCsv(rows: readonly (readonly string[])[], options: WriteCsvOptions = {}): string {
  const body = rows.map((row) => row.map(writeField).join(',') + '\n').join('');
  return options.bom ? BOM + body : body;
}
