// The lead lifecycle and follow-ups (FRD §8). Every function returns a new
// lead and leaves its input unchanged.

import { addDays, addWorkingDays } from './dates';
import type { Lead, LeadStatus, Person } from './lead';

/** Follow-up timing, in working days (FRD §8.2 rule 2, decision D7). */
export interface Cadence {
  /** Wait before each follow-up: the first number after the first email, the next after follow-up 1, and so on. */
  followupDelays: number[];
  /** Wait after the last follow-up before the lead becomes `no-reply`. */
  closeAfter: number;
}

export const DEFAULT_CADENCE: Cadence = { followupDelays: [5, 7], closeAfter: 7 };

export const DEFAULT_SNOOZE_DAYS = 30;

export type NextStep =
  /** A follow-up to send. `number` starts at 1. */
  | { kind: 'followup'; number: number; dueOn: string }
  /** All follow-ups are sent. On `dueOn` the app gives up on this person. */
  | { kind: 'close'; dueOn: string };

/** What comes next for one person, or `null` if they haven't been emailed. */
export function nextStepFor(person: Person, cadence: Cadence = DEFAULT_CADENCE): NextStep | null {
  const firstEmail = person.emailedOn[0];
  if (!firstEmail) return null;

  const sent = person.followupsSent.length;
  const lastContact = person.followupsSent[sent - 1] ?? firstEmail;
  const delay = cadence.followupDelays[sent];
  if (delay !== undefined) {
    return { kind: 'followup', number: sent + 1, dueOn: addWorkingDays(lastContact, delay) };
  }
  return { kind: 'close', dueOn: addWorkingDays(lastContact, cadence.closeAfter) };
}

export interface FollowupDue {
  personIndex: number;
  number: number;
  dueOn: string;
}

/** Follow-ups due on or before `today`. Only an `emailed` lead has any. */
export function followupsDue(lead: Lead, today: string, cadence: Cadence = DEFAULT_CADENCE): FollowupDue[] {
  if (lead.status !== 'emailed') return [];
  return lead.people.flatMap((person, personIndex) => {
    const step = nextStepFor(person, cadence);
    return step?.kind === 'followup' && step.dueOn <= today
      ? [{ personIndex, number: step.number, dueOn: step.dueOn }]
      : [];
  });
}

/** The earliest date something is due on this lead, for the `next_action_on` column. */
export function nextActionOn(lead: Lead, cadence: Cadence = DEFAULT_CADENCE): string | null {
  if (lead.status === 'not-now') return lead.snoozeUntil;
  if (lead.status !== 'emailed') return null;
  const dates = lead.people.flatMap((person) => nextStepFor(person, cadence)?.dueOn ?? []);
  return dates.length > 0 ? dates.reduce((earliest, date) => (date < earliest ? date : earliest)) : null;
}

function withStatus(lead: Lead, status: LeadStatus, at: Date): Lead {
  if (lead.status === status) return lead;
  return { ...lead, status, statusHistory: [...lead.statusHistory, { status, at: at.toISOString() }] };
}

function updatePerson(lead: Lead, personIndex: number, update: (person: Person) => Person): Lead {
  return { ...lead, people: lead.people.map((person, index) => (index === personIndex ? update(person) : person)) };
}

/**
 * Records the first email to one person (FR-6.4, FR-6.10). The lead becomes
 * `emailed` when its first person is marked (§8.2 rule 1). Marking someone
 * twice changes nothing.
 */
export function markEmailed(lead: Lead, personIndex: number, today: string, now: Date): Lead {
  const person = lead.people[personIndex];
  if (!person || person.emailedOn.length > 0) return lead;
  const marked = updatePerson(lead, personIndex, (current) => ({ ...current, emailedOn: [today] }));
  const cleared = { ...marked, attention: null };
  return lead.status === 'new' ? withStatus(cleared, 'emailed', now) : cleared;
}

/** Takes back a first email marked by mistake. The lead returns to `new` if nobody else was emailed. */
export function unmarkEmailed(lead: Lead, personIndex: number, now: Date): Lead {
  const person = lead.people[personIndex];
  if (!person || person.emailedOn.length === 0) return lead;
  const cleared = updatePerson(lead, personIndex, (current) => ({ ...current, emailedOn: [], followupsSent: [] }));
  const anyoneLeft = cleared.people.some((current) => current.emailedOn.length > 0);
  return !anyoneLeft && cleared.status === 'emailed' ? withStatus(cleared, 'new', now) : cleared;
}

/** Records a follow-up sent to one person. It only counts if that person was emailed first. */
export function markFollowupSent(lead: Lead, personIndex: number, today: string): Lead {
  const person = lead.people[personIndex];
  if (!person || person.emailedOn.length === 0) return lead;
  return updatePerson(lead, personIndex, (current) => ({
    ...current,
    followupsSent: [...current.followupsSent, today],
  }));
}

export interface SetStatusOptions {
  /** For `not-now`: the local date the lead comes back. Defaults to 30 days from `today`. */
  snoozeUntil?: string;
}

/**
 * A manual move. Any move is allowed, including backwards (§8.2 rule 5), and
 * each one is added to the history.
 */
export function setStatus(
  lead: Lead,
  status: LeadStatus,
  today: string,
  now: Date,
  options: SetStatusOptions = {},
): Lead {
  const moved = withStatus(lead, status, now);
  if (status === 'not-now') {
    return { ...moved, snoozeUntil: options.snoozeUntil ?? addDays(today, DEFAULT_SNOOZE_DAYS), attention: null };
  }
  return { ...moved, snoozeUntil: null, attention: null };
}

/** The status a "Not now" lead had before it was parked. */
function statusBeforeSnooze(lead: Lead): LeadStatus {
  for (let index = lead.statusHistory.length - 1; index >= 0; index--) {
    const status = lead.statusHistory[index]?.status;
    if (status && status !== 'not-now') return status;
  }
  return 'new';
}

/**
 * The two moves the app makes on its own (§8.2 rule 6):
 *   - `emailed` becomes `no-reply` once every emailed person is past their last wait
 *   - `not-now` returns to its earlier status on its return date
 * Call it when the app opens and when the date changes.
 */
export function applyAutomaticMoves(lead: Lead, today: string, now: Date, cadence: Cadence = DEFAULT_CADENCE): Lead {
  if (lead.status === 'not-now' && lead.snoozeUntil !== null && lead.snoozeUntil <= today) {
    const back = withStatus(lead, statusBeforeSnooze(lead), now);
    return { ...back, snoozeUntil: null, attention: 'back-from-not-now' };
  }

  if (lead.status === 'emailed') {
    const steps = lead.people.flatMap((person) => nextStepFor(person, cadence) ?? []);
    const allGivenUp = steps.length > 0 && steps.every((step) => step.kind === 'close' && step.dueOn <= today);
    if (allGivenUp) return withStatus(lead, 'no-reply', now);
  }

  return lead;
}
