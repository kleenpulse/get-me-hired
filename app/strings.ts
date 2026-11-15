// Every piece of interface text lives in this file (NFR-9), in plain English at
// about an 8th-grade level. Explain a term the first time it shows up. Keep the
// primary button labels to 4 words or fewer: they are shown in capitals.

import type { DropReason, HuntStepId } from '@/core/hunt';
import type { Attention, ContactLabel, LeadStatus, Signal, Tier } from '@/core/lead';
import type { RemotePreference, RequiredField } from '@/core/profile';
import type { NewGroup, TodayGroup } from '@/core/ranking';

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "a", "a and b", "a, b and c". */
export const listWords = (items: readonly string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

const fieldNames: Record<RequiredField, string> = {
  roles: 'the roles you want',
  skills: 'your skills',
  location: 'where you live',
  floor: 'your pay floor',
};

/** "the roles you want and your pay floor", for the fields still empty (AC-3.6). */
const missingWords = (fields: readonly RequiredField[]) => listWords(fields.map((field) => fieldNames[field]));

export const strings = {
  appName: 'Get Me Hired',
  skipToContent: 'Skip to the main content',
  loading: 'Loading your leads…',
  unknown: 'unknown',

  nav: {
    label: 'Main',
    today: 'Today',
    board: 'Board',
    profile: 'Profile',
    data: 'Data',
  },

  welcome: {
    stepOf: (step: number, total: number) => `Step ${step} of ${total}`,
    continue: 'Continue',
    back: 'Back',
    start: 'Get started',
    does: {
      title: 'Find about 20 people worth emailing, every day',
      lead: 'Job boards put you in a pile of hundreds. Get Me Hired looks where the pile is small.',
      points: [
        'Fresh hiring posts: under a day old, before the crowd arrives.',
        'Startups that just raised money. This is called a seed round, and it is usually when they start hiring.',
        'For each one: who to write to, how sure we are of their address, and facts worth mentioning.',
      ],
    },
    wont: {
      title: 'What it will never do',
      lead: 'These rules are built in. There is no setting to turn them off.',
      points: [
        'It never writes or sends your emails. A short email in your own words works better.',
        'It never logs in to LinkedIn or X to read posts.',
        'It never uses leaked or bought contact lists.',
        'It never tests an address by talking to a mail server.',
      ],
    },
    cost: {
      title: 'What it costs, and where your data lives',
      costTitle: 'Cost',
      cost: 'The app is free. Searching uses an AI service that you connect with your own key, which is a password-like code from that service. You pay them directly, and the app shows the cost before each search.',
      storageTitle: 'Your data',
      storage: (browser: string) =>
        `Everything is saved in ${browser} on this device, and nowhere else. If you clear this browser's data, your leads are deleted too.`,
      contactsNote:
        'You decide how to use the contact details you find. Follow the laws where you and they live, for example GDPR in Europe.',
    },
  },

  today: {
    title: 'Today',
    counterLabel: 'Emailed today',
    counter: (done: number, target: number) => `${done} of ${target}`,
    counterCaption: 'people emailed today',
    notRun: 'Not run today',
    hunting: 'Hunting…',
    hunted: (time: string) => `Hunted ${time}`,
    groupsLabel: 'Show',
    all: 'Everyone',
    groups: {
      followup: 'Follow-ups',
      attention: 'Back on your list',
      post: 'Fresh posts',
      funding: 'Just raised',
      community: 'Community',
    } satisfies Record<TodayGroup, string>,
    people: (count: number) => plural(count, 'person', 'people'),
    runHunt: "Run today's hunt",
    runSampleHunt: 'Run a sample hunt',
    huntNeedsProfile: (fields: readonly RequiredField[]) =>
      `Before a hunt can run, add ${missingWords(fields)} to your profile.`,
    huntNeedsKey:
      'Real hunts are not built yet in this early version. You can run a sample hunt to see how it works.',
    sampleHuntNote: 'A sample hunt searches nothing and sends nothing to any service.',
    leftOut: (count: number) =>
      `${plural(count, 'more lead is', 'more leads are')} waiting. They will show once you get through today's list.`,
    empty: {
      noProfile: {
        title: "Let's set up your profile first",
        body: 'The hunt uses it to find leads that fit you. You can also look around with invented sample leads.',
        action: 'Set up profile',
        sample: 'Try with sample data',
      },
      first: {
        title: 'Nothing here yet',
        body: 'This early version cannot run a real hunt yet. You can look around with sample leads. They are invented, and they are always labelled.',
        action: 'Try with sample data',
      },
      sampleReady: {
        title: 'Run your first sample hunt',
        body: 'It plays back invented results, so you can see how a hunt works before you add a key.',
      },
      done: {
        title: 'You are done for today',
        body: (emailed: number, followups: number) =>
          `${plural(emailed, 'person', 'people')} emailed, ${plural(followups, 'follow-up', 'follow-ups')} sent.`,
        action: 'View the Board',
      },
      filtered: {
        title: 'Nobody in this group today',
        action: 'Show everyone',
      },
    },
    sampleBanner: 'These are sample leads. The companies, people and addresses are invented.',
    clearSample: 'Remove sample data',
  },

  hunt: {
    title: 'Hunt in progress',
    sampleTitle: 'Sample hunt in progress',
    steps: {
      posts: 'Searching for fresh hiring posts',
      freshness: 'Checking each post is under a day old',
      funding: 'Looking for startups that just raised money',
      community: 'Reading community job threads',
      contacts: 'Finding people and how to reach them',
    } satisfies Record<HuntStepId, string>,
    stepCount: (count: number) => `${count} checked`,
    stepStates: { waiting: 'Waiting', running: 'Running now', done: 'Done', failed: 'Failed' },
    tally: (kept: number, dropped: number) => `Kept ${kept} · Dropped ${dropped}`,
    cancel: 'Cancel',
    finished: (kept: number) => `Hunt finished. ${plural(kept, 'new lead', 'new leads')} added.`,
    cancelled: (kept: number) => `Hunt cancelled. ${plural(kept, 'lead', 'leads')} found so far were kept.`,
    nothingNew: 'Hunt finished. Nothing new today.',
  },

  lead: {
    sample: 'Sample',
    tier: (tier: Tier) => `Tier ${tier}`,
    why: {
      followup: (number: number, due: string) => `Follow-up ${number} was due ${due}`,
      followupToday: (number: number) => `Follow-up ${number} is due today`,
      attention: {
        'new-signal': 'New signal from a company you already know',
        'back-from-not-now': 'Back from Not now',
      } satisfies Record<Attention, string>,
      group: {
        post: 'Fresh post',
        funding: 'Just raised',
        community: 'Community thread',
      } satisfies Record<NewGroup, string>,
      ageUnknown: 'age unknown',
    },
    age: {
      underHour: 'under 1h old',
      hours: (hours: number) => `${hours}h old`,
      days: (days: number) => `${plural(days, 'day', 'days')} old`,
      roundDays: (days: number) => (days === 0 ? 'today' : `${plural(days, 'day', 'days')} ago`),
      about: (text: string) => `about ${text}`,
      unknown: 'Age unknown',
    },
    facts: {
      posted: 'Posted',
      announced: 'Announced',
      likes: 'Reactions',
      likesUnknown: 'Reactions unknown',
      round: 'Round',
      role: 'Role',
      noRole: 'No open role listed',
      location: 'Location',
    },
    signals: {
      'pay-unknown': 'Pay unknown',
      relocation: 'Needs a move',
      'visa-unknown': 'Visa help unknown',
      'seniority-stretch': 'Senior for you',
      'outside-domains': 'Outside your fields',
      'no-open-role': 'No open role',
      'equity-only': 'Equity only',
      timezone: 'Far time zone',
      'guess-only': 'Guessed addresses only',
      'dm-or-form': 'Asked for a DM or form',
    } satisfies Record<Signal, string>,
    signalsLabel: 'Things to know',
    fitLabel: 'Why it fits',
    peopleLabel: 'People',
    peopleProgress: (emailed: number, total: number) => `${emailed} of ${total} emailed`,
    noPeople: 'Nobody found to write to yet.',
    labels: {
      published: 'Published',
      pattern: 'Pattern',
      guess: 'Guess',
    } satisfies Record<ContactLabel, string>,
    foundOn: 'See where it is written',
    patternFrom: (example: string) => `Built from ${example}`,
    verify: 'Verify before sending',
    verifyWhy: 'Why?',
    verifyExplain: {
      pattern:
        'We built this address from the way the company writes its other addresses. It is likely right, but nobody published it. Check it with your own tool before you send.',
      guess:
        'We found no proof for this address. It is a guess from the person’s first name. Check it with your own tool before you send.',
    },
    asked: 'What the post asked for',
    askedMethods: { dm: 'A direct message on', form: 'This form', apply: 'This apply page' },
    copy: (address: string) => `Copy ${address}`,
    copied: 'Copied',
    openMail: (name: string) => `Open your mail app to write to ${name}`,
    markEmailed: 'Mark as emailed',
    markFollowup: (number: number) => `Mark follow-up ${number} as sent`,
    emailedOn: (date: string) => `Emailed ${date}`,
    followupSentOn: (number: number, date: string) => `Follow-up ${number} sent ${date}`,
    undo: 'Undo',
    hooksLabel: 'Facts you can mention',
    hooksNote: 'These are facts, not email text. Write the email in your own words.',
    hookSource: 'Source',
    sourcesLabel: 'Where this lead came from',
    sourceKinds: { post: 'Hiring post', funding: 'Funding news', community: 'Community thread' },
    details: 'Details',
    close: 'Close',
    history: 'History',
    historyEntry: (status: string, date: string) => `${status} on ${date}`,
    moveTo: 'Move to',
    moveToFor: (company: string) => `Move ${company} to`,
  },

  statuses: {
    new: 'New',
    emailed: 'Emailed',
    replied: 'Replied',
    call: 'Call',
    offer: 'Offer',
    'not-now': 'Not now',
    'no-reply': 'No reply',
    rejected: 'Rejected',
    skip: 'Skip',
  } satisfies Record<LeadStatus, string>,

  board: {
    title: 'Board',
    intro: 'Every lead, from found to offer. Move a lead with its "Move to" menu.',
    count: (count: number) => plural(count, 'lead', 'leads'),
    emptyColumn: 'Nothing here.',
    moved: (company: string, status: string) => `${company} moved to ${status}.`,
    empty: {
      title: 'No leads yet',
      body: 'Leads show up here after a hunt.',
      action: 'Go to Today',
    },
  },

  profile: {
    title: 'Your profile',
    intro:
      'The hunt reads this to decide which leads fit you. Answer in your own words. Nothing is saved until you press Save profile.',
    required: 'Required',
    missing: (fields: readonly RequiredField[]) => `Before a hunt can run, add ${missingWords(fields)}.`,
    complete: 'Your profile has everything a hunt needs.',
    groups: {
      basics: { title: 'The five questions', caption: 'The same five questions the Get Me Hired skill asks.' },
      prefer: { title: 'What you prefer', caption: 'Leads outside these get a tag, but they stay on your list.' },
      skip: { title: 'What to skip', caption: 'Leads that match these are dropped.' },
      moving: { title: 'Moving and visas', caption: 'Fill these in only if they matter to you.' },
      background: {
        title: 'About you',
        caption: 'Facts the hunt can link to a company, so you have something real to mention.',
      },
    },
    fields: {
      roles: {
        label: 'Roles you want',
        help: 'Type a role and press Enter. Add as many as you like.',
        examples: ['Frontend engineer', 'Design engineer', 'Full-stack engineer', 'Product designer'],
      },
      skills: {
        label: 'Your skills and tools',
        help: 'The tools you use and what you are best at.',
        examples: ['TypeScript', 'React', 'Python', 'Figma'],
      },
      location: { label: 'Where you live', help: 'City and country, for example "Lagos, Nigeria".', placeholder: 'City, country' },
      remote: {
        label: 'How you want to work',
        options: {
          remote: 'Remote only',
          hybrid: 'Remote or hybrid',
          any: 'Remote, hybrid or in an office',
        } satisfies Record<RemotePreference, string>,
      },
      timeZone: { label: 'Your time zone', help: 'For example "UTC+1". Leads far from it get a tag.', placeholder: 'UTC+1' },
      floor: {
        label: 'Your pay floor',
        help: 'The least you would take, for example "$60k a year". Jobs that pay less are dropped.',
        placeholder: '$60k a year',
      },
      proofLinks: {
        label: 'Proof links',
        help: '2 to 4 things you built. Each one gets a link and one line about it.',
        item: (number: number) => `Proof link ${number}`,
        url: 'Link',
        line: 'One line about it',
        add: 'Add a proof link',
        remove: (number: number) => `Remove proof link ${number}`,
        bad: 'This needs a web address that starts with https://',
      },
      domains: {
        label: 'Fields you care about',
        help: 'The kinds of companies you want to work for.',
        examples: ['AI dev tools', 'Fintech', 'Design tools', 'Climate', 'Health', 'Education'],
      },
      stages: {
        label: 'Company stages',
        help: 'How far along a company is. Seed means it just raised its first real money.',
        examples: ['Pre-seed', 'Seed', 'Series A', 'Series B or later'],
      },
      teamSize: { label: 'Team size', help: 'For example "under 20 people".', placeholder: 'Under 20 people' },
      skipCompanies: {
        label: 'Companies or fields to skip',
        help: 'Names or kinds of companies you never want to see.',
        examples: ['Ad tech', 'Gambling', 'Crypto'],
      },
      skipRoles: {
        label: 'Roles to skip',
        help: 'Kinds of jobs you do not want.',
        examples: ['Mobile only', 'QA', 'Sales engineer'],
      },
      relocation: {
        label: 'Would you move for a job?',
        help: 'For example "only for at least $90k with visa help". Leave it empty if you would not move.',
      },
      visa: { label: 'Visa needs', help: 'For example "I need a visa to work in the US".' },
      background: {
        label: 'Facts about you',
        help: 'One fact each, for example "I ran a design studio for 3 years".',
        item: (number: number) => `Fact ${number}`,
        add: 'Add a fact',
        remove: (number: number) => `Remove fact ${number}`,
      },
    },
    chips: {
      examples: 'Ideas:',
      add: (item: string) => `Add ${item}`,
      remove: (item: string) => `Remove ${item}`,
      added: (item: string) => `${item} added.`,
      removed: (item: string) => `${item} removed.`,
    },
    save: 'Save profile',
    saved: 'Profile saved.',
    unsaved: 'You have changes that are not saved yet.',
    allSaved: 'All changes are saved.',
    /** With saving off, the profile lives only until the tab closes. */
    savedForNow: 'Profile kept for this visit. Saving is off, so it is lost when you close this tab.',
    allSavedForNow: 'Saving is off. Download profile.md to keep a copy.',
    fixFirst: 'Fix the proof links marked below, then save.',
    leave: 'Your profile has changes that are not saved. Leave without saving?',
    file: {
      title: 'profile.md',
      body: 'The same file the Get Me Hired skill uses. Download it to keep a copy, or open one to fill in this form.',
      download: 'Download profile.md',
      open: 'Open a profile.md',
      opened: 'Loaded from the file. Check it, then press Save profile.',
      notProfile: 'This file does not look like a profile.md. It needs a "Five questions" heading.',
      tooBig: 'This file is too big to be a profile.md.',
      unreadable: 'This file could not be read.',
    },
  },

  dropReasons: {
    stale: 'Too old',
    'too-popular': 'Too many reactions',
    recruiter: 'Posted by a recruiter',
    'role-mismatch': 'Different kind of role',
    location: 'Wrong location',
    'pay-below-floor': 'Pay below your floor',
    'skip-list': 'On your skip list',
    'do-not-contact': 'On your do-not-contact list',
    duplicate: 'Already in your leads',
    unverifiable: 'Could not be confirmed',
  } satisfies Record<DropReason, string>,

  data: {
    title: 'Data',
    storage: {
      title: 'Where your data lives',
      body: (browser: string) =>
        `Your leads are saved in ${browser} on this device. Nothing is sent to us: there is no account and no server.`,
      persistent: {
        granted: 'This browser agreed to keep your data, even when space runs low.',
        denied: 'This browser may delete your data when space runs low. Installing the app usually fixes this.',
        unsupported: 'This browser cannot promise to keep your data when space runs low.',
        unknown: 'Checking how safely your data is stored…',
      },
      warning: 'If you clear this browser’s data, your leads are deleted too. Backups come in a later version.',
      savingOff: (browser: string) =>
        `Saving is off: ${browser} is not letting Get Me Hired store data. Your leads and profile last only until you close this tab.`,
    },
    sample: {
      title: 'Sample data',
      on: 'Sample mode is on. Sample leads are invented and always labelled.',
      off: 'Sample mode is off.',
      turnOn: 'Try with sample data',
      turnOff: 'Remove sample data',
    },
    deleteAll: {
      title: 'Delete everything',
      body: 'This wipes your profile and every lead and setting from this browser. It cannot be undone.',
      open: 'Delete everything…',
      confirmTitle: 'Delete everything?',
      confirmBody: 'Your profile and every lead and setting in this browser will be wiped. This cannot be undone.',
      typeLabel: 'Type DELETE to confirm',
      word: 'DELETE',
      confirm: 'Delete everything',
      failed: 'Your data could not be deleted, and nothing was changed. Try again.',
      cancel: 'Keep my data',
    },
    browsers: { chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox', safari: 'Safari', other: 'this browser' },
  },

  errors: {
    title: 'Something went wrong',
    storage: 'Your data could not be saved in this browser. Changes you make now may be lost when you close the tab.',
    savingOff:
      'Saving is off, because this browser is not letting Get Me Hired store data. Everything you do here is lost when you close this tab.',
    load: {
      broken: {
        title: 'Your saved data could not be opened',
        body: 'Nothing has been changed or deleted. Reload the page to try again.',
        action: 'Try again',
      },
      blocked: {
        title: 'This browser is not letting Get Me Hired save data',
        body: 'Get Me Hired keeps everything in this browser, so it needs to store data here. If you block cookies or site data, allow them for this site, then try again. Some private windows do not allow it either.',
        action: 'Try again',
        continue: 'Continue without saving',
        continueNote: 'You can look around, but nothing you do will be kept after you close this tab.',
      },
      newer: {
        title: 'Update the app first',
        body: 'Your data was saved by a newer version of Get Me Hired. Reload the page to get the newest version. Nothing has been changed or deleted.',
        action: 'Reload the page',
      },
    },
  },
} as const;
