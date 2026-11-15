// Turns facts from `core/` into the words shown on screen. The words themselves
// come from strings.ts.

import { daysBetween } from '@/core/dates';
import type { Lead } from '@/core/lead';
import { ageHours, newGroupOf, type TodayReason } from '@/core/ranking';
import { strings } from './strings';

const shortDateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const clockFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

/** A `YYYY-MM-DD` date as, for example, "14 Nov". */
export function shortDate(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return shortDateFormat.format(new Date(year ?? 0, (month ?? 1) - 1, date ?? 1));
}

export function clockTime(isoDateTime: string): string {
  return clockFormat.format(new Date(isoDateTime));
}

/** How old a lead is, in words: "4h old", "3 days old", "about 11 days old". */
export function ageText(lead: Lead, nowMs: number): string {
  const hours = ageHours(lead, nowMs);
  if (hours === null) return strings.lead.age.unknown;
  const text =
    hours < 1
      ? strings.lead.age.underHour
      : hours < 48
        ? strings.lead.age.hours(Math.floor(hours))
        : strings.lead.age.days(Math.floor(hours / 24));
  return lead.postedAtApprox ? strings.lead.age.about(text) : text;
}

/** For a funding round: "today", "3 days ago". */
export function roundAgeText(lead: Lead, nowMs: number): string {
  const hours = ageHours(lead, nowMs);
  if (hours === null) return strings.lead.age.unknown;
  return strings.lead.age.roundDays(Math.floor(hours / 24));
}

/** The one line on a card that says why it sits where it does (FRD §9.4). */
export function whyLine(reason: TodayReason, lead: Lead, today: string, nowMs: number): string {
  if (reason.kind === 'followup') {
    return daysBetween(reason.dueOn, today) <= 0
      ? strings.lead.why.followupToday(reason.number)
      : strings.lead.why.followup(reason.number, shortDate(reason.dueOn));
  }
  if (reason.kind === 'attention') return strings.lead.why.attention[reason.attention];

  const age = reason.ageHours === null ? strings.lead.why.ageUnknown : ageText(lead, nowMs);
  return [strings.lead.why.group[reason.group], age, strings.lead.tier(reason.tier)].join(' · ');
}

/** The freshness ring: how much of the lead's window is left, from 1 (just found) to 0 (FRD design). */
export function freshness(lead: Lead, nowMs: number): { left: number | null; tone: 'signal' | 'ink' } {
  const hours = ageHours(lead, nowMs);
  const group = newGroupOf(lead);
  // Fresh posts live for 24 hours, funding rounds for 14 days, a monthly thread for about 30.
  const windowHours = group === 'post' ? 24 : group === 'funding' ? 14 * 24 : 30 * 24;
  const left = hours === null ? null : Math.min(1, Math.max(0, 1 - hours / windowHours));
  return { left, tone: group === 'post' ? 'signal' : 'ink' };
}

export function browserName(userAgent: string): string {
  const names = strings.data.browsers;
  if (/Edg\//.test(userAgent)) return names.edge;
  if (/Firefox\//.test(userAgent)) return names.firefox;
  if (/Chrome\//.test(userAgent)) return names.chrome;
  if (/Safari\//.test(userAgent)) return names.safari;
  return names.other;
}

/**
 * The role, in words. An empty role means "we don't know" (AC-6.2), except on a
 * funding lead that lists no opening, where "No open role listed" is the fact.
 */
export function roleText(lead: Pick<Lead, 'role' | 'type' | 'signals'>): string {
  if (lead.role) return lead.role;
  return lead.type === 'funding' && lead.signals.includes('no-open-role') ? strings.lead.facts.noRole : strings.unknown;
}

/** A dollar amount: "$2" when whole, "$0.03", or "$0.0042" under a cent, as in the run report. */
export function usd(amount: number): string {
  if (Number.isInteger(amount)) return `$${amount}`;
  return amount < 0.01 ? `$${amount.toFixed(4)}` : `$${amount.toFixed(2)}`;
}
