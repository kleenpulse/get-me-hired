// The optional passphrase that encrypts stored provider keys (FR-10.4, NFR-3).
//
// It protects keys at rest: from someone who reads this browser's storage later,
// as on a shared computer. It doesn't protect a tab while it's unlocked, or
// against code running in the page. A forgotten passphrase can't be recovered.
//
// - PBKDF2-SHA-256 turns the passphrase into an AES-GCM key. The parameters are
//   stored with the keys, so they can change later. The passphrase never is.
// - Each provider key is encrypted with its own random IV, and bound to its
//   provider (the provider id is AES-GCM's additional data), so ciphertexts
//   can't be swapped between providers.
// - A check entry, a fixed text encrypted the same way, tells a wrong passphrase
//   apart even when no key is stored.
// - The AES key is made non-extractable: code can use it, never read it out.
//
// Uses WebCrypto (`crypto.subtle`), which browsers and Node 20+ both have.

import { isProviderId, type ProviderId } from './providers';

export const KDF = 'PBKDF2-SHA-256';
/** OWASP's current figure for PBKDF2-SHA-256. */
export const KDF_ITERATIONS = 600_000;
/** A stored count above this is refused: deriving would freeze the tab. */
const MAX_ITERATIONS = 10_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const CHECK = 'check';
const CHECK_TEXT = 'get-me-hired keys';

export interface Sealed {
  iv: string;
  ct: string;
}

/** The keys record when a passphrase is set. Base64 for the bytes. */
export interface SealedKeys {
  v: 1;
  kdf: typeof KDF;
  iterations: number;
  salt: string;
  check: Sealed;
  entries: Partial<Record<ProviderId, Sealed>>;
}

/** The passphrase didn't open the keys. Nothing was changed. */
export class WrongPassphraseError extends Error {
  constructor() {
    super("That passphrase isn't right");
    this.name = 'WrongPassphraseError';
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

function random(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** The AES-GCM key for a passphrase. Non-extractable: it can encrypt and decrypt, never be exported. */
export async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function sealOne(key: CryptoKey, text: string, bound: string): Promise<Sealed> {
  const iv = random(IV_BYTES);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(bound) }, key, encoder.encode(text));
  return { iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) };
}

async function openOne(key: CryptoKey, sealed: Sealed, bound: string): Promise<string> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(sealed.iv), additionalData: encoder.encode(bound) },
      key,
      fromBase64(sealed.ct),
    );
    return decoder.decode(plain);
  } catch {
    throw new WrongPassphraseError();
  }
}

/** A key derived for a sealed record: what this tab holds in memory while unlocked. */
export interface Unlocked {
  key: CryptoKey;
  salt: string;
  iterations: number;
}

/** Sets a new passphrase: a new salt, and the AES key that goes with it. */
export async function newPassphrase(passphrase: string, iterations = KDF_ITERATIONS): Promise<Unlocked> {
  const salt = random(SALT_BYTES);
  return { key: await deriveKey(passphrase, salt, iterations), salt: toBase64(salt), iterations };
}

/** Encrypts the keys with an unlocked key. */
export async function sealKeys(keys: Partial<Record<ProviderId, string>>, unlocked: Unlocked): Promise<SealedKeys> {
  const entries: SealedKeys['entries'] = {};
  for (const [id, value] of Object.entries(keys)) {
    if (isProviderId(id) && typeof value === 'string' && value) entries[id] = await sealOne(unlocked.key, value, id);
  }
  return {
    v: 1,
    kdf: KDF,
    iterations: unlocked.iterations,
    salt: unlocked.salt,
    check: await sealOne(unlocked.key, CHECK_TEXT, CHECK),
    entries,
  };
}

/** Derives the key for a sealed record from the passphrase, and checks it. Rejects with WrongPassphraseError. */
export async function unlock(sealed: SealedKeys, passphrase: string): Promise<Unlocked> {
  const unlocked: Unlocked = {
    key: await deriveKey(passphrase, fromBase64(sealed.salt), sealed.iterations),
    salt: sealed.salt,
    iterations: sealed.iterations,
  };
  if ((await openOne(unlocked.key, sealed.check, CHECK)) !== CHECK_TEXT) throw new WrongPassphraseError();
  return unlocked;
}

/**
 * Decrypts every key. All or nothing: one that fails (a wrong key, or a
 * ciphertext moved to another provider) rejects, and nothing is returned.
 */
export async function openKeys(sealed: SealedKeys, unlocked: Unlocked): Promise<Partial<Record<ProviderId, string>>> {
  if (sealed.salt !== unlocked.salt || sealed.iterations !== unlocked.iterations) throw new WrongPassphraseError();
  const keys: Partial<Record<ProviderId, string>> = {};
  for (const [id, entry] of Object.entries(sealed.entries)) {
    if (isProviderId(id) && entry) keys[id] = await openOne(unlocked.key, entry, id);
  }
  return keys;
}

function isSealedEntry(value: unknown): value is Sealed {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Sealed).iv === 'string' &&
    typeof (value as Sealed).ct === 'string'
  );
}

/** True for a keys record written by `sealKeys`. */
export function isSealedKeys(value: unknown): value is SealedKeys {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<SealedKeys>;
  return (
    record.v === 1 &&
    record.kdf === KDF &&
    typeof record.iterations === 'number' &&
    Number.isInteger(record.iterations) &&
    record.iterations >= 1 &&
    record.iterations <= MAX_ITERATIONS &&
    typeof record.salt === 'string' &&
    isSealedEntry(record.check) &&
    typeof record.entries === 'object' &&
    record.entries !== null &&
    Object.entries(record.entries).every(([id, entry]) => isProviderId(id) && isSealedEntry(entry))
  );
}

/** The providers that have a key in a sealed record, without opening it. */
export function sealedProviders(sealed: SealedKeys): ProviderId[] {
  return Object.keys(sealed.entries).filter(isProviderId);
}
