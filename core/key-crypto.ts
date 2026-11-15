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

/**
 * The passphrase didn't open the keys, or the unlocked key belongs to another
 * record (another tab set a new passphrase). Nothing was changed.
 */
export class WrongPassphraseError extends Error {
  constructor() {
    super("That passphrase isn't right");
    this.name = 'WrongPassphraseError';
  }
}

/**
 * A key entry couldn't be opened with a key that fits its record: the check
 * entry already proved the passphrase right, so the stored entry is damaged
 * (or was moved to another provider). Nothing was changed.
 */
export class DamagedKeysError extends Error {
  constructor() {
    super('The stored keys are damaged');
    this.name = 'DamagedKeysError';
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

/** Decrypts one entry. A failure throws what `failure` makes: what it means depends on the entry. */
async function openOne(key: CryptoKey, sealed: Sealed, bound: string, failure: () => Error): Promise<string> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(sealed.iv), additionalData: encoder.encode(bound) },
      key,
      fromBase64(sealed.ct),
    );
    return decoder.decode(plain);
  } catch {
    throw failure();
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
  // The check entry decides whether the passphrase is right.
  const check = await openOne(unlocked.key, sealed.check, CHECK, () => new WrongPassphraseError());
  if (check !== CHECK_TEXT) throw new WrongPassphraseError();
  return unlocked;
}

/**
 * Decrypts every key. All or nothing, and nothing is returned on a failure:
 * - a key derived for another record (another salt or count) → WrongPassphraseError;
 * - an entry that won't open with a key that fits the record → DamagedKeysError,
 *   since the passphrase was already proven right by `unlock`.
 */
export async function openKeys(sealed: SealedKeys, unlocked: Unlocked): Promise<Partial<Record<ProviderId, string>>> {
  if (sealed.salt !== unlocked.salt || sealed.iterations !== unlocked.iterations) throw new WrongPassphraseError();
  const keys: Partial<Record<ProviderId, string>> = {};
  for (const [id, entry] of Object.entries(sealed.entries)) {
    if (isProviderId(id) && entry) keys[id] = await openOne(unlocked.key, entry, id, () => new DamagedKeysError());
  }
  return keys;
}

/** The length of what a base64 text decodes to, or `null` when it isn't base64. */
function decodedLength(text: unknown): number | null {
  if (typeof text !== 'string' || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) return null;
  try {
    return atob(text).length;
  } catch {
    return null;
  }
}

/** An IV of 12 bytes, and a ciphertext at least as long as AES-GCM's 16-byte tag. */
function isSealedEntry(value: unknown): value is Sealed {
  if (typeof value !== 'object' || value === null) return false;
  const ct = decodedLength((value as Sealed).ct);
  return decodedLength((value as Sealed).iv) === IV_BYTES && ct !== null && ct >= 16;
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
    decodedLength(record.salt) === SALT_BYTES &&
    isSealedEntry(record.check) &&
    typeof record.entries === 'object' &&
    record.entries !== null &&
    Object.entries(record.entries).every(([id, entry]) => isProviderId(id) && isSealedEntry(entry))
  );
}

/**
 * True for a record that was meant to be sealed (it says which version and KDF)
 * but isn't one `isSealedKeys` accepts: damaged, so it can't be opened. It must
 * never be read as plain keys, or quietly written over.
 */
export function isDamagedSealedKeys(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || isSealedKeys(value)) return false;
  const record = value as Record<string, unknown>;
  return 'kdf' in record || 'entries' in record || 'check' in record;
}

/** The providers that have a key in a sealed record, without opening it. */
export function sealedProviders(sealed: SealedKeys): ProviderId[] {
  return Object.keys(sealed.entries).filter(isProviderId);
}
