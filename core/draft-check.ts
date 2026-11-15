// The draft checker (FR-7.1 to 7.3). The user pastes an email they wrote, and
// each of the 6 checks passes, shows a problem with the line it's on, or says
// plainly that it wasn't checked. It never rewrites the draft, and never offers
// "improved" text (FRD §4 principle 1, FR-7.2).
//
// Code decides 4 checks: the length, stock openers, one proof link, and, when
// the user picks the lead, whether the subject names its role or a hook. The
// other 2 ("the first line is about them", "one small ask") need judgement:
// they need the AI key, and until then they say "not checked", never a guess
// (FR-7.3, principle 2).

import { mentionsWords } from './hn-hunt';

export type CheckId = 'length' | 'first-line' | 'proof-link' | 'small-ask' | 'stock-opener' | 'subject';

/** The order FR-7.1 lists them in. */
export const CHECK_IDS: readonly CheckId[] = ['length', 'first-line', 'proof-link', 'small-ask', 'stock-opener', 'subject'];

export type DraftCheck =
  | { id: CheckId; state: 'pass' }
  /** `line` is the line of the body it's on (from 1), or null when it isn't one line. */
  | { id: CheckId; state: 'problem'; problem: DraftProblem; line: number | null }
  /** Needs judgement, so it needs the AI key. Not checked. */
  | { id: CheckId; state: 'needs-ai' }
  /** The subject check needs to know which lead the draft is for. */
  | { id: CheckId; state: 'needs-lead' };

export type DraftProblem =
  | { kind: 'too-long'; lines: number }
  | { kind: 'stock-opener'; phrase: string }
  | { kind: 'no-link' }
  | { kind: 'many-links'; links: number }
  | { kind: 'no-subject' }
  | { kind: 'subject-misses' };

/** The most lines the body may have (FR-7.1). */
export const MAX_LINES = 5;

/**
 * Openers that say nothing about the reader. Matched as whole phrases, ignoring
 * case, accents and punctuation, in the first two lines of the body.
 */
export const STOCK_OPENERS: readonly string[] = [
  'i hope this email finds you well',
  'i hope this finds you well',
  'i hope this message finds you well',
  'hope you are doing well',
  'i hope you are doing well',
  'hope you re doing well',
  'i hope you re doing well',
  'i hope you re well',
  'my name is',
  'i am writing to',
  'i m writing to',
  'i am reaching out',
  'i m reaching out',
  'i wanted to reach out',
  'i came across your',
  'to whom it may concern',
  'dear sir or madam',
  'dear hiring manager',
  'i would like to introduce myself',
  'allow me to introduce myself',
];

/** A greeting line ("Hi Ana," "Hello there") that isn't part of the message. */
const GREETING = /^(hi|hello|hey|dear|good (morning|afternoon|evening))\b[^.!?]{0,40}[,!:]?$/i;
/** Where the signature starts: a closing ("Thanks," "Best,") or a "--" line. */
const CLOSING = /^(--\s*|(many )?thanks?( you)?( so much)?|thank you|best|best regards|kind regards|regards|cheers|warmly|sincerely|all the best)[,!.]?$/i;
const LINK = /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+/gi;

/** The body's message lines with their line numbers: no blank lines, no greeting, no signature. */
export function messageLines(body: string): { text: string; line: number }[] {
  const all = body.split(/\r\n?|\n/).map((text, index) => ({ text: text.trim(), line: index + 1 }));
  const filled = all.filter((entry) => entry.text !== '');
  const closing = filled.findIndex((entry, index) => index > 0 && CLOSING.test(entry.text));
  const message = closing === -1 ? filled : filled.slice(0, closing);
  return message[0] && GREETING.test(message[0].text) ? message.slice(1) : message;
}

/** Every non-blank line of the body, with its line number. */
function allLines(body: string): { text: string; line: number }[] {
  return body
    .split(/\r\n?|\n/)
    .map((text, index) => ({ text: text.trim(), line: index + 1 }))
    .filter((entry) => entry.text !== '');
}

/** Lower case, accents off, punctuation as spaces: "I'm" becomes "i m". */
function plain(text: string): string {
  return ` ${text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;
}

function stockOpener(lines: { text: string; line: number }[]): DraftCheck {
  for (const entry of lines.slice(0, 2)) {
    const text = plain(entry.text);
    const phrase = STOCK_OPENERS.find((opener) => text.includes(` ${opener} `));
    if (phrase) return { id: 'stock-opener', state: 'problem', problem: { kind: 'stock-opener', phrase }, line: entry.line };
  }
  return { id: 'stock-opener', state: 'pass' };
}

function proofLink(lines: { text: string; line: number }[]): DraftCheck {
  const found = lines.flatMap((entry) => [...entry.text.matchAll(LINK)].map(() => entry.line));
  if (found.length === 0) return { id: 'proof-link', state: 'problem', problem: { kind: 'no-link' }, line: null };
  if (found.length > 1) return { id: 'proof-link', state: 'problem', problem: { kind: 'many-links', links: found.length }, line: found[1] ?? null };
  return { id: 'proof-link', state: 'pass' };
}

/** Common words that say nothing about a hook. */
const FILLER = new Set(['about', 'after', 'their', 'there', 'these', 'those', 'which', 'would', 'could', 'should', 'where', 'being', 'other', 'every', 'still', 'today']);

/** A hook's telling words: 5 letters or more, and not filler. One of them in the subject names the hook. */
function hookWords(hook: string): string[] {
  return plain(hook)
    .trim()
    .split(' ')
    .filter((word) => word.length >= 5 && !FILLER.has(word));
}

/** The lead the draft is for: only what the subject check reads. */
export interface DraftLead {
  role: string;
  hooks: readonly { text: string }[];
}

function subject(text: string, lead: DraftLead | null): DraftCheck {
  if (!text.trim()) return { id: 'subject', state: 'problem', problem: { kind: 'no-subject' }, line: null };
  if (!lead) return { id: 'subject', state: 'needs-lead' };
  const role = lead.role.trim() && mentionsWords(text, lead.role);
  const hook = lead.hooks.some((entry) => hookWords(entry.text).some((word) => mentionsWords(text, word)));
  return role || hook ? { id: 'subject', state: 'pass' } : { id: 'subject', state: 'problem', problem: { kind: 'subject-misses' }, line: null };
}

/** All 6 checks, in FR-7.1's order. */
export function checkDraft(input: { subject: string; body: string; lead: DraftLead | null }): DraftCheck[] {
  const lines = messageLines(input.body);
  const results: Record<CheckId, DraftCheck> = {
    length:
      lines.length > MAX_LINES
        ? { id: 'length', state: 'problem', problem: { kind: 'too-long', lines: lines.length }, line: lines[MAX_LINES]?.line ?? null }
        : { id: 'length', state: 'pass' },
    'first-line': { id: 'first-line', state: 'needs-ai' },
    // A proof link often sits in the signature, so links count across the whole body.
    'proof-link': proofLink(allLines(input.body)),
    'small-ask': { id: 'small-ask', state: 'needs-ai' },
    'stock-opener': stockOpener(lines),
    subject: subject(input.subject, input.lead),
  };
  return CHECK_IDS.map((id) => results[id]);
}
