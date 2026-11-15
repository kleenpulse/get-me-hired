// Invented leads for "Try with sample data" (FR-1.4). Every company, person
// and address here is made up, and every lead is marked `sample` so the app
// can label it. Every link points at a `.example` address, which can never be
// a real site. Dates are set relative to now, so the list always looks alive.

import { addDays, localDate } from './dates';
import type { Contact, Hook, Lead, LeadSource, LeadStatus, Person, Signal } from './lead';
import { leadKey } from './lead-key';
import type { LeadType } from './leads-csv';
import { computeTier } from './ranking';

const HOUR_MS = 3_600_000;

interface SampleSpec {
  type: LeadType;
  company: string;
  about: string;
  role: string;
  fit: string;
  /** How long ago it was published, in hours. `null` when the age is unknown. */
  hoursAgo: number | null;
  approx?: boolean;
  likes: Lead['likes'];
  round?: string;
  location: string;
  sourceKind: LeadSource['kind'];
  sourcePath: string;
  people: { name: string; role: string; contacts: Contact[] }[];
  hooks: Hook[];
  signals: Signal[];
}

function site(company: string): string {
  return `https://${company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example`;
}

function person(spec: SampleSpec['people'][number]): Person {
  return { ...spec, emailedOn: [], followupsSent: [] };
}

function build(spec: SampleSpec, now: Date, status: LeadStatus = 'new'): Lead {
  const today = localDate(now);
  const sourceUrl = `${site(spec.company)}${spec.sourcePath}`;
  const people = spec.people.map(person);
  return {
    key: leadKey(sourceUrl, spec.company),
    foundOn: today,
    type: spec.type,
    company: spec.company,
    companyUrl: site(spec.company),
    about: spec.about,
    role: spec.role,
    fit: spec.fit,
    postedAt: spec.hoursAgo === null ? null : new Date(now.getTime() - spec.hoursAgo * HOUR_MS).toISOString(),
    postedAtApprox: spec.approx ?? false,
    likes: spec.likes,
    round: spec.round ?? '',
    location: spec.location,
    people,
    hooks: spec.hooks,
    sources: [{ kind: spec.sourceKind, url: sourceUrl, seen: today }],
    signals: spec.signals,
    tier: computeTier({ type: spec.type, signals: spec.signals, people }),
    status,
    statusHistory: [{ status: 'new', at: now.toISOString() }],
    snoozeUntil: null,
    attention: null,
    notes: '',
    sample: true,
  };
}

const NORTHPEAK: SampleSpec = {
  type: 'post',
  company: 'Northpeak Labs',
  about: 'A design tool for product teams.',
  role: 'Design Engineer',
  fit: 'React and motion work, close to the component library in your profile.',
  hoursAgo: 4.2,
  likes: 7,
  location: 'Remote, worldwide',
  sourceKind: 'post',
  sourcePath: '/sample-post',
  people: [
    {
      name: 'Ada Quill',
      role: 'CEO, wrote the post',
      contacts: [
        {
          method: 'email',
          value: 'ada@northpeaklabs.example',
          label: 'published',
          evidence: 'https://northpeaklabs.example/team',
        },
        { method: 'dm', value: 'LinkedIn' },
      ],
    },
  ],
  hooks: [
    { text: 'The post asks for "someone who sweats animation".', url: 'https://northpeaklabs.example/sample-post' },
    { text: 'They shipped a new editor last week.', url: 'https://northpeaklabs.example/blog/editor' },
  ],
  signals: ['dm-or-form'],
};

const KESTREL: SampleSpec = {
  type: 'post',
  company: 'Kestrel Works',
  about: 'Scheduling software for small clinics.',
  role: 'Founding Engineer',
  fit: 'A small team that wants a frontend-heavy generalist, like the roles in your profile.',
  hoursAgo: 19,
  likes: 'unknown',
  location: 'Remote, any time zone',
  sourceKind: 'post',
  sourcePath: '/sample-post',
  people: [
    {
      name: 'Ivy Noor',
      role: 'Founder, wrote the post',
      contacts: [{ method: 'email', value: 'ivy@kestrelworks.example', label: 'guess' }],
    },
  ],
  hooks: [{ text: 'The post says they signed their first 3 clinics.', url: 'https://kestrelworks.example/sample-post' }],
  signals: ['guess-only', 'pay-unknown'],
};

const TIDEWATER: SampleSpec = {
  type: 'funding',
  company: 'Tidewater AI',
  about: 'Tools that help developers build AI agents.',
  role: '',
  fit: 'Their product is built in TypeScript, the main skill in your profile.',
  hoursAgo: 3 * 24,
  likes: 'n/a',
  round: '$4M seed (Lumen Ridge Capital)',
  location: 'Remote',
  sourceKind: 'funding',
  sourcePath: '/blog/we-raised',
  people: [
    {
      name: 'Bo Ferris',
      role: 'CEO',
      contacts: [
        {
          method: 'email',
          value: 'bo@tidewaterai.example',
          label: 'pattern',
          evidence: 'press@tidewaterai.example',
        },
      ],
    },
    {
      name: 'Cy Marlow',
      role: 'CTO',
      contacts: [{ method: 'email', value: 'cy@tidewaterai.example', label: 'guess' }],
    },
    {
      name: 'Dee Okon',
      role: 'Head of Design',
      contacts: [{ method: 'email', value: 'dee@tidewaterai.example', label: 'guess' }],
    },
  ],
  hooks: [
    { text: 'They announced the round themselves, 3 days ago.', url: 'https://tidewaterai.example/blog/we-raised' },
    { text: 'The announcement says they will "double the team this year".', url: 'https://tidewaterai.example/blog/we-raised' },
  ],
  signals: ['no-open-role', 'pay-unknown'],
};

const LARKSPUR: SampleSpec = {
  type: 'funding',
  company: 'Larkspur',
  about: 'Payroll for remote teams.',
  role: 'Product Engineer',
  fit: 'An open product engineer role on a small team.',
  hoursAgo: 6 * 24,
  likes: 'n/a',
  round: '$1.2M pre-seed',
  location: 'Berlin, on site',
  sourceKind: 'funding',
  sourcePath: '/news/pre-seed',
  people: [
    {
      name: 'Jo Vance',
      role: 'CEO',
      contacts: [
        { method: 'email', value: 'jo@larkspur.example', label: 'guess' },
        { method: 'apply', value: 'https://larkspur.example/jobs/product-engineer' },
      ],
    },
  ],
  hooks: [{ text: 'The founder wrote the announcement herself.', url: 'https://larkspur.example/news/pre-seed' }],
  signals: ['relocation', 'visa-unknown', 'pay-unknown', 'guess-only'],
};

const HARBOR: SampleSpec = {
  type: 'post',
  company: 'Harbor Grid',
  about: 'Energy monitoring for factories.',
  role: 'Senior Frontend Engineer',
  fit: 'Remote, and a TypeScript and React stack that matches your skills.',
  hoursAgo: 11 * 24,
  approx: true,
  likes: 'n/a',
  location: 'Remote, CET hours',
  sourceKind: 'community',
  sourcePath: '/sample-hiring-thread',
  people: [
    {
      name: 'Gus Hale',
      role: 'CTO',
      contacts: [
        {
          method: 'email',
          value: 'jobs@harborgrid.example',
          label: 'published',
          evidence: 'https://harborgrid.example/sample-hiring-thread',
        },
      ],
    },
  ],
  hooks: [{ text: 'The comment says the team is 6 people and ships every week.', url: 'https://harborgrid.example/sample-hiring-thread' }],
  signals: ['timezone'],
};

const QUARRY: SampleSpec = {
  type: 'post',
  company: 'Quarry & Finch',
  about: 'Bookkeeping for freelancers.',
  role: 'Full-stack Engineer',
  fit: 'Their first full-stack hire, with a Next.js stack like yours.',
  hoursAgo: 8 * 24,
  likes: 12,
  location: 'Remote, worldwide',
  sourceKind: 'post',
  sourcePath: '/sample-post',
  people: [
    {
      name: 'Eve Quarry',
      role: 'CEO, wrote the post',
      contacts: [
        {
          method: 'email',
          value: 'eve@quarryfinch.example',
          label: 'published',
          evidence: 'https://quarryfinch.example/contact',
        },
      ],
    },
  ],
  hooks: [{ text: 'The post says they just signed their first 3 customers.', url: 'https://quarryfinch.example/sample-post' }],
  signals: [],
};

const MOSSLINE: SampleSpec = {
  type: 'funding',
  company: 'Mossline',
  about: 'Maps for delivery drivers.',
  role: 'Frontend Engineer',
  fit: 'A map-heavy interface, close to the proof link in your profile.',
  hoursAgo: 12 * 24,
  likes: 'n/a',
  round: '$2.5M seed',
  location: 'Remote',
  sourceKind: 'funding',
  sourcePath: '/blog/seed',
  people: [
    {
      name: 'Kai Brandt',
      role: 'CTO',
      contacts: [
        {
          method: 'email',
          value: 'kai@mossline.example',
          label: 'published',
          evidence: 'https://mossline.example/team',
        },
      ],
    },
  ],
  hooks: [{ text: 'They launched their driver app this month.', url: 'https://mossline.example/blog/launch' }],
  signals: ['pay-unknown'],
};

const JUNIPER: SampleSpec = {
  type: 'post',
  company: 'Juniper Systems',
  about: 'Inventory software for bakeries.',
  role: 'Design Engineer',
  fit: 'They asked for someone who cares about small interface details.',
  hoursAgo: 15 * 24,
  likes: 31,
  location: 'Remote, worldwide',
  sourceKind: 'community',
  sourcePath: '/sample-hiring-thread',
  people: [
    {
      name: 'Lena Abara',
      role: 'Founder',
      contacts: [
        {
          method: 'email',
          value: 'lena@junipersystems.example',
          label: 'published',
          evidence: 'https://junipersystems.example/sample-hiring-thread',
        },
      ],
    },
  ],
  hooks: [{ text: 'The comment names "small interface details" as the thing they need.', url: 'https://junipersystems.example/sample-hiring-thread' }],
  signals: [],
};

/** A moment on a local calendar date, at the given hour. */
function onLocalDate(day: string, hour: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, date ?? 1, hour).toISOString();
}

/**
 * A lead found and emailed on `emailedOn`. A later status is reached `laterDays`
 * after that, so the history always agrees with the emailed date.
 */
function withEmail(lead: Lead, emailedOn: string, status: LeadStatus, laterDays = 0): Lead {
  return {
    ...lead,
    foundOn: emailedOn,
    status,
    people: lead.people.map((entry, index) => (index === 0 ? { ...entry, emailedOn: [emailedOn] } : entry)),
    statusHistory: [
      { status: 'new', at: onLocalDate(emailedOn, 9) },
      { status: 'emailed', at: onLocalDate(emailedOn, 10) },
      ...(status === 'emailed' ? [] : [{ status, at: onLocalDate(addDays(emailedOn, laterDays), 14) }]),
    ],
  };
}

/** Leads already under way, so the Board and the follow-ups have something to show. */
export function buildSamplePipeline(now: Date): Lead[] {
  const today = localDate(now);
  // Emailed a week ago: 5 working days later is today or the last working day, so a follow-up is due.
  const weekAgo = addDays(today, -7);
  return [
    withEmail(build(QUARRY, now), weekAgo, 'emailed'),
    withEmail(build(MOSSLINE, now), addDays(today, -9), 'replied', 3),
    withEmail(build(JUNIPER, now), addDays(today, -12), 'call', 5),
  ];
}

/** What the sample hunt finds, grouped by the stage that finds it. */
export function buildSampleFinds(now: Date): { posts: Lead[]; funding: Lead[]; community: Lead[] } {
  return {
    posts: [build(NORTHPEAK, now), build(KESTREL, now)],
    funding: [build(TIDEWATER, now), build(LARKSPUR, now)],
    community: [build(HARBOR, now)],
  };
}
