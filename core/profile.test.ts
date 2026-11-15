import { describe, expect, it } from 'vitest';
import {
  addItems,
  badProofLinks,
  cleanProfile,
  emptyProfile,
  looksLikeProfileMd,
  missingFields,
  readProfileMd,
  splitItems,
  writeProfileMd,
  type Profile,
} from './profile';

// An invented person. No real details.
const FULL: Profile = {
  roles: ['Founding frontend engineer', 'Design engineer'],
  skills: ['TypeScript', 'React', 'Motion', 'Postgres'],
  location: 'Lagos, Nigeria',
  timeZone: 'UTC+1',
  remote: 'hybrid',
  floor: '$60k a year; equity OK',
  relocation: 'Only for at least $90k with visa help',
  visa: 'Needs sponsorship for the US and the UK',
  domains: ['AI dev tools', 'fintech'],
  stages: ['Pre-seed', 'Seed'],
  teamSize: 'Under 20 people',
  skipCompanies: ['Ad tech', 'Crypto exchanges'],
  skipRoles: ['Mobile only', 'QA'],
  proofLinks: [
    { url: 'https://ada-builds.example/booking', line: 'A booking app used by 3,000 people' },
    { url: 'https://ada-builds.example/motion', line: 'A motion library with 400 stars' },
  ],
  background: ['I ran a design studio for 3 years.', 'I speak Yoruba and French.'],
};

// The skill's own template, as `references/profile-template.md` ships it.
const TEMPLATE = `# Profile

<!-- The get-me-hired skill reads this file on every run. Keep it short and true. -->

## Five questions

1. **Role(s) I want:** e.g. founding frontend engineer, design engineer, full-stack (Next.js)
2. **My stack and strengths:** e.g. TypeScript, Next.js App Router, Tailwind, Motion, Postgres
3. **Where:** e.g. remote worldwide; open to Bangalore; time zone UTC+1
4. **Floor:** e.g. at least 15 LPA / $60k; equity OK
5. **Proof links:** 2–4 things I built that I can link in an email (live URL + one line each)

## Prefer

- Stages: pre-seed, seed (Series A only if the role is a strong fit)
- Domains I care about:
- Team size:

## Skip

- Companies or domains to avoid:
- Roles to avoid:

## Visa / constraints

-
`;

describe('profile.md (FR-3.5)', () => {
  it('gives back every field unchanged after writing and reading (AC-3.3)', () => {
    expect(readProfileMd(writeProfileMd(FULL))).toEqual(FULL);
  });

  it('round-trips an empty profile', () => {
    expect(readProfileMd(writeProfileMd(emptyProfile()))).toEqual(emptyProfile());
  });

  it('round-trips every remote preference, and none', () => {
    for (const remote of ['remote', 'hybrid', 'any', null] as const) {
      const profile = { ...FULL, remote };
      expect(readProfileMd(writeProfileMd(profile)).remote).toBe(remote);
    }
  });

  it("uses the skill's headings (AC-3.5)", () => {
    const text = writeProfileMd(FULL);
    const headings = [...text.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    expect(headings).toEqual(['Five questions', 'Prefer', 'Skip', 'Visa / constraints', 'Background']);
    expect(text).toContain('1. **Role(s) I want:** Founding frontend engineer, Design engineer');
    expect(text).toContain('3. **Where:** Lagos, Nigeria; remote or hybrid; time zone UTC+1');
    expect(text).toContain('4. **Floor:** $60k a year; equity OK');
    expect(text.endsWith('\n')).toBe(true);
    expect(text).not.toMatch(/[ \t]$/m);
  });

  it("reads the skill's empty template as an empty profile, apart from its stage default", () => {
    expect(looksLikeProfileMd(TEMPLATE)).toBe(true);
    expect(readProfileMd(TEMPLATE)).toEqual({
      ...emptyProfile(),
      stages: ['pre-seed', 'seed (Series A only if the role is a strong fit)'],
    });
  });

  it('reads a profile written by hand, without the labelled sub-bullets', () => {
    const text = `## Five questions

1. **Role(s) I want:** frontend engineer, design engineer
2. **My stack and strengths:** TypeScript, React
3. **Where:** remote worldwide; open to Accra; time zone UTC+0
4. **Floor:** $50k
5. **Proof links:**
   - https://kofi.example — My portfolio
   - A chart library: https://kofi.example/charts

## Visa / constraints

- Can't relocate before June
- Visa: none needed in the EU

## Background

- Taught a coding class for two years.
`;
    const profile = readProfileMd(text);
    expect(profile.roles).toEqual(['frontend engineer', 'design engineer']);
    expect(profile.location).toBe('remote worldwide; open to Accra');
    expect(profile.timeZone).toBe('UTC+0');
    expect(profile.remote).toBe('remote');
    expect(profile.floor).toBe('$50k');
    expect(profile.proofLinks).toEqual([
      { url: 'https://kofi.example', line: 'My portfolio' },
      { url: 'https://kofi.example/charts', line: 'A chart library' },
    ]);
    expect(profile.visa).toBe("none needed in the EU; Can't relocate before June");
    expect(profile.background).toEqual(['Taught a coding class for two years.']);
  });

  it('round-trips awkward values exactly', () => {
    const awkward: Profile = {
      ...FULL,
      floor: 'e.g. 50k, or more with equity',
      location: 'Lagos: Ikeja; Nigeria',
      roles: ['**Lead** dev', 'e.g. anything'],
      proofLinks: [
        { url: 'https://en.wikipedia.example/wiki/Foo_(bar)', line: '- built it -' },
        { url: 'https://ada.example', line: '' },
        { url: 'https://ada.example/a', line: ': starts with a colon' },
      ],
      background: ['<!-- not a comment to me -->', '## Skip', 'A fact with https://ada.example/link in it'],
    };
    expect(readProfileMd(writeProfileMd(awkward))).toEqual(awkward);
  });

  it('drops sentence punctuation after a link the same way when saving and when reading', () => {
    const typed: Profile = { ...FULL, proofLinks: [{ url: 'https://a.example/x.', line: 'trail dot' }] };
    const clean = cleanProfile(typed);
    expect(clean.proofLinks).toEqual([{ url: 'https://a.example/x', line: 'trail dot' }]);
    expect(readProfileMd(writeProfileMd(clean))).toEqual(clean);
    const text = '## Five questions\n\n5. **Proof links:**\n   - https://z.example. — the thing\n';
    expect(readProfileMd(text).proofLinks).toEqual([{ url: 'https://z.example', line: 'the thing' }]);
  });

  it('reads proof links people write by hand', () => {
    const text = `## Five questions

5. **Proof links:**
   - [My site](https://kofi.example/a_(b)) — the one I like
   - See https://kofi.example/c.
   - (https://kofi.example/d)
`;
    expect(readProfileMd(text).proofLinks).toEqual([
      { url: 'https://kofi.example/a_(b)', line: 'My site the one I like' },
      { url: 'https://kofi.example/c', line: 'See' },
      { url: 'https://kofi.example/d', line: '(' },
    ]);
  });

  it('reads Windows line endings', () => {
    expect(readProfileMd(writeProfileMd(FULL).replace(/\n/g, '\r\n'))).toEqual(FULL);
  });

  it('does not read a country name as "on-site"', () => {
    const profile = readProfileMd('## Five questions\n\n3. **Where:** Berlin, Germany; remote only\n');
    expect(profile.remote).toBe('remote');
  });

  it('spots a file that is not a profile', () => {
    expect(looksLikeProfileMd('company,role\nAcme,Engineer\n')).toBe(false);
  });
});

describe('cleaning a profile before it is saved', () => {
  it('trims values, splits commas, drops repeats and empty rows, and still round-trips', () => {
    const messy: Profile = {
      ...FULL,
      roles: ['  Design engineer ', 'design engineer', 'Frontend, Full-stack', ''],
      location: ' Lagos,\n Nigeria ',
      proofLinks: [...FULL.proofLinks, { url: ' ', line: '' }],
      background: ['', '  I ran a studio. '],
    };
    const clean = cleanProfile(messy);
    expect(clean.roles).toEqual(['Design engineer', 'Frontend', 'Full-stack']);
    expect(clean.location).toBe('Lagos, Nigeria');
    expect(clean.proofLinks).toEqual(FULL.proofLinks);
    expect(clean.background).toEqual(['I ran a studio.']);
    expect(readProfileMd(writeProfileMd(clean))).toEqual(clean);
  });

  it('finds proof links that are not web addresses', () => {
    const profile = {
      ...FULL,
      proofLinks: [
        { url: 'https://fine.example', line: 'Fine' },
        { url: '', line: 'A line with no link' },
        { url: 'javascript:alert(1)', line: 'Not a web address' },
        { url: '', line: '' },
      ],
    };
    expect(badProofLinks(profile)).toEqual([1, 2]);
  });
});

describe('required fields (FR-3.6)', () => {
  it('names every required field for a missing profile', () => {
    expect(missingFields(null)).toEqual(['roles', 'skills', 'location', 'floor']);
  });

  it('names only the empty ones', () => {
    expect(missingFields({ ...FULL, skills: [], floor: '  ' })).toEqual(['skills', 'floor']);
    expect(missingFields(FULL)).toEqual([]);
  });
});

describe('list helpers', () => {
  it('splits on commas and new lines', () => {
    expect(splitItems(' React,  TypeScript \n Motion ,')).toEqual(['React', 'TypeScript', 'Motion']);
  });

  it('adds only new items, ignoring case', () => {
    expect(addItems(['React'], ['react', 'Vue'])).toEqual(['React', 'Vue']);
  });
});
