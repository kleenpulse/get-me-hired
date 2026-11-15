// The profile (FRD §6.3): who the user is and what they want. It is stored in
// the agent skill's `profile.md` format (FR-3.5), with the skill's headings:
// Five questions, Prefer, Skip, Visa / constraints, Background (AC-3.5).
//
// The writer adds labelled sub-bullets under "Where", so every field in FR-3.3
// comes back unchanged (AC-3.3). The reader also accepts files the skill or a
// person wrote by hand, where those labels are missing.

export const REMOTE_PREFERENCES = ['remote', 'hybrid', 'any'] as const;
export type RemotePreference = (typeof REMOTE_PREFERENCES)[number];

/** Something the user built, linked in their emails, with one line about it. */
export interface ProofLink {
  url: string;
  line: string;
}

export interface Profile {
  roles: string[];
  skills: string[];
  location: string;
  timeZone: string;
  remote: RemotePreference | null;
  /** The least the user will take, in their own words, such as "$60k a year". */
  floor: string;
  /** When the user would move, such as "only for at least $90k". */
  relocation: string;
  visa: string;
  domains: string[];
  stages: string[];
  teamSize: string;
  skipCompanies: string[];
  skipRoles: string[];
  proofLinks: ProofLink[];
  /** Facts about the user that hooks can tie to (FR-4.20). */
  background: string[];
}

export function emptyProfile(): Profile {
  return {
    roles: [],
    skills: [],
    location: '',
    timeZone: '',
    remote: null,
    floor: '',
    relocation: '',
    visa: '',
    domains: [],
    stages: [],
    teamSize: '',
    skipCompanies: [],
    skipRoles: [],
    proofLinks: [],
    background: [],
  };
}

/** The fields a hunt can't run without (FR-3.6), in the order they're named. */
export const REQUIRED_FIELDS = ['roles', 'skills', 'location', 'floor'] as const;
export type RequiredField = (typeof REQUIRED_FIELDS)[number];

export function missingFields(profile: Profile | null): RequiredField[] {
  if (!profile) return [...REQUIRED_FIELDS];
  return REQUIRED_FIELDS.filter((field) => {
    const value = profile[field];
    return Array.isArray(value) ? value.length === 0 : value.trim() === '';
  });
}

/** Splits typed text into list items. Commas separate items, so no item holds one. */
export function splitItems(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((item) => oneLine(item))
    .filter(Boolean);
}

/** Adds items that aren't in the list yet, ignoring case. */
export function addItems(list: string[], items: string[]): string[] {
  const next = [...list];
  for (const item of items) {
    if (!next.some((existing) => existing.toLowerCase() === item.toLowerCase())) next.push(item);
  }
  return next;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * The profile as it is saved: every value on one line and trimmed, lists
 * without blanks or repeats, and empty proof links and facts left out. This is
 * exactly what `profile.md` can carry, so a saved profile round-trips (AC-3.3).
 */
export function cleanProfile(profile: Profile): Profile {
  const items = (values: string[]) => addItems([], values.flatMap(splitItems));
  return {
    roles: items(profile.roles),
    skills: items(profile.skills),
    location: oneLine(profile.location),
    timeZone: oneLine(profile.timeZone),
    remote: profile.remote,
    floor: oneLine(profile.floor),
    relocation: oneLine(profile.relocation),
    visa: oneLine(profile.visa),
    domains: items(profile.domains),
    stages: items(profile.stages),
    teamSize: oneLine(profile.teamSize),
    skipCompanies: items(profile.skipCompanies),
    skipRoles: items(profile.skipRoles),
    proofLinks: profile.proofLinks
      .map((link) => ({ url: trimUrl(oneLine(link.url)), line: oneLine(link.line) }))
      .filter((link) => link.url || link.line),
    background: profile.background.map(oneLine).filter(Boolean),
  };
}

/** A proof link must start with http:// or https:// (it becomes a link). */
export function isProofUrl(url: string): boolean {
  return /^https?:\/\/\S+$/i.test(url.trim()) && URL.canParse(url.trim());
}

/** Proof links that can't be saved: a line with no link, or a link that isn't a web address. */
export function badProofLinks(profile: Profile): number[] {
  return profile.proofLinks.flatMap((link, index) =>
    (link.url.trim() || link.line.trim()) && !isProofUrl(link.url) ? [index] : [],
  );
}

// Writing

const REMOTE_WORDS: Record<RemotePreference, string> = {
  remote: 'remote only',
  hybrid: 'remote or hybrid',
  any: 'remote, hybrid or on-site',
};

const list = (items: string[]) => items.map(oneLine).join(', ');

export function writeProfileMd(profile: Profile): string {
  const where = [
    oneLine(profile.location),
    profile.remote ? REMOTE_WORDS[profile.remote] : '',
    profile.timeZone.trim() ? `time zone ${oneLine(profile.timeZone)}` : '',
  ].filter(Boolean);

  const lines = [
    '# Profile',
    '',
    '<!-- Written by Get Me Hired. The get-me-hired skill reads this file on every run. Keep it short and true. -->',
    '',
    '## Five questions',
    '',
    `1. **Role(s) I want:** ${list(profile.roles)}`,
    `2. **My stack and strengths:** ${list(profile.skills)}`,
    `3. **Where:** ${where.join('; ')}`,
    `   - Location: ${oneLine(profile.location)}`,
    `   - Remote: ${profile.remote ? REMOTE_WORDS[profile.remote] : ''}`,
    `   - Time zone: ${oneLine(profile.timeZone)}`,
    `4. **Floor:** ${oneLine(profile.floor)}`,
    '5. **Proof links:**',
    ...profile.proofLinks.map((link) => `   - ${oneLine(link.url)} — ${oneLine(link.line)}`),
    '',
    '## Prefer',
    '',
    `- Stages: ${list(profile.stages)}`,
    `- Domains I care about: ${list(profile.domains)}`,
    `- Team size: ${oneLine(profile.teamSize)}`,
    '',
    '## Skip',
    '',
    `- Companies or domains to avoid: ${list(profile.skipCompanies)}`,
    `- Roles to avoid: ${list(profile.skipRoles)}`,
    '',
    '## Visa / constraints',
    '',
    `- Relocation: ${oneLine(profile.relocation)}`,
    `- Visa: ${oneLine(profile.visa)}`,
    '',
    '## Background',
    '',
    ...profile.background.map((fact) => `- ${oneLine(fact)}`),
  ];
  // No trailing spaces after an empty value, and one newline at the end.
  return `${lines.map((line) => line.trimEnd()).join('\n').trimEnd()}\n`;
}

// Reading

/** True when the text has the skill's first heading, so it can be read as a profile. */
export function looksLikeProfileMd(text: string): boolean {
  return /^##\s+Five questions\s*$/im.test(text);
}

/** In the comment at the top of every file the app writes. */
const WRITTEN_BY_APP = 'Written by Get Me Hired.';

/**
 * Reads one value. In a file the app didn't write, the skill template's
 * placeholders start with "e.g." and mean the field is empty. In the app's
 * own files, "e.g." is what the user typed, and is kept.
 */
function readValue(text: string, placeholders: boolean): string {
  const clean = oneLine(text);
  return placeholders && /^e\.g\./i.test(clean) ? '' : clean;
}

function readRemote(text: string): RemotePreference | null {
  const words = text.toLowerCase();
  if (/on-?site|\boffice\b|\bany\b/.test(words)) return 'any';
  if (/hybrid/.test(words)) return 'hybrid';
  if (/remote/.test(words)) return 'remote';
  return null;
}

/** Drops punctuation that ends a sentence, not the address: a full stop, a comma, or a ")" with no "(". */
function trimUrl(url: string): string {
  let trimmed = url;
  for (;;) {
    const opens = trimmed.split('(').length - 1;
    const closes = trimmed.split(')').length - 1;
    if (/[.,;]$/.test(trimmed) || (trimmed.endsWith(')') && closes > opens)) trimmed = trimmed.slice(0, -1);
    else return trimmed;
  }
}

/**
 * Reads "https://… — one line" as the app writes it, and the forms people
 * write by hand: "One line: https://…" and "[One line](https://…)".
 */
function readProofLink(text: string): ProofLink | null {
  const markdown = text.match(/\[([^\]]*)\]\((https?:\/\/(?:[^\s()]|\([^\s()]*\))+)\)/);
  if (markdown) {
    const rest = text.replace(markdown[0], '').replace(/^[\s:—–-]+/, '').trim();
    return { url: markdown[2] ?? '', line: oneLine([markdown[1], rest].filter(Boolean).join(' ')) };
  }
  const found = text.match(/https?:\/\/\S+/);
  if (!found || found.index === undefined) return null;
  const url = trimUrl(found[0]);
  const before = text.slice(0, found.index).replace(/\s*[:—–-]?\s*$/, '');
  // Only one separator goes: a line that itself starts or ends with a dash keeps it.
  // Whatever trimUrl dropped goes too, so "https://x.dev. — a line" reads as "a line".
  const after = text.slice(found.index + found[0].length).replace(/^\s*(?:[—–-](?=\s|$)|:)\s?/, '');
  return { url, line: oneLine(before || after) };
}

interface Item {
  number: number;
  text: string;
  subBullets: string[];
}

/** Splits the file into its `##` sections, keyed by heading in lower case. */
function sections(text: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  let current: string[] | null = null;
  // Comments are dropped only when they fill their own lines, so a value may hold "<!--".
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/^[ \t]*<!--[\s\S]*?-->[ \t]*$/gm, '')
    .split('\n');
  for (const raw of lines) {
    const heading = raw.match(/^##\s+(.+?)\s*$/);
    if (heading?.[1]) {
      current = [];
      found.set(heading[1].toLowerCase(), current);
    } else if (current) {
      current.push(raw);
    }
  }
  return found;
}

function numberedItems(lines: string[]): Item[] {
  const items: Item[] = [];
  for (const line of lines) {
    const numbered = line.match(/^\s{0,2}(\d+)\.\s+(?:\*\*[^*]*\*\*)?:?\s*(.*)$/);
    if (numbered) {
      items.push({ number: Number(numbered[1]), text: numbered[2] ?? '', subBullets: [] });
      continue;
    }
    const sub = line.match(/^\s+[-*]\s+(.*)$/);
    if (sub && items.length > 0) items[items.length - 1]?.subBullets.push(sub[1] ?? '');
  }
  return items;
}

function bullets(lines: string[]): string[] {
  return lines.flatMap((line) => {
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const text = bullet ? oneLine(bullet[1] ?? '') : '';
    return text ? [text] : [];
  });
}

/** Splits "Label: value". Returns null when the line has no label that matches `label`. */
function readLabelled(line: string, label: RegExp, placeholders: boolean): string | null {
  const match = line.match(/^([^:]{1,40}):\s*(.*)$/);
  if (!match || !label.test(match[1] ?? '')) return null;
  return readValue(match[2] ?? '', placeholders);
}

export function readProfileMd(text: string): Profile {
  const profile = emptyProfile();
  const parts = sections(text);
  const placeholders = !text.includes(WRITTEN_BY_APP);
  const value = (raw: string) => readValue(raw, placeholders);
  const labelled = (line: string, label: RegExp) => readLabelled(line, label, placeholders);

  for (const item of numberedItems(parts.get('five questions') ?? [])) {
    const answer = value(item.text);
    if (item.number === 1) profile.roles = splitItems(answer);
    if (item.number === 2) profile.skills = splitItems(answer);
    if (item.number === 4) profile.floor = answer;
    if (item.number === 5) {
      profile.proofLinks = item.subBullets.flatMap((line) => readProofLink(line) ?? []);
    }
    if (item.number === 3) {
      const location = item.subBullets.map((line) => labelled(line, /^location$/i)).find((found) => found !== null);
      const remote = item.subBullets.map((line) => labelled(line, /^remote$/i)).find((found) => found !== null);
      const zone = item.subBullets.map((line) => labelled(line, /^time ?zone$/i)).find((found) => found !== null);
      if (location !== undefined || remote !== undefined || zone !== undefined) {
        profile.location = location ?? '';
        profile.remote = remote ? readRemote(remote) : null;
        profile.timeZone = zone ?? '';
      } else {
        // Written by hand, such as "remote worldwide; open to Bangalore; time zone UTC+1".
        const pieces = answer.split(';').map(oneLine).filter(Boolean);
        const zonePiece = pieces.find((piece) => /time ?zone/i.test(piece));
        profile.timeZone = zonePiece ? oneLine(zonePiece.replace(/^.*time ?zone:?/i, '')) : '';
        profile.remote = readRemote(pieces.filter((piece) => piece !== zonePiece).join(' '));
        profile.location = pieces.filter((piece) => piece !== zonePiece).join('; ');
      }
    }
  }

  for (const line of bullets(parts.get('prefer') ?? [])) {
    const stages = labelled(line, /^stages?$/i);
    const domains = labelled(line, /domains/i);
    const team = labelled(line, /team size/i);
    if (stages !== null) profile.stages = splitItems(stages);
    else if (domains !== null) profile.domains = splitItems(domains);
    else if (team !== null) profile.teamSize = team;
  }

  for (const line of bullets(parts.get('skip') ?? [])) {
    const companies = labelled(line, /compan/i);
    const roles = labelled(line, /roles?/i);
    if (companies !== null) profile.skipCompanies = splitItems(companies);
    else if (roles !== null) profile.skipRoles = splitItems(roles);
  }

  const visaNotes: string[] = [];
  for (const line of bullets(parts.get('visa / constraints') ?? [])) {
    const relocation = labelled(line, /^relocat/i);
    const visa = labelled(line, /^visa$/i);
    if (relocation !== null) profile.relocation = relocation;
    else if (visa !== null) visaNotes.unshift(visa);
    else if (value(line)) visaNotes.push(value(line));
  }
  profile.visa = visaNotes.filter(Boolean).join('; ');

  profile.background = bullets(parts.get('background') ?? []).map(value).filter(Boolean);
  return profile;
}
