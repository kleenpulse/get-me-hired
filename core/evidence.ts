// Checks done in code, not by the model (FRD §4 principle 2, AC-5.3, §19
// finding 8). A model's words are kept only when they can be found in the
// source text, and email addresses are read from the text itself.

/**
 * Text folded for comparing: curly quotes made straight, dashes made plain,
 * spaces collapsed, lower case. Both sides of a comparison go through this,
 * so a model that "tidies" punctuation still matches the source.
 */
export function foldText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** True when `quote` is in `source`, after folding both. Quotes under 4 characters prove nothing. */
export function isQuoted(quote: string, source: string): boolean {
  const folded = foldText(quote).replace(/^["']+|["']+$/g, '');
  return folded.length >= 4 && foldText(source).includes(folded);
}

/**
 * A plain email address: no spaces, no `?` or `&`, and a dot in the domain.
 * The `mailto:` link holds only the address, never a subject or body (AC-6.5),
 * so anything that could carry those is refused here, at the seam.
 */
export function isPlainEmail(value: string): boolean {
  return /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(value) && !/[?&]/.test(value);
}

/** Only web addresses become links. */
export function isWebUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value) && URL.canParse(value);
}

const LITERAL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;

// Addresses written to dodge spam robots, read by a fixed rewrite of a real span
// of the text, never a guess (FRD §13.1). Only a bracketed "at" counts:
//   "jane [at] acme [dot] com", "jane.doe (at) acme.com", "jane [dot] doe [at] acme [dot] com".
// A bare "at" is never read as "@". "Email me at …", "Apply at acme dot io" and
// "find us at …" are ordinary English, and reading them would invent an address.
// A missed address is an honest gap (principle 7). A made-up one is not.
/** A word in brackets, with or without spaces inside: "[at]", "[ at ]", "(at)", "{at}", "<at>". */
const bracketed = (word: string) => String.raw`(?:\[\s*${word}\s*\]|\(\s*${word}\s*\)|\{\s*${word}\s*\}|<\s*${word}\s*>)`;
const SPELLED_DOT = String.raw`\s*${bracketed('dot')}\s*|\s+dot\s+`;
const ANY_DOT = String.raw`${SPELLED_DOT}|\.`;
const PART = '[a-z0-9_%+-]+';
const BRACKETED_AT = new RegExp(
  // The address can't start in the middle of a name: not after a letter, a dot, or a spelled-out dot.
  String.raw`(?<![a-z0-9._%+-])(?<!(?:${bracketed('dot')}|\bdot)\s*)` +
    String.raw`(${PART}(?:(?:${ANY_DOT})${PART})*)\s*${bracketed('at')}\s*` +
    String.raw`([a-z0-9-]+(?:(?:${ANY_DOT})[a-z0-9-]+)+)`,
  'gi',
);

/**
 * Every email address written in the text, in lower case, each once,
 * including the bracketed forms above. Each one passes `isPlainEmail`.
 */
export function findEmails(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(LITERAL)) found.add(match[0].toLowerCase());
  const dots = new RegExp(ANY_DOT, 'gi');
  for (const match of text.matchAll(BRACKETED_AT)) {
    const local = (match[1] ?? '').replace(dots, '.');
    const domain = (match[2] ?? '').replace(dots, '.');
    found.add(`${local}@${domain}`.toLowerCase());
  }
  return [...found].map((email) => email.replace(/\.+$/, '')).filter(isPlainEmail);
}

/** The first web address in the text, or `null`. Trailing sentence punctuation is dropped. */
export function firstWebUrl(text: string): string | null {
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const url = match[0].replace(/[.,;:!?)\]]+$/, '');
    if (isWebUrl(url)) return url;
  }
  return null;
}
