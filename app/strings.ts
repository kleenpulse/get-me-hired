// Every piece of interface text lives in this file (NFR-9), in plain English at
// about an 8th-grade level. Explain a term the first time it shows up. Keep the
// primary button labels to 4 words or fewer: they are shown in capitals.

import type { DropReason, HuntStepId } from '@/core/hunt';
import type { Attention, ContactLabel, LeadStatus, Signal, Tier } from '@/core/lead';
import type { RemotePreference, RequiredField } from '@/core/profile';
import type { HuntProblem } from '@/core/hunt';
import type { CheckResult, KeyProblem, ProviderChecks, ProviderId } from '@/core/providers';
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
  loadingScreen: 'Loading…',
  unknown: 'unknown',

  nav: {
    label: 'Main',
    today: 'Today',
    board: 'Board',
    drafts: 'Draft checker',
    history: 'History',
    profile: 'Profile',
    data: 'Data',
    settings: 'Settings',
    more: 'More',
  },

  settings: {
    title: 'Settings',
    day: {
      title: 'Your day',
      caption: 'How many people to write to, and when to follow up. Changes save as you make them.',
      target: 'People to write to each day',
      targetHelp: (min: number, max: number) => `A number from ${min} to ${max}. Today's list stops there.`,
      targetBad: (min: number, max: number) => `Use a whole number from ${min} to ${max}.`,
      runOnOpen: 'Run the hunt when you open the app',
      runOnOpenChoices: { off: 'Off', on: 'On' },
      runOnOpenHelp:
        'When it’s on, opening the app starts today’s hunt on its own if it hasn’t run yet today. Like a hunt you start, it sends your profile to your AI provider and counts toward your monthly cap. The app can’t run while its tab is closed.',
      followups: 'Follow-ups',
      followupsHelp: 'How many short follow-ups to send when someone hasn’t replied.',
      followupCount: (count: number) => (count === 0 ? 'None' : String(count)),
      delay: (number: number) => `Working days before follow-up ${number}`,
      closeAfter: 'Working days after the last email before a lead moves to No reply',
      daysHelp: (min: number, max: number) => `${min} to ${max} working days (Monday to Friday).`,
      daysBad: (min: number, max: number) => `Use a whole number from ${min} to ${max}.`,
      save: 'Save follow-up rules',
      saved: 'Follow-up rules saved.',
      closes: (count: number) =>
        `With these rules, ${plural(count, 'emailed lead', 'emailed leads')} would move to No reply today. Save anyway?`,
    },
    passphrase: {
      title: 'Key passphrase',
      account: 'Get Me Hired keys',
      caption: 'Optional. It encrypts the keys stored in this browser.',
      what: 'Someone who later reads this browser’s storage, as on a shared computer, can’t use your keys without it. It doesn’t protect a tab while it’s unlocked.',
      perTab: 'You enter it once in each tab. Reloading the page asks again.',
      dontSave: 'On a shared computer, don’t let your browser save this passphrase. A saved one fills itself in, and anyone could unlock your keys.',
      noRecovery: 'There’s no way to get it back. If you forget it, you’ll have to remove your keys and add them again.',
      none: 'Your keys are stored without a passphrase.',
      locked: 'Your keys are encrypted and locked in this tab.',
      unlockedNote: 'Your keys are encrypted. They’re unlocked in this tab.',
      label: 'Passphrase',
      confirm: 'Type it again',
      newLabel: 'New passphrase',
      tooShort: (min: number) => `Use at least ${min} characters.`,
      different: 'The two don’t match.',
      set: 'Encrypt my keys',
      change: 'Change passphrase',
      unlock: 'Unlock',
      unlocking: 'Checking…',
      wrong: 'That passphrase isn’t right.',
      lockNow: 'Lock now',
      remove: 'Remove passphrase',
      removeConfirm: 'Store your keys without a passphrase? Anyone who can read this browser’s storage could then use them.',
      forgot: 'I forgot it',
      forgotConfirm: 'Remove every stored key? They can’t be unlocked without the passphrase. You can add them again from each provider.',
      saved: 'Your keys are encrypted.',
      changed: 'Passphrase changed.',
      removed: 'Your keys are stored without a passphrase now.',
      forgotten: 'Your keys were removed.',
      failed: 'That didn’t work, and nothing was changed. Try again.',
      savingOff: 'Nothing is stored in this browser right now, so there are no keys to encrypt.',
      damaged: 'Your stored keys are damaged and can’t be opened, even with the right passphrase. Remove them, then add your keys again.',
      damagedConfirm: 'Remove the damaged keys? You can add them again from each provider.',
      removeDamaged: 'Remove the damaged keys',
      damagedKeyCard: 'Your stored keys are damaged. Remove them in the Key passphrase card, then add your key again.',
      lockedKeyCard: 'Your keys are locked. Unlock them in the Key passphrase card to test, add or remove a key.',
    },
    retention: {
      title: 'Keeping data',
      caption: 'How long the app keeps details about people on leads that ended.',
      save: 'Save',
      saved: 'Saved.',
      days: 'Days to keep them',
      daysHelp: (min: number, max: number) => `A whole number from ${min} to ${max}.`,
      daysBad: (min: number, max: number) => `Use a whole number from ${min} to ${max}.`,
      what: (days: number) =>
        `${days} days after a lead is skipped, rejected or gets no reply, the names and contact details of its people are removed, here and in your saved reports. The company and how it ended stay. Reports older than ${days} days are deleted, and their counts stay in History.`,
      blockList: 'Your do-not-contact list is kept until you remove an entry.',
      backups: 'A backup you downloaded earlier still holds what it held then.',
      confirm: (leads: number, reports: number) =>
        `With ${leads} ${leads === 1 ? 'closed lead' : 'closed leads'} and ${reports} ${reports === 1 ? 'report' : 'reports'} past this period, they would be cleared now. Go ahead?`,
    },
    sources: {
      title: 'Sources',
      caption: 'Where a hunt looks. It saves as you choose.',
      community: 'Hacker News “Who is hiring?” thread',
      choices: { off: 'Off', on: 'On' },
      communityHelp: 'Openings posted in this month’s thread, checked against your profile.',
      unavailable: 'Not available yet',
      funding: 'Funding news',
      fundingWhy: 'Off until the app has a page reader that returns links, so each round can be checked at its own article.',
      posts: 'Fresh hiring posts',
      postsWhy: 'Off until the app can use web search, which needs a billed key.',
    },
    spend: {
      title: 'Spending',
      caption: 'A limit on what hunts can cost each month. It saves as you type.',
      cap: 'Monthly cap in US dollars',
      capHelp: (min: number, max: number) => `A whole number from ${min} to ${max}. A hunt stops before it could go past it.`,
      capBad: (min: number, max: number) => `Use a whole number from ${min} to ${max}.`,
      billing: (checkedOn: string) =>
        `Costs are worked out at each provider's list price, from prices checked on ${checkedOn}. The app can't see whether your key is billed. On a free tier you pay nothing, but hunts still count toward the cap here.`,
      month: (spent: string, cap: string) => `This month so far: about ${spent} of your ${cap} cap.`,
      partial: 'Some calls didn’t report what they used, so the real total may be higher.',
    },
    look: {
      title: 'Look',
      caption: 'Saved in this browser.',
      theme: 'Theme',
      themes: { system: 'Match this device', light: 'Light', dark: 'Dark' },
      textSize: 'Text size',
      textSizes: { normal: 'Normal', large: 'Large', larger: 'Larger' },
    },
    provider: {
      title: 'AI provider',
      caption: 'The service that searches and reads web pages for your hunts. You connect it with your own key.',
      using: (name: string) => `Hunts use ${name}.`,
      none: 'No provider is connected yet.',
      listLabel: 'Choose a provider',
      about: {
        gemini: 'Recommended. Free, but web search needs billing on.',
        openrouter: 'Many models, some free. Web search costs credit.',
        anthropic: 'Coming later',
        openai: 'Coming later',
      } satisfies Record<ProviderId, string>,
      keySaved: 'Key saved',
      inUse: 'In use',
      checks: {
        title: 'What it can do',
        names: {
          browser: 'Works straight from this browser',
          structured: 'Returns lead data the app can check',
          search: 'Searches the web for fresh posts',
        } satisfies Record<keyof ProviderChecks, string>,
        results: {
          yes: 'Yes',
          paid: 'Paid only',
          'paid-untested': 'Needs billing. Not checked yet',
          untested: 'Not checked yet',
        } satisfies Record<CheckResult, string>,
        searchNote: {
          gemini:
            "Gemini's free tier has no web search. Google says it needs billing turned on, with 5,000 searches a month free, then a charge. We haven't tested it with billing on yet. Without search, hunts still read Hacker News and funding news, but cannot find fresh LinkedIn or X posts.",
          openrouter:
            'Each web search costs about 1 cent of OpenRouter credit. Without credit, hunts still read Hacker News and funding news, but cannot find fresh LinkedIn or X posts.',
          anthropic: '',
          openai: '',
        } satisfies Record<ProviderId, string>,
      },
      notOffered: (names: readonly string[]) =>
        `${listWords(names)} ${names.length === 1 ? 'is' : 'are'} not offered yet. We have not confirmed that ${names.length === 1 ? 'it works' : 'they work'} from a browser with a real key.`,
    },
    key: {
      title: (name: string) => `Your ${name} key`,
      steps: {
        gemini: [
          'Open Google AI Studio and sign in with your Google account.',
          'Press "Create API key", then copy the key.',
          'Paste it below and press Test key.',
        ],
        openrouter: [
          'Open OpenRouter and sign in.',
          'Create a key, then copy it.',
          'Paste it below and press Test key.',
        ],
        anthropic: [],
        openai: [],
      } satisfies Record<ProviderId, readonly string[]>,
      openKeyPage: (name: string) => `Get a key from ${name}`,
      opensNewTab: '(opens in a new tab)',
      label: 'Key',
      replaceLabel: 'New key',
      show: 'Show key',
      hide: 'Hide key',
      paste: 'Paste',
      pasteFailed: 'This browser did not allow pasting. Paste into the box with your keyboard instead.',
      test: 'Test key',
      testing: 'Testing…',
      testNote: (name: string) =>
        `The test sends one tiny request to ${name}. On a free tier it costs nothing. The key is saved only if it works.`,
      empty: 'Paste a key first.',
      connected: (name: string) => `Connected. Your ${name} key works, and it is saved in this browser.`,
      connectedForNow: (name: string) =>
        `Connected. Your ${name} key works. Saving is off, so it is kept only until you close this tab.`,
      problems: {
        'wrong-key': (name: string) => `This key didn't work with ${name}. Check that you copied all of it.`,
        'no-credit': (name: string) => `Your ${name} account is out of credit.`,
        'rate-limited': (name: string) => `${name} asked us to slow down. Wait a minute, then try again.`,
        'provider-down': (name: string) => `${name} isn't answering right now. Try again in a few minutes.`,
        'missing-capability': (name: string) => `${name} can't do what a hunt needs with this key.`,
        'no-connection': (name: string) => `We couldn't reach ${name}. Check your internet connection.`,
        timeout: (name: string) => `${name} didn't answer within 10 seconds. Try again.`,
        unknown: (name: string) => `The test with ${name} failed, and we couldn't tell why. Try again.`,
      } satisfies Record<KeyProblem, (name: string) => string>,
      saveFailed: 'The key works, but this browser would not save it. Try again.',
      remove: 'Remove key',
      removed: (name: string) => `Your ${name} key was removed from this browser.`,
      removeFailed: 'The key could not be removed. Try again.',
      privacy: (name: string) =>
        `Your key stays in this browser. It is sent only to ${name}, never to us, and it is never put in a backup file.`,
      shared: 'On a shared computer, anyone who uses this browser can use your key. Remove it when you are done.',
    },
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
    huntNeedsKey: 'To run a real hunt, add an AI key in Settings. Or run a sample hunt to see how it works.',
    huntReady:
      'This version reads the Hacker News hiring thread and checks each opening against your profile. Fresh posts and funding news come later.',
    sampleHuntNote: 'A sample hunt searches nothing and sends nothing to any service.',
    sourcesOff: 'Every source is off. Turn one on in Settings.',
    interrupted: {
      body: (found: number, cost: string | null) =>
        [
          'Your last hunt stopped partway.',
          found === 0 ? 'It hadn’t found any leads yet.' : found === 1 ? 'The 1 lead it found is kept.' : `The ${found} leads it found are kept.`,
          cost === null ? '' : `The ${cost} it cost at the list price counts toward your cap.`,
        ]
          .filter(Boolean)
          .join(' '),
      note: 'Running it again searches from the start and counts toward your monthly cap again.',
      runAgain: 'Run it again',
      dismiss: 'Dismiss',
    },
    keysLocked: 'Your keys are locked. Enter your passphrase in Settings to hunt.',
    huntCost: (estimate: string, spent: string, cap: string) =>
      `A hunt costs about ${estimate} at the list price, if your key is billed. This month so far: ${spent} of your ${cap} cap.`,
    huntCostFree: 'This model is free, so hunts don’t count toward your monthly cap.',
    capReached: (cap: string) => `You've reached this month's cap of ${cap}. Raise it in Settings, or wait for next month.`,
    overCap: (cap: string) =>
      `This hunt could go past this month's cap of ${cap}. Raise the cap in Settings, or wait for next month.`,
    noPrice: "This model's cost isn't known, so your monthly cap can't be kept. Choose another provider in Settings.",
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
        body: 'Add an AI key in Settings to run your first hunt. Or look around with sample leads: they are invented, and always labelled.',
        action: 'Try with sample data',
        settings: 'Add a key',
      },
      nothingYet: {
        title: 'No leads yet',
        body: 'The hunt found nothing that fits your profile. Try adding more roles or skills, or run it again tomorrow: the thread grows every day.',
        action: 'Edit profile',
      },
      readyToHunt: {
        title: 'Run your first hunt',
        body: 'Press "Run today\'s hunt". It reads the Hacker News hiring thread and keeps the openings that fit your profile.',
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
    stepStates: { waiting: 'Waiting', running: 'Running now', done: 'Done', failed: 'Failed', skipped: 'Skipped' },
    skipReasons: {
      'needs-search': 'Needs web search',
      'not-built': 'Not built yet',
      'needs-page-reader': "Needs Gemini's page reader",
      'switched-off': 'Off for now',
      'no-cost-bound': "Its cost can't be kept under your cap",
    },
    tally: (kept: number, dropped: number) => `Kept ${kept} · Dropped ${dropped}`,
    cancel: 'Cancel',
    finished: (kept: number) => `Hunt finished. ${plural(kept, 'new lead', 'new leads')} added.`,
    cancelled: (kept: number) => `Hunt cancelled. ${plural(kept, 'lead', 'leads')} found so far ${kept === 1 ? 'was' : 'were'} kept.`,
    nothingNew: 'Hunt finished. Nothing new today.',
    otherTab: 'A hunt is already running in another tab of this app. Wait for it to finish there.',
    yourProvider: 'your AI provider',
    seeReport: 'See the report',
    failedSources: (hosts: readonly string[]) => `We couldn't search ${listWords(hosts)} today.`,
    unread: (count: number) =>
      `We couldn't check ${plural(count, 'possible lead', 'possible leads')} this time. Run the hunt again later to try them.`,
    /** Why a hunt stopped, in one or two sentences. Shared by the banner and the run report. */
    failedWhy: (problem: HuntProblem, provider: string, cap?: { usd: string; partial: boolean }) =>
      problem === 'cap-reached'
        ? [
            cap ? `You've reached this month's cap of ${cap.usd}.` : "You've reached this month's spending cap.",
            cap?.partial ? 'Some calls didn’t report what they used, so the real total may be higher.' : '',
            'Raise it in Settings, or wait for next month.',
          ]
            .filter(Boolean)
            .join(' ')
        : problem === 'hn-down'
        ? "Hacker News isn't answering right now. Try again later."
        : problem === 'rate-limited'
          ? `${provider} asked us to slow down. Try again in a few minutes.`
          : problem === 'wrong-key'
            ? `This key didn't work with ${provider}. Check it in Settings.`
            : problem === 'no-credit'
              ? `Your ${provider} account is out of credit.`
              : problem === 'no-connection'
                ? `We couldn't reach ${provider}. Check your internet connection.`
                : `Something went wrong with ${provider}. Try again.`,
    keptBeforeStop: (kept: number) => `${plural(kept, 'lead', 'leads')} found before it stopped ${kept === 1 ? 'was' : 'were'} kept.`,
    failed: (problem: HuntProblem, provider: string, kept: number, cap?: { usd: string; partial: boolean }) =>
      [`The hunt stopped.`, strings.hunt.failedWhy(problem, provider, cap), kept > 0 ? strings.hunt.keptBeforeStop(kept) : '']
        .filter(Boolean)
        .join(' '),
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
      'outside-domains': 'Doesn’t mention your fields',
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
    dontContact: 'Don’t contact',
    dontContactFor: (name: string) => `Don’t contact ${name}`,
    dontContactConfirm: (name: string, company: string) =>
      `Block ${name} at ${company}? They will be taken off this lead and left out of every hunt. You can unblock them under Data.`,
    deletePerson: 'Delete',
    deletePersonFor: (name: string) => `Delete ${name}`,
    deleteDialog: {
      title: (name: string) => `Delete ${name}?`,
      body: (company: string) =>
        `Their name and contact details will be removed from this browser, including your saved run reports. The ${company} lead stays.`,
      stays: [
        'Your own notes on this lead are kept as you wrote them, so they may still mention this person.',
        'Backups and reports you already downloaded are files on your computer. The app can’t change them.',
        'A later hunt may find this person again. To stop that, also add them to your do-not-contact list.',
      ],
      cancel: 'Cancel',
      deleteOnly: 'Delete',
      deleteAndBlock: 'Delete and don’t contact again',
    },
    notesLabel: 'Your notes',
    notesHelp: 'Only for you. They’re never sent with a hunt or to your AI provider.',
    notesLeft: (count: number) => `${count} characters left.`,
    saveNotes: 'Save notes',
    notesSaved: 'Notes saved.',
    peopleRemoved: 'The people on this lead were removed after it ended, as set in Settings → Keeping data.',
    deleted: (name: string) => `${name} was deleted.`,
    deletedAndBlocked: (name: string) => `${name} was deleted and added to your do-not-contact list.`,
    markFollowup: (number: number) => `Mark follow-up ${number} as sent`,
    emailedOn: (date: string) => `Emailed ${date}`,
    followupSentOn: (number: number, date: string) => `Follow-up ${number} sent ${date}`,
    undo: 'Undo',
    hooksLabel: 'Facts you can mention',
    hooksNote: 'These are facts, not email text. Write the email in your own words.',
    hookSource: 'Source',
    sourcesLabel: 'Where this lead came from',
    sourceKinds: { post: 'Hiring post', funding: 'Funding news', community: 'Community thread' },
    readBy: (provider: string) =>
      `The round, its date and the headline were read by ${provider} from the linked page. Not checked by the app.`,
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
    intro: 'Every lead, from found to offer. Move a lead with its "Move to" menu, or drag it to a column.',
    count: (count: number) => plural(count, 'lead', 'leads'),
    emptyColumn: 'Nothing here.',
    moved: (company: string, status: string) => `${company} moved to ${status}.`,
    undo: 'Undo',
    changeBack: 'To change it back, use its Move to menu.',
    filter: {
      title: 'Find leads',
      search: 'Search',
      searchHelp: 'Company, role, place, what they do, or web address.',
      type: 'Type',
      types: { any: 'Any type', post: 'Hiring posts', funding: 'Just raised', community: 'Community threads' },
      fields: 'Field',
      fieldChoices: { any: 'Any field', out: 'Mentions none of your fields' },
      fieldsNeedProfile: 'Add your fields to your profile to use this.',
      label: 'Best address',
      labels: { any: 'Any address', published: 'Published', pattern: 'Pattern', guess: 'Guess', none: 'No email' },
      found: 'Found',
      foundChoices: { any: 'Any time', '7': 'Last 7 days', '30': 'Last 30 days' },
      columns: 'Columns',
      allColumns: 'All',
      clear: 'Clear',
      more: 'More filters',
      fewer: 'Fewer filters',
      showing: (shown: number, total: number) => `Showing ${shown} of ${total} ${total === 1 ? 'lead' : 'leads'}.`,
      hiddenColumn: 'Its column is hidden by your filter.',
    },
    undone: (company: string, status: string) => `${company} is back in ${status}.`,
    cantUndo: (company: string) => `Can’t undo: ${company} changed since.`,
    dismiss: 'Dismiss',
    notNow: {
      title: (company: string) => `Not now: when should ${company} come back?`,
      body: 'On that date, the lead returns to Today under "Back from Not now", with the status it had before.',
      date: 'Come back on',
      confirm: 'Move to Not now',
      cancel: 'Cancel',
    },
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

  /**
   * The run report (FR-8.1), in the agent skill's `runs/YYYY-MM-DD.md` shape. Its
   * first 4 headings are the skill's, word for word. The rest are the app's own
   * additions, recorded in FRD §11.5 as changes the skill should take.
   */
  report: {
    title: (date: string) => `# Hunt: ${date}`,
    sampleNote: 'Sample hunt: these results are invented, and no service was called.',
    status: {
      completed: (kept: number, dropped: number) =>
        `Completed. ${plural(kept, 'new lead', 'new leads')} kept, ${plural(dropped, 'lead', 'leads')} dropped.`,
      cancelled: (kept: number, dropped: number) =>
        `Cancelled. ${plural(kept, 'new lead', 'new leads')} found before it stopped ${kept === 1 ? 'was' : 'were'} kept, ${plural(dropped, 'lead', 'leads')} dropped.`,
    },
    headings: {
      posts: '## Fresh posts',
      funding: '## Just raised',
      followups: '## Follow-ups due',
      dry: '## Dry queries',
      community: '## Community threads',
      dropped: '## Dropped, and why',
      failedSources: "## Couldn't search today",
      notSearched: '## Not searched',
      cost: '## Provider and cost',
    },
    none: '- None.',
    opening: (url: string, posted: string) => `- Opening: ${url} (posted ${posted}, from the Hacker News API)`,
    post: (url: string) => `- Post: ${url}`,
    round: (company: string, round: string, date: string, url: string) => `### ${company}: ${round} (${date}, ${url})`,
    readBy: (provider: string) => `- Read by ${provider} from the linked page. Not checked by the app.`,
    fit: (fit: string) => `- Fit: ${fit}`,
    contact: (name: string, role: string, email: string, label: string, evidence: string) =>
      `- Contact: ${name} (${role}). ${email} (${label}, ${evidence})`,
    noContact: '- Contact: nobody found yet.',
    contactRemoved: '- Contact: (removed).',
    removed: '(removed)',
    hook: (text: string, url: string) => `- Hook: ${text} ${url}`,
    followup: (company: string, emailedOn: string, number: number) =>
      `- ${company}: emailed ${emailedOn}, no reply. Follow-up ${number} is due.`,
    dryStep: {
      posts: 'Fresh posts: nothing new fit your profile.',
      funding: 'Funding news: no recent seed round could be confirmed.',
      community: 'Hacker News hiring thread: nothing new fit your profile.',
    },
    dropped: (company: string, reason: string, url: string) => `- ${company}: ${reason}. ${url}`,
    unread: (count: number) => `- ${plural(count, 'possible lead', 'possible leads')} couldn't be checked this time.`,
    notSearched: (step: string, reason: string) => `- ${step}: ${reason}.`,
    provider: (name: string, model: string) => `- Provider: ${name}, model ${model}.`,
    noProvider: '- Provider: none. A sample hunt calls no service.',
    calls: (calls: number, inputTokens: string, outputTokens: string) =>
      `- Model calls: ${calls}. Tokens: ${inputTokens} in, ${outputTokens} out.`,
    unreported: (count: number) =>
      `- ${plural(count, 'call', 'calls')} didn't report ${count === 1 ? 'its' : 'their'} tokens, so the figures below leave ${count === 1 ? 'it' : 'them'} out.`,
    costFree: (provider: string) => `- Cost: nothing, if your key is on ${provider}'s free tier.`,
    costFreeModel: '- Cost: nothing. This model is free.',
    costPaid: (amount: string, checkedOn: string) =>
      `- If your key has billing on, this run cost about ${amount} at the list price. Worked out from the price table dated ${checkedOn}, not read from your bill.`,
    costUnknown: '- Cost: not known for this model.',
    costSample: '- Cost: nothing.',
    stopped: (why: string) => `Stopped. ${why}`,
    fileName: (date: string, number: number) => `${date}${number > 1 ? `-${number}` : ''}.md`,
  },

  drafts: {
    title: 'Draft checker',
    intro: 'Paste an email you wrote. The app checks it and shows each problem with its line. It never rewrites your words.',
    yourDraft: 'Your draft',
    forLead: 'Which lead it’s for (optional)',
    noLead: 'Not for a lead',
    leadOption: (company: string, role: string) => `${company}: ${role}`,
    subject: 'Subject',
    body: 'Email',
    private: 'Your draft stays on this screen. It isn’t saved, backed up or sent anywhere.',
    check: 'Check draft',
    checkAgain: 'Check again',
    results: 'Checks',
    notYet: 'Paste your draft, then check it.',
    noProblems: 'No problems found in the checks the app can make.',
    problemCount: (count: number) => (count === 1 ? '1 problem found.' : `${count} problems found.`),
    passed: 'Passed.',
    onLine: (line: number) => `Line ${line}:`,
    needsAi: 'Not checked. This needs judgement, so it needs your AI key, which the checker doesn’t use yet.',
    needsLead: 'Pick the lead to check this.',
    neverRewrites: 'The checker only points at problems. It never suggests new wording: the email should sound like you.',
    checks: {
      length: '5 lines or fewer',
      'first-line': 'The first line is about them',
      'proof-link': 'One proof link',
      'small-ask': 'One small ask',
      'stock-opener': 'No stock openers',
      subject: 'The subject names the role or the hook',
    },
    problems: {
      tooLong: (lines: number) => `The message is ${lines} lines. Keep it to 5 or fewer.`,
      stockOpener: 'This opens with a stock phrase. Start with something about them.',
      noLink: 'There’s no link to your work.',
      manyLinks: (links: number) => `There are ${links} links. Keep the one that shows your work best.`,
      noSubject: 'There’s no subject.',
      subjectMisses: 'The subject names neither the role nor a fact from the lead.',
    },
  },

  history: {
    title: 'History',
    intro: 'Every hunt, newest first, with its report.',
    empty: { title: 'No hunts yet', body: 'Each hunt you run saves a report here.' },
    status: { completed: 'Completed', cancelled: 'Cancelled', failed: 'Stopped' },
    sample: 'Sample',
    counts: (kept: number, dropped: number) => `${plural(kept, 'lead', 'leads')} kept · ${dropped} dropped`,
    show: 'Show report',
    hide: 'Hide report',
    download: 'Download report',
    noReport: 'This hunt ran before reports were added, so it has none.',
    reportExpired: (days: number) => `Its report was deleted after ${days} days, as set in Settings. The counts stay.`,
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
      warning: 'If you clear this browser’s data, your leads are deleted too. Keep a backup somewhere safe.',
      savingOff: (browser: string) =>
        `Saving is off: ${browser} is not letting Get Me Hired store data. Your leads and profile last only until you close this tab.`,
    },
    block: {
      title: 'Do-not-contact list',
      body: 'People, addresses and whole domains you never want to see again, for example after someone asks not to be contacted. They are left out of every hunt, and taken off your saved leads.',
      label: 'An address or a domain',
      placeholder: 'name@company.com or company.com',
      add: 'Block',
      empty: 'Nobody is blocked.',
      listLabel: 'Blocked',
      kinds: {
        email: (value: string) => `${value}: this address`,
        domain: (value: string) => `${value}: every lead on this domain, and its subdomains`,
        person: (name: string, at: string) => `${name}, at ${at}`,
      },
      unblock: (value: string) => `Unblock ${value}`,
      invalid: 'That isn’t an email address or a domain.',
      shared: 'Many unrelated people use that domain, so it can’t be blocked as a whole. Block their address instead.',
      already: 'That is already on the list.',
      confirmTitle: (domain: string) => `Block ${domain}?`,
      confirmBody: (count: number) =>
        `${plural(count, 'saved lead is', 'saved leads are')} on this domain. Blocking it removes ${count === 1 ? 'it' : 'them'} from your lists, and this can’t be undone.`,
      confirm: 'Block and remove',
      cancel: 'Cancel',
      done: (value: string, removed: number) =>
        removed > 0 ? `Blocked ${value}. ${plural(removed, 'lead was', 'leads were')} removed.` : `Blocked ${value}.`,
      unblocked: (value: string) => `Unblocked ${value}. Leads already removed don’t come back.`,
    },
    backup: {
      title: 'Backup',
      body: 'One ZIP file with your profile, your leads and your hunt reports, in the same files the Get Me Hired skill uses. Your keys are never in it, and neither are sample leads.',
      export: 'Download a backup',
      import: 'Open a backup',
      last: (date: string) => `Last backup: ${date}.`,
      never: 'No backup yet.',
      reading: 'Reading the backup…',
      confirmTitle: 'Bring in this backup?',
      contents: (leads: number, reports: number, profile: boolean) =>
        `It holds ${plural(leads, 'lead', 'leads')}, ${plural(reports, 'report', 'reports')}${profile ? ' and a profile' : ''}.`,
      mergeNote:
        'Leads you already have stay as they are: their status, emailed dates and notes are yours. Only new leads, and history this browser lacks, are added.',
      replaceProfile: 'Replace my profile with the one in the backup',
      confirm: 'Bring it in',
      cancel: 'Cancel',
      done: (added: number, here: number, runs: number) =>
        `Added ${plural(added, 'lead', 'leads')} and ${plural(runs, 'report', 'reports')}. ${here > 0 ? `${plural(here, 'lead was', 'leads were')} already here, and yours were kept.` : ''}`.trim(),
      profileDone: { added: 'The profile was added.', replaced: 'Your profile was replaced.', kept: 'Your profile was kept.', none: '' },
      reviewDone: (count: number) => `${plural(count, 'row needs', 'rows need')} a look: see the notes on those leads.`,
      problems: {
        'not-zip': "This file isn't a Get Me Hired backup: it isn't a ZIP file.",
        'not-backup': "This file isn't a Get Me Hired backup: it has none of the backup's files.",
        newer: 'This backup is from a newer version of Get Me Hired. Update the app first.',
        damaged: 'This backup is damaged, so nothing was brought in.',
        'too-big': 'This file is too big to be a backup, so nothing was brought in.',
        unsupported: 'This ZIP uses a kind of compression the app can’t read. Zip the files again with your computer’s own zip tool.',
      },
      reminder: (days: number) => `It's been ${days} days since your last backup. Download one, so your leads are safe if this browser's data is cleared.`,
      reminderNever: 'You have no backup yet. Download one, so your leads are safe if this browser’s data is cleared.',
      reminderAction: 'Go to backup',
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
      body: 'This wipes your profile, your keys, and every lead and setting from this browser. It cannot be undone.',
      open: 'Delete everything…',
      confirmTitle: 'Delete everything?',
      confirmBody: 'Your profile, your keys, and every lead and setting in this browser will be wiped. This cannot be undone.',
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
    changedElsewhere: 'This app was changed in another tab, so your last change here wasn’t saved. It now shows the latest.',
    keysLocked: 'Your key passphrase was changed in another tab, so your keys are locked here. Unlock them in Settings.',
    draftKept:
      'This app was changed in another tab. Your unsaved profile changes here are kept. Saving them replaces the profile saved there.',
    dismiss: 'Dismiss',
    savingOff:
      'Saving is off, because this browser is not letting Get Me Hired store data. Everything you do here is lost when you close this tab.',
    screen: {
      title: 'This screen could not be opened',
      body: 'You may be offline, or Get Me Hired was updated since this tab opened. Your data is safe. Reload the page to get the newest version.',
      action: 'Reload the page',
    },
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
