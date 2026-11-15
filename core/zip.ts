// A small ZIP writer and reader for the backup (FR-9.2), so the app needs no
// ZIP library. It writes files uncompressed ("stored"), which every unzip tool
// opens. It reads stored files, and compressed ("deflated") ones through an
// `inflate` function passed in by the caller (the browser's DecompressionStream),
// so this module uses no browser API itself (NFR-12).

export interface ZipFile {
  /** The path inside the archive, with forward slashes, such as `runs/2026-11-15.md`. */
  name: string;
  data: Uint8Array;
}

/**
 * Turns raw deflate data back into bytes. It must stop and throw as soon as the
 * output passes `maxBytes`, while it streams, so a ZIP bomb can't fill memory:
 * a size written in the ZIP's headers is never trusted.
 */
export type Inflate = (data: Uint8Array, maxBytes: number) => Promise<Uint8Array>;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** The DOS date and time a ZIP entry carries, from a local date. */
function dosTime(date: Date): { time: number; day: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

const UTF8_NAMES = 0x0800;

/** Builds a ZIP archive holding `files`, uncompressed, with UTF-8 names. */
export function writeZip(files: readonly ZipFile[], when: Date = new Date()): Uint8Array {
  const encoder = new TextEncoder();
  const { time, day } = dosTime(when);
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true); // local file header
    head.setUint16(4, 20, true); // version needed
    head.setUint16(6, UTF8_NAMES, true);
    head.setUint16(8, 0, true); // stored
    head.setUint16(10, time, true);
    head.setUint16(12, day, true);
    head.setUint32(14, crc, true);
    head.setUint32(18, size, true);
    head.setUint32(22, size, true);
    head.setUint16(26, name.length, true);
    head.setUint16(28, 0, true);
    local.push(new Uint8Array(head.buffer), name, file.data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true); // central directory header
    entry.setUint16(4, 20, true); // made by
    entry.setUint16(6, 20, true); // version needed
    entry.setUint16(8, UTF8_NAMES, true);
    entry.setUint16(10, 0, true);
    entry.setUint16(12, time, true);
    entry.setUint16(14, day, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, size, true);
    entry.setUint32(24, size, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);

    offset += 30 + name.length + size;
  }

  const centralSize = central.reduce((total, part) => total + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); // end of central directory
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const parts = [...local, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipError';
  }
}

/** Limits for a backup, which is small: entries, and bytes once unpacked, per file and in all. */
export const ZIP_LIMITS = {
  entries: 5000,
  entryBytes: 20 * 1024 * 1024,
  totalBytes: 100 * 1024 * 1024,
} as const;

/**
 * Reads the files in a ZIP archive that `wanted` accepts. Folders are skipped. Throws `ZipError`
 * when the bytes are not a ZIP this can read, or when a file's checksum is wrong.
 */
export async function readZip(bytes: Uint8Array, inflate?: Inflate, wanted: (name: string) => boolean = () => true): Promise<ZipFile[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end record sits in the last 22 bytes, plus a comment of up to 64 KB.
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at--) {
    if (view.getUint32(at, true) === 0x06054b50) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new ZipError('This is not a ZIP file');

  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  if (count > ZIP_LIMITS.entries) throw new ZipError('This ZIP holds too many files to be a backup');

  const decoder = new TextDecoder();
  const files: ZipFile[] = [];
  let total = 0;
  for (let index = 0; index < count; index++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) throw new ZipError('The ZIP file is damaged');
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const packedSize = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localAt = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;
    // Folders, and entries the caller doesn't want, are skipped before anything is unpacked.
    if (name.endsWith('/') || !wanted(name)) continue;

    if (localAt + 30 > bytes.length || view.getUint32(localAt, true) !== 0x04034b50) throw new ZipError('The ZIP file is damaged');
    const dataAt = localAt + 30 + view.getUint16(localAt + 26, true) + view.getUint16(localAt + 28, true);
    const packed = bytes.subarray(dataAt, dataAt + packedSize);
    if (packed.length !== packedSize) throw new ZipError('The ZIP file is damaged');

    // The cap is what's left of the limits, whatever the header says the size is.
    const cap = Math.min(ZIP_LIMITS.entryBytes, ZIP_LIMITS.totalBytes - total);
    let data: Uint8Array;
    if (method === 0) {
      if (packed.length > cap) throw new ZipError('This ZIP is too big to be a backup');
      data = packed.slice();
    } else if (method === 8 && inflate) {
      try {
        data = await inflate(packed, cap);
      } catch {
        throw new ZipError('A file in the ZIP is too big, or damaged');
      }
    } else {
      throw new ZipError('This ZIP uses a kind of compression the app can’t read');
    }
    total += data.length;
    if (data.length !== size || crc32(data) !== crc) throw new ZipError('A file in the ZIP is damaged');
    files.push({ name, data });
  }
  return files;
}
