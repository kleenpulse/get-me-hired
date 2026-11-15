import { describe, expect, it } from 'vitest';
import { crc32, readZip, writeZip, ZipError } from './zip';

const text = (value: string) => new TextEncoder().encode(value);

describe('the ZIP writer and reader', () => {
  it('computes the standard CRC-32 check value', () => {
    expect(crc32(text('123456789'))).toBe(0xcbf43926);
  });

  it('reads back what it wrote, with UTF-8 names', async () => {
    const files = [
      { name: 'profile.md', data: text('# Profile\n') },
      { name: 'runs/2026-11-15.md', data: text('# Hunt: 2026-11-15\nRéunion ✓\n') },
    ];
    const read = await readZip(writeZip(files, new Date(2026, 10, 15, 9, 30)));
    expect(read.map((file) => [file.name, new TextDecoder().decode(file.data)])).toEqual(
      files.map((file) => [file.name, new TextDecoder().decode(file.data)]),
    );
  });

  it('refuses a damaged file instead of reading wrong bytes', async () => {
    const zip = writeZip([{ name: 'leads.csv', data: text('company\nQuillstack\n') }]);
    // Change one byte of the stored file: its checksum no longer matches.
    zip[30 + 'leads.csv'.length + 2] = 'X'.charCodeAt(0);
    await expect(readZip(zip)).rejects.toBeInstanceOf(ZipError);
  });

  it('refuses something that is not a ZIP', async () => {
    await expect(readZip(text('just text'))).rejects.toThrow('not a ZIP');
  });

  it('refuses compressed entries when no inflater is given', async () => {
    const zip = writeZip([{ name: 'a.txt', data: text('hello') }]);
    // Mark the entry as deflated (method 8) in the central directory.
    const central = zip.length - 22 - (46 + 'a.txt'.length);
    zip[central + 10] = 8;
    await expect(readZip(zip)).rejects.toThrow('compression');
  });
});

describe('skipping entries', () => {
  it('returns only the entries the caller wants', async () => {
    const zip = writeZip([
      { name: 'leads.csv', data: text('a') },
      { name: '../evil.txt', data: text('b') },
    ]);
    expect((await readZip(zip, undefined, (name) => name === 'leads.csv')).map((file) => file.name)).toEqual(['leads.csv']);
  });
});
