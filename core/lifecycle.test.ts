import { describe, expect, it } from 'vitest';
import { addDays, addWorkingDays, daysBetween, isWorkingDay, localDate, MAX_WORKING_DAYS } from './dates';
import type { Lead, Person } from './lead';
import {
  applyAutomaticMoves,
  closedByCadence,
  DEFAULT_CADENCE,
  followupsDue,
  markEmailed,
  markFollowupSent,
  nextActionOn,
  nextStepFor,
  setStatus,
  unmarkEmailed,
} from './lifecycle';

const NOW = new Date('2026-11-16T09:00:00Z');

function person(overrides: Partial<Person> = {}): Person {
  return {
    name: 'Ada Quill',
    role: 'CEO',
    contacts: [{ method: 'email', value: 'ada@northpeak.example', label: 'guess' }],
    emailedOn: [],
    followupsSent: [],
    ...overrides,
  };
}

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    key: 'https://northpeak.example/careers|northpeak labs',
    foundOn: '2026-11-16',
    type: 'post',
    company: 'Northpeak Labs',
    companyUrl: 'https://northpeak.example',
    about: '',
    role: 'Design Engineer',
    fit: '',
    postedAt: null,
    postedAtApprox: false,
    likes: 'unknown',
    round: '',
    location: '',
    people: [person()],
    hooks: [],
    sources: [],
    signals: [],
    tier: 'B',
    status: 'new',
    statusHistory: [{ status: 'new', at: NOW.toISOString() }],
    snoozeUntil: null,
    attention: null,
    notes: '',
    sample: false,
    ...overrides,
  };
}

describe('dates', () => {
  it('knows Monday to Friday are working days', () => {
    expect(isWorkingDay('2026-11-16')).toBe(true); // Monday
    expect(isWorkingDay('2026-11-20')).toBe(true); // Friday
    expect(isWorkingDay('2026-11-21')).toBe(false); // Saturday
    expect(isWorkingDay('2026-11-22')).toBe(false); // Sunday
  });

  it('adds working days without counting the start day', () => {
    expect(addWorkingDays('2026-11-16', 1)).toBe('2026-11-17');
    expect(addWorkingDays('2026-11-16', 5)).toBe('2026-11-23');
    expect(addWorkingDays('2026-11-20', 1)).toBe('2026-11-23'); // Friday to Monday
    expect(addWorkingDays('2026-11-21', 1)).toBe('2026-11-23'); // Saturday to Monday
    expect(addWorkingDays('2026-11-16', 0)).toBe('2026-11-16');
  });

  it('adds calendar days across months and years', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-11-16', '2026-11-23')).toBe(7);
    expect(daysBetween('2026-11-23', '2026-11-16')).toBe(-7);
  });

  it('formats a local date with leading zeros', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('follow-ups (AC-6.4)', () => {
  it('makes follow-up 1 due 5 working days after the first email', () => {
    const emailed = markEmailed(lead(), 0, '2026-11-16', NOW); // a Monday
    expect(nextStepFor(emailed.people[0] as Person)).toEqual({ kind: 'followup', number: 1, dueOn: '2026-11-23' });
  });

  it('makes follow-up 2 due 7 working days after follow-up 1 was sent', () => {
    const emailed = markEmailed(lead(), 0, '2026-11-16', NOW);
    const followed = markFollowupSent(emailed, 0, '2026-11-23');
    expect(nextStepFor(followed.people[0] as Person)).toEqual({ kind: 'followup', number: 2, dueOn: '2026-12-02' });
  });

  it('moves the lead to no-reply 7 working days after follow-up 2, and not before', () => {
    let current = markEmailed(lead(), 0, '2026-11-16', NOW);
    current = markFollowupSent(current, 0, '2026-11-23');
    current = markFollowupSent(current, 0, '2026-12-02');
    expect(nextStepFor(current.people[0] as Person)).toEqual({ kind: 'close', dueOn: '2026-12-11' });

    expect(applyAutomaticMoves(current, '2026-12-10', NOW).status).toBe('emailed');
    const closed = applyAutomaticMoves(current, '2026-12-11', NOW);
    expect(closed.status).toBe('no-reply');
    expect(closed.statusHistory.at(-1)?.status).toBe('no-reply');
  });

  it('lists a follow-up only once it is due', () => {
    const emailed = markEmailed(lead(), 0, '2026-11-16', NOW);
    expect(followupsDue(emailed, '2026-11-22')).toEqual([]);
    expect(followupsDue(emailed, '2026-11-23')).toEqual([{ personIndex: 0, number: 1, dueOn: '2026-11-23' }]);
    expect(followupsDue(emailed, '2026-11-30')).toHaveLength(1);
  });

  it('follows a different cadence when the settings change it', () => {
    const cadence = { followupDelays: [3], closeAfter: 10 };
    const emailed = markEmailed(lead(), 0, '2026-11-16', NOW);
    expect(nextStepFor(emailed.people[0] as Person, cadence)).toEqual({ kind: 'followup', number: 1, dueOn: '2026-11-19' });
    const followed = markFollowupSent(emailed, 0, '2026-11-19');
    expect(nextStepFor(followed.people[0] as Person, cadence)).toEqual({ kind: 'close', dueOn: '2026-12-03' });
  });

  it('closes straight after the first email when follow-ups are set to none', () => {
    const cadence = { followupDelays: [], closeAfter: 7 };
    const emailed = markEmailed(lead(), 0, '2026-11-16', NOW);
    expect(nextStepFor(emailed.people[0] as Person, cadence)).toEqual({ kind: 'close', dueOn: '2026-11-25' });
  });

  it('has nothing next for someone who was never emailed', () => {
    expect(nextStepFor(person())).toBeNull();
    expect(DEFAULT_CADENCE).toEqual({ followupDelays: [5, 7], closeAfter: 7 });
  });
});

describe('marking people as emailed (FR-6.4, FR-6.10)', () => {
  const three = () => lead({ people: [person({ name: 'A' }), person({ name: 'B' }), person({ name: 'C' })] });

  it('makes the lead emailed when its first person is marked', () => {
    const marked = markEmailed(three(), 1, '2026-11-16', NOW);
    expect(marked.status).toBe('emailed');
    expect(marked.people.map((entry) => entry.emailedOn)).toEqual([[], ['2026-11-16'], []]);
    expect(marked.statusHistory.map((change) => change.status)).toEqual(['new', 'emailed']);
  });

  it('tracks each person on their own', () => {
    let current = markEmailed(three(), 0, '2026-11-16', NOW);
    current = markEmailed(current, 2, '2026-11-18', NOW);
    expect(current.people.map((entry) => entry.emailedOn[0] ?? null)).toEqual(['2026-11-16', null, '2026-11-18']);
    expect(current.statusHistory).toHaveLength(2);
  });

  it('changes nothing when the same person is marked twice', () => {
    const once = markEmailed(three(), 0, '2026-11-16', NOW);
    expect(markEmailed(once, 0, '2026-11-17', NOW)).toBe(once);
  });

  it('ignores a person who is not on the lead', () => {
    const original = three();
    expect(markEmailed(original, 7, '2026-11-16', NOW)).toBe(original);
    expect(markFollowupSent(original, 0, '2026-11-16')).toBe(original);
  });

  it('leaves the original lead unchanged', () => {
    const original = three();
    markEmailed(original, 0, '2026-11-16', NOW);
    expect(original.status).toBe('new');
    expect(original.people[0]?.emailedOn).toEqual([]);
  });

  it('takes a mark back, and returns the lead to new if nobody else was emailed', () => {
    const marked = markEmailed(three(), 0, '2026-11-16', NOW);
    const undone = unmarkEmailed(marked, 0, NOW);
    expect(undone.status).toBe('new');
    expect(undone.people[0]?.emailedOn).toEqual([]);

    const two = markEmailed(marked, 1, '2026-11-16', NOW);
    expect(unmarkEmailed(two, 0, NOW).status).toBe('emailed');
  });

  it('uses the earliest date across people as the next action', () => {
    let current = markEmailed(three(), 0, '2026-11-18', NOW);
    current = markEmailed(current, 1, '2026-11-16', NOW);
    expect(nextActionOn(current)).toBe('2026-11-23');
    expect(nextActionOn(three())).toBeNull();
  });
});

describe('manual moves (§8.2)', () => {
  it('stops follow-ups when someone replies', () => {
    const emailed = markEmailed(lead(), 0, '2026-11-16', NOW);
    for (const status of ['replied', 'call', 'offer', 'rejected'] as const) {
      const moved = setStatus(emailed, status, '2026-11-23', NOW);
      expect(followupsDue(moved, '2026-12-30')).toEqual([]);
      expect(nextActionOn(moved)).toBeNull();
      expect(applyAutomaticMoves(moved, '2027-01-30', NOW).status).toBe(status);
    }
  });

  it('allows any move, including backwards, and logs each one', () => {
    let current = setStatus(lead(), 'call', '2026-11-16', NOW);
    current = setStatus(current, 'new', '2026-11-16', NOW);
    current = setStatus(current, 'skip', '2026-11-16', NOW);
    expect(current.statusHistory.map((change) => change.status)).toEqual(['new', 'call', 'new', 'skip']);
  });

  it('does not log a move to the status the lead already has', () => {
    const same = setStatus(lead(), 'new', '2026-11-16', NOW);
    expect(same.statusHistory).toHaveLength(1);
  });

  it('parks a lead for 30 days by default, or until the date given', () => {
    expect(setStatus(lead(), 'not-now', '2026-11-16', NOW).snoozeUntil).toBe('2026-12-16');
    const parked = setStatus(lead(), 'not-now', '2026-11-16', NOW, { snoozeUntil: '2026-11-20' });
    expect(parked.snoozeUntil).toBe('2026-11-20');
    expect(nextActionOn(parked)).toBe('2026-11-20');
  });

  it('brings a parked lead back with its earlier status on the return date', () => {
    const emailed = markEmailed(lead(), 0, '2026-11-16', NOW);
    const parked = setStatus(emailed, 'not-now', '2026-11-17', NOW, { snoozeUntil: '2026-11-20' });

    expect(applyAutomaticMoves(parked, '2026-11-19', NOW).status).toBe('not-now');
    const back = applyAutomaticMoves(parked, '2026-11-20', NOW);
    expect(back.status).toBe('emailed');
    expect(back.attention).toBe('back-from-not-now');
    expect(back.snoozeUntil).toBeNull();
  });

  it('leaves leads alone when nothing is due', () => {
    const fresh = lead();
    expect(applyAutomaticMoves(fresh, '2027-01-01', NOW)).toBe(fresh);
  });

  it('waits for every emailed person before giving up on a lead', () => {
    const two = lead({ people: [person({ name: 'A' }), person({ name: 'B' })] });
    let current = markEmailed(two, 0, '2026-11-16', NOW);
    current = markFollowupSent(current, 0, '2026-11-23');
    current = markFollowupSent(current, 0, '2026-12-02');
    current = markEmailed(current, 1, '2026-12-09', NOW);
    // Person A is past the last wait on 11 December, but person B was only just emailed.
    expect(applyAutomaticMoves(current, '2026-12-11', NOW).status).toBe('emailed');
  });
});

describe('a bound on working days', () => {
  it('stops at MAX_WORKING_DAYS, so a huge count from a bad file can never freeze the app', () => {
    const started = performance.now();
    const far = addWorkingDays('2026-11-16', 1e9);
    expect(performance.now() - started).toBeLessThan(200);
    expect(far).toBe(addWorkingDays('2026-11-16', MAX_WORKING_DAYS));
    expect(addWorkingDays('2026-11-16', Number.NaN)).toBe('2026-11-16');
    expect(addWorkingDays('2026-11-16', -5)).toBe('2026-11-16');
  });
});

describe('what a new cadence would do today', () => {
  it('counts the emailed leads shorter rules would move to No reply, so the user is asked first', async () => {
    const { buildSamplePipeline } = await import('./sample-leads');
    const now = new Date(2026, 10, 16, 9, 0, 0);
    // One lead in the sample pipeline was emailed a week ago, and nothing was sent since.
    const leads = buildSamplePipeline(now);
    const today = localDate(now);
    expect(closedByCadence(leads, today, now, { followupDelays: [5, 7], closeAfter: 7 })).toBe(0);
    expect(closedByCadence(leads, today, now, { followupDelays: [], closeAfter: 3 })).toBe(1);
  });
});
