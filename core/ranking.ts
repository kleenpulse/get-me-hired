// Tiers and the order of the Today list (FRD §9.3 and §9.4).
//
// This module returns facts (group, age, tier, due date). The app turns them
// into sentences, because all interface text lives in one file (NFR-9).

import { isRemovedPerson, isScrubbed, type Attention, type Lead, type Signal, type Tier } from './lead';
import { DEFAULT_CADENCE, followupsDue, type Cadence } from './lifecycle';

const HOUR_MS = 3_600_000;

type TierInput = Pick<Lead, 'type' | 'signals' | 'people'>;

/** Soft signals that count toward the tier. `no-open-role` is normal for a funded startup, so it doesn't count there. */
function countedSignals(lead: TierInput): Signal[] {
  return lead.signals.filter((signal) => !(signal === 'no-open-role' && lead.type === 'funding'));
}

/** The tier of a lead, from its signals and its addresses (FRD §9.3). */
export function computeTier(lead: TierInput): Tier {
  const signals = countedSignals(lead);
  if (signals.length >= 4 || signals.includes('equity-only')) return 'C';

  const hasCheckedAddress = lead.people.some((person) =>
    person.contacts.some(
      (contact) => contact.method === 'email' && (contact.label === 'published' || contact.label === 'pattern'),
    ),
  );
  return signals.length <= 1 && hasCheckedAddress ? 'A' : 'B';
}

/** Hours since the post, comment or round was published, or `null` when the date is unknown. */
export function ageHours(lead: Pick<Lead, 'postedAt'>, nowMs: number): number | null {
  if (lead.postedAt === null) return null;
  const posted = Date.parse(lead.postedAt);
  return Number.isNaN(posted) ? null : (nowMs - posted) / HOUR_MS;
}

/** The three kinds of new lead, in the order Today lists them. */
export type NewGroup = 'post' | 'funding' | 'community';
export type TodayGroup = 'followup' | 'attention' | NewGroup;

/** A lead found through a post goes with the posts, even if a funding round was merged into it (FR-4.16). */
export function newGroupOf(lead: Pick<Lead, 'type' | 'sources'>): NewGroup {
  if (lead.sources.some((source) => source.kind === 'post')) return 'post';
  if (lead.type === 'funding') return 'funding';
  return lead.sources.some((source) => source.kind === 'community') ? 'community' : 'post';
}

export type TodayReason =
  | { kind: 'followup'; number: number; dueOn: string }
  | { kind: 'attention'; attention: Attention }
  | { kind: 'new'; group: NewGroup; ageHours: number | null; tier: Tier };

export interface TodayEntry {
  lead: Lead;
  group: TodayGroup;
  /** Why the lead sits where it does. Shown as one line on the card (§9.4). */
  reason: TodayReason;
  /** People to write to on this lead today. The daily target counts these, not leads. */
  people: number;
}

export interface TodayOptions {
  /** The user's local date. */
  today: string;
  nowMs: number;
  /** How many people to write to in a day (FR-4.14). */
  dailyTarget: number;
  cadence?: Cadence;
}

export interface TodayList {
  entries: TodayEntry[];
  /** People listed, per group. */
  people: Record<TodayGroup, number>;
  /** First emails and follow-ups already sent today. */
  done: { emailed: number; followups: number };
  /** Leads that would be listed if the daily target were higher. */
  leftOut: number;
}

const TIER_ORDER: Record<Tier, number> = { A: 0, B: 1, C: 2 };
const NEW_GROUP_ORDER: Record<NewGroup, number> = { post: 0, funding: 1, community: 2 };

/** First emails and follow-ups sent on `today`, across all leads (FR-6.11). */
export function countDoneToday(leads: readonly Lead[], today: string): TodayList['done'] {
  let emailed = 0;
  let followups = 0;
  for (const lead of leads) {
    for (const person of lead.people) {
      if (person.emailedOn[0] === today) emailed += 1;
      followups += person.followupsSent.filter((date) => date === today).length;
    }
  }
  return { emailed, followups };
}

/** People not emailed yet. The "(removed)" stand-in retention leaves isn't anyone to write to. */
function waitingPeople(lead: Lead): number {
  return lead.people.filter((person) => person.emailedOn.length === 0 && !isRemovedPerson(person)).length;
}

/**
 * A lead belongs in the "new" part of Today while nobody was emailed, or while
 * the user is partway through its people today. Once everyone is emailed, or
 * the day ends, it leaves the list and lives on the Board.
 */
function isOpenNewLead(lead: Lead, today: string): boolean {
  // A closed lead whose people retention removed, moved back to New, has nobody to write to.
  if (isScrubbed(lead)) return false;
  if (lead.status === 'new') return true;
  if (lead.status !== 'emailed') return false;
  const startedToday = lead.people.some((person) => person.emailedOn[0] === today);
  return startedToday && waitingPeople(lead) > 0;
}

/** Youngest first. A lead with no known date goes last (FR-4.4). */
function byNewestFirst(a: TodayEntry, b: TodayEntry): number {
  const ageA = a.reason.kind === 'new' ? a.reason.ageHours : null;
  const ageB = b.reason.kind === 'new' ? b.reason.ageHours : null;
  if (ageA === null && ageB === null) return 0;
  if (ageA === null) return 1;
  if (ageB === null) return -1;
  return ageA - ageB;
}

/**
 * Builds the Today list in the order of FRD §9.4:
 *   1. follow-ups due, oldest first
 *   2. "New signal" and "Back from Not now" leads
 *   3. new fresh posts, tier A to C, youngest first
 *   4. new funding leads, tier A to C, newest round first
 *   5. new community-thread openings, tier A to C, newest comment first
 * The list stops once the people listed reach what is left of the daily target.
 */
export function buildToday(leads: readonly Lead[], options: TodayOptions): TodayList {
  const { today, nowMs, dailyTarget, cadence = DEFAULT_CADENCE } = options;

  const followups: TodayEntry[] = [];
  const attention: TodayEntry[] = [];
  const fresh: TodayEntry[] = [];

  for (const lead of leads) {
    const due = followupsDue(lead, today, cadence);
    const first = due.reduce<(typeof due)[number] | null>(
      (earliest, item) => (earliest === null || item.dueOn < earliest.dueOn ? item : earliest),
      null,
    );
    if (first) {
      followups.push({
        lead,
        group: 'followup',
        reason: { kind: 'followup', number: first.number, dueOn: first.dueOn },
        people: due.length,
      });
    } else if (lead.attention !== null) {
      attention.push({
        lead,
        group: 'attention',
        reason: { kind: 'attention', attention: lead.attention },
        people: Math.max(1, waitingPeople(lead)),
      });
    } else if (isOpenNewLead(lead, today)) {
      const group = newGroupOf(lead);
      fresh.push({
        lead,
        group,
        reason: { kind: 'new', group, ageHours: ageHours(lead, nowMs), tier: lead.tier },
        people: Math.max(1, waitingPeople(lead)),
      });
    }
  }

  followups.sort((a, b) => {
    const dueA = a.reason.kind === 'followup' ? a.reason.dueOn : '';
    const dueB = b.reason.kind === 'followup' ? b.reason.dueOn : '';
    return dueA < dueB ? -1 : dueA > dueB ? 1 : 0;
  });
  fresh.sort((a, b) => {
    if (a.reason.kind !== 'new' || b.reason.kind !== 'new') return 0;
    return (
      NEW_GROUP_ORDER[a.reason.group] - NEW_GROUP_ORDER[b.reason.group] ||
      TIER_ORDER[a.reason.tier] - TIER_ORDER[b.reason.tier] ||
      byNewestFirst(a, b)
    );
  });

  const done = countDoneToday(leads, today);
  const budget = Math.max(0, dailyTarget - done.emailed - done.followups);
  const ranked = [...followups, ...attention, ...fresh];

  const entries: TodayEntry[] = [];
  const people: Record<TodayGroup, number> = { followup: 0, attention: 0, post: 0, funding: 0, community: 0 };
  let listed = 0;
  for (const entry of ranked) {
    if (listed >= budget) break;
    entries.push(entry);
    people[entry.group] += entry.people;
    listed += entry.people;
  }

  return { entries, people, done, leftOut: ranked.length - entries.length };
}
