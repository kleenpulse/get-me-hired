import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearDisplayCopy, DEFAULT_DISPLAY, readDisplayCopy, writeDisplayCopy } from './display';

/** A stand-in for localStorage. */
function memory() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the theme and text size copy (FR-10.5)', () => {
  it('writes only the theme and the text size, and reads them back', () => {
    const storage = memory();
    vi.stubGlobal('localStorage', storage);
    writeDisplayCopy({ theme: 'dark', textSize: 'larger', extra: 'never stored' } as never);
    expect([...storage.items.values()]).toEqual(['{"theme":"dark","textSize":"larger"}']);
    expect(readDisplayCopy()).toEqual({ theme: 'dark', textSize: 'larger' });
    clearDisplayCopy();
    expect(storage.items.size).toBe(0);
  });

  it('falls back to the defaults for anything it does not know', () => {
    const storage = memory();
    vi.stubGlobal('localStorage', storage);
    for (const bad of ['{"theme":"neon","textSize":"normal"}', '{"theme":"dark","textSize":"huge"}', 'not json', '[]', 'null']) {
      storage.items.set('get-me-hired:display', bad);
      expect(readDisplayCopy()).toEqual(DEFAULT_DISPLAY);
    }
  });

  it('never throws when the browser refuses storage, so the app still starts', () => {
    const refusing = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      removeItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    };
    vi.stubGlobal('localStorage', refusing);
    expect(readDisplayCopy()).toEqual(DEFAULT_DISPLAY);
    expect(() => writeDisplayCopy({ theme: 'dark', textSize: 'large' })).not.toThrow();
    expect(() => clearDisplayCopy()).not.toThrow();
  });
});
