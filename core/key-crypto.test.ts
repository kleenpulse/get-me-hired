// Real WebCrypto (Node 20+ has crypto.subtle), no mocks. Most tests use a low
// iteration count to stay fast. One checks the real default.

import { describe, expect, it } from 'vitest';
import {
  DamagedKeysError,
  isDamagedSealedKeys,
  isSealedKeys,
  KDF,
  KDF_ITERATIONS,
  newPassphrase,
  openKeys,
  sealedProviders,
  sealKeys,
  unlock,
  WrongPassphraseError,
} from './key-crypto';

const FAST = 1_000;
const KEYS = { gemini: 'test-key-not-real-gemini', openrouter: 'test-key-not-real-openrouter' };

describe('the key passphrase (FR-10.4)', () => {
  it('encrypts the keys and opens them again with the same passphrase', async () => {
    const sealed = await sealKeys(KEYS, await newPassphrase('correct horse', FAST));
    expect(JSON.stringify(sealed)).not.toContain('test-key-not-real');
    expect(JSON.stringify(sealed)).not.toContain('correct horse');
    expect(await openKeys(sealed, await unlock(sealed, 'correct horse'))).toEqual(KEYS);
    expect(sealedProviders(sealed).sort()).toEqual(['gemini', 'openrouter']);
  });

  it('refuses a wrong passphrase, even with no key stored', async () => {
    const sealed = await sealKeys(KEYS, await newPassphrase('correct horse', FAST));
    await expect(unlock(sealed, 'wrong horse')).rejects.toBeInstanceOf(WrongPassphraseError);
    const empty = await sealKeys({}, await newPassphrase('correct horse', FAST));
    await expect(unlock(empty, 'wrong horse')).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it("won't open a key moved to another provider, and calls it damaged", async () => {
    const sealed = await sealKeys(KEYS, await newPassphrase('correct horse', FAST));
    const swapped = { ...sealed, entries: { gemini: sealed.entries.openrouter, openrouter: sealed.entries.gemini } };
    const unlocked = await unlock(swapped, 'correct horse');
    await expect(openKeys(swapped, unlocked)).rejects.toBeInstanceOf(DamagedKeysError);
  });

  it('calls a corrupted entry damaged when the passphrase is right, and still wrong when it is not', async () => {
    const sealed = await sealKeys({ gemini: KEYS.gemini }, await newPassphrase('correct horse', FAST));
    // Flip one byte of the entry: still valid base64 of the same length.
    const bytes = Uint8Array.from(atob(sealed.entries.gemini!.ct), (char) => char.charCodeAt(0));
    bytes[0] = bytes[0]! ^ 0xff;
    const flipped = { ...sealed, entries: { gemini: { iv: sealed.entries.gemini!.iv, ct: btoa(String.fromCharCode(...bytes)) } } };
    expect(isSealedKeys(flipped)).toBe(true);
    const unlocked = await unlock(flipped, 'correct horse');
    await expect(openKeys(flipped, unlocked)).rejects.toBeInstanceOf(DamagedKeysError);
    await expect(unlock(flipped, 'wrong horse')).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it('refuses a key derived for another record', async () => {
    const one = await sealKeys(KEYS, await newPassphrase('correct horse', FAST));
    const other = await sealKeys(KEYS, await newPassphrase('correct horse', FAST));
    await expect(openKeys(other, await unlock(one, 'correct horse'))).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it('uses a fresh salt and IV each time, so the same keys never look the same', async () => {
    const a = await sealKeys(KEYS, await newPassphrase('correct horse', FAST));
    const b = await sealKeys(KEYS, await newPassphrase('correct horse', FAST));
    expect(a.salt).not.toBe(b.salt);
    expect(a.entries.gemini?.iv).not.toBe(b.entries.gemini?.iv);
  });

  it('keeps the AES key out of reach: it cannot be exported', async () => {
    const unlocked = await newPassphrase('correct horse', FAST);
    expect(unlocked.key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', unlocked.key)).rejects.toThrow();
  });

  it('stores the parameters with the keys, at 600,000 iterations by default', async () => {
    const sealed = await sealKeys({ gemini: KEYS.gemini }, await newPassphrase('correct horse'));
    expect(sealed).toMatchObject({ v: 1, kdf: KDF, iterations: KDF_ITERATIONS });
    expect(KDF_ITERATIONS).toBe(600_000);
    expect(atob(sealed.salt)).toHaveLength(16);
    expect(atob(sealed.entries.gemini!.iv)).toHaveLength(12);
    expect(isSealedKeys(sealed)).toBe(true);
  });

  it('reads only a well-formed record', async () => {
    const sealed = await sealKeys(KEYS, await newPassphrase('correct horse', FAST));
    expect(isSealedKeys(sealed)).toBe(true);
    expect(isSealedKeys(KEYS)).toBe(false);
    expect(isSealedKeys({ ...sealed, iterations: 1e12 })).toBe(false);
    expect(isSealedKeys({ ...sealed, kdf: 'MD5' })).toBe(false);
    expect(isSealedKeys({ ...sealed, entries: { nope: sealed.entries.gemini } })).toBe(false);
    expect(isSealedKeys(null)).toBe(false);
  });

  it('refuses bytes that are not base64 or the wrong length, and calls that record damaged', async () => {
    const sealed = await sealKeys(KEYS, await newPassphrase('correct horse', FAST));
    const damaged = [
      { ...sealed, salt: '!!not base64!!' },
      { ...sealed, salt: btoa('short') },
      { ...sealed, check: { ...sealed.check, iv: btoa('eleven byte') } },
      { ...sealed, entries: { gemini: { iv: sealed.entries.gemini!.iv, ct: btoa('tiny') } } },
    ];
    for (const record of damaged) {
      expect(isSealedKeys(record)).toBe(false);
      expect(isDamagedSealedKeys(record)).toBe(true);
    }
    // Plain keys and a good record are never called damaged.
    expect(isDamagedSealedKeys(KEYS)).toBe(false);
    expect(isDamagedSealedKeys(sealed)).toBe(false);
    expect(isDamagedSealedKeys(undefined)).toBe(false);
  });
});
