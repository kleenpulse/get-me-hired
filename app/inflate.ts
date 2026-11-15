// Unpacks deflated ZIP entries with the browser's own DecompressionStream, so
// the backup import needs no library. It counts bytes as they stream, and stops
// as soon as the output passes the cap, so a ZIP bomb can't fill memory.

import type { Inflate } from '@/core/zip';

export const inflateRaw: Inflate = async (data, maxBytes) => {
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('Unpacked data is larger than allowed');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
};
