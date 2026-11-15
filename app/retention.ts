// Retention (FR-9.7, FRD §13.2). The people on leads that ended (skipped,
// rejected, no reply) never signed up for this app, so their names and contacts
// aren't kept forever:
//
// - After the retention period (180 days by default, 30 to 365) from the day a
//   lead closed, its people are replaced by one "(removed)" entry, after the
//   same scrub as "Delete a person" (erase.ts), saved reports included. The
//   company row and its outcome stay.
// - Run reports older than the period are deleted. Their counts stay in History.
// - The do-not-contact list is kept until the user removes an entry, and
//   sample data is left alone (§13.2, FR-1.4).

import { daysBetween, localDate } from '@/core/dates';
import type { Lead, LeadStatus, Person } from '@/core/lead';
import type { AppData, RunRecord } from './data';
import { erasePerson, scrubReport } from './erase';

/** The name that stands in for the people retention removed. */
export const REMOVED = '(removed)';

/** Leads that ended. Only these lose their people (§13.2). */
const CLOSED: readonly LeadStatus[] = ['skip', 'rejected', 'no-reply'];

const PLACEHOLDER: Person = { name: REMOVED, role: '', contacts: [], emailedOn: [], followupsSent: [] };

/**
 * The local date a closed lead entered its status: the newest history entry
 * with that status. A lead with none (a row imported without history) falls
 * back to the day it was found, which is earlier, so it errs toward privacy.
 * `null` for a lead that isn't closed.
 */
export function closedOn(lead: Lead): string | null {
  if (!CLOSED.includes(lead.status)) return null;
  for (let index = lead.statusHistory.length - 1; index >= 0; index--) {
    const entry = lead.statusHistory[index];
    if (entry?.status !== lead.status) continue;
    const at = new Date(entry.at);
    if (!Number.isNaN(at.getTime())) return localDate(at);
  }
  return lead.foundOn;
}

/** True once retention has replaced a lead's people. */
export function isScrubbed(lead: Lead): boolean {
  return lead.people.length === 1 && lead.people[0]?.name === REMOVED && lead.people[0].contacts.length === 0;
}

/** More than `days` whole local days before `today`. */
function expired(date: string, today: string, days: number): boolean {
  return daysBetween(date, today) > days;
}

function leadDue(lead: Lead, today: string, days: number): boolean {
  if (lead.sample || lead.people.length === 0 || isScrubbed(lead)) return false;
  const closed = closedOn(lead);
  return closed !== null && expired(closed, today, days);
}

function reportDue(run: RunRecord, today: string, days: number): boolean {
  return !run.sample && Boolean(run.report) && expired(run.date, today, days);
}

/** How many closed leads and reports a period would clear on `today`, to ask before shortening it. */
export function retentionDue(data: Pick<AppData, 'leads' | 'runs'>, today: string, days: number): { leads: number; reports: number } {
  return {
    leads: data.leads.filter((lead) => leadDue(lead, today, days)).length,
    reports: data.runs.filter((run) => reportDue(run, today, days)).length,
  };
}

/**
 * The data with retention applied on `today`. Returns the same object when
 * nothing is due, so applying it on every open costs nothing.
 */
export function applyRetention(data: AppData, today: string, days: number): AppData {
  let runs: RunRecord[] = data.runs;
  let changed = false;

  const leads = data.leads.map((lead) => {
    if (!leadDue(lead, today, days)) return lead;
    changed = true;
    // Scrub each person as "Delete a person" would, last first so the indexes hold.
    let scrubbed = lead;
    for (let index = lead.people.length - 1; index >= 0; index--) {
      const person = lead.people[index];
      if (!person) continue;
      const erased = erasePerson(scrubbed, index);
      runs = runs.map((run) => (run.report ? { ...run, report: scrubReport(run.report, lead, person, erased.droppedHooks) } : run));
      scrubbed = erased.lead;
    }
    return { ...scrubbed, people: [PLACEHOLDER] };
  });

  runs = runs.map((run) => {
    if (!reportDue(run, today, days)) return run;
    changed = true;
    const { report: _report, reportName: _name, ...kept } = run;
    return { ...kept, reportExpired: true };
  });

  return changed ? { ...data, leads, runs } : data;
}
