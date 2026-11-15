// Pure updates of the saved data, run inside React's functional state updates,
// so each one works on the data as it is at that moment, never on a snapshot.

import { applyBlockList, sameEntry, type BlockEntry } from '@/core/block';
import { spentThisMonth } from '@/core/budget';
import { localDate } from '@/core/dates';
import type { DroppedLead, HuntResult } from '@/core/hunt';
import type { Lead } from '@/core/lead';
import { paidCost } from '@/core/prices';
import { PROVIDERS, type ProviderId } from '@/core/providers';
import type { AppData, RunRecord } from './data';
import { reportFileName, writeRunReport } from './run-report';

/**
 * Adds the leads a hunt found, and its run with a report.
 *
 * The do-not-contact list is applied again here, as it is now: a hunt takes a
 * while, and the user may block a company or a person while it runs. A blocked
 * domain is dropped as "do-not-contact", with only the company and its source;
 * blocked people and addresses are taken off (FR-5.7). A lead whose key is
 * already saved changes nothing, and counts as a duplicate (FR-6.8).
 */
export function addFound(data: AppData, result: HuntResult, now: Date, sample: boolean, provider: ProviderId | null): AppData {
  const known = new Set(data.leads.map((lead) => lead.key));
  const fresh: Lead[] = [];
  const dropped: DroppedLead[] = [...result.dropped];
  for (const found of result.leads) {
    const sourceUrl = found.sources[0]?.url ?? '';
    const blocked = applyBlockList(found, data.doNotContact);
    if (blocked.kind === 'drop') dropped.push({ company: found.company, reason: 'do-not-contact', sourceUrl });
    else if (known.has(found.key)) dropped.push({ company: found.company, reason: 'duplicate', sourceUrl });
    else fresh.push(blocked.lead);
  }

  const date = localDate(now);
  const leads = [...data.leads, ...fresh];
  const usage = result.usage;
  // A hunt stopped at the monthly cap says which cap, and whether the total is a lower bound (AC-4.13).
  const cap =
    result.problem === 'cap-reached'
      ? { usd: data.settings.monthlyCap, partial: spentThisMonth(data.runs, date).partial || (usage?.unreported ?? 0) > 0 }
      : undefined;
  // Sample hunts are numbered apart, since they are never exported with real ones (FR-1.4).
  const earlier = data.runs.filter((run) => run.date === date && run.sample === sample).length;
  const report = writeRunReport({
    date,
    status: result.status,
    ...(result.problem ? { problem: result.problem } : {}),
    sample,
    provider: sample ? null : provider,
    kept: fresh,
    dropped,
    steps: result.steps,
    failedSources: result.failedSources ?? [],
    unread: result.unread ?? 0,
    usage: result.usage ?? null,
    ...(cap ? { cap } : {}),
    leads,
    cadence: data.settings.cadence,
  });
  // What the run cost at the list price, for the monthly cap (AC-4.13). The hunt's own
  // figure counts calls that reported nothing at their bound, so they aren't $0 next
  // time. A hunt that couldn't load made no calls. A sample hunt calls nothing.
  const listCost =
    sample || !provider || !usage
      ? 0
      : result.chargedUsd !== undefined
        ? result.chargedUsd
        : paidCost(PROVIDERS[provider].model, usage);
  const run: RunRecord = {
    at: now.toISOString(),
    date,
    status: result.status,
    kept: fresh.length,
    dropped,
    sample,
    provider: sample ? null : provider,
    ...(result.problem ? { problem: result.problem } : {}),
    listCost,
    unreported: sample ? 0 : (usage?.unreported ?? 0),
    report,
    reportName: reportFileName(date, earlier),
  };
  // The hunt is done, so it's no longer in progress (FR-4.15).
  return { ...data, leads, runs: [...data.runs, run], huntInProgress: null };
}

/**
 * Adds entries to the do-not-contact list and applies the whole list to the
 * saved leads: a lead on a blocked company domain is removed, and blocked
 * people and addresses are taken off. Returns the new data and how many leads
 * were removed.
 */
export function applyBlocks(data: AppData, entries: readonly BlockEntry[]): { data: AppData; removed: number } {
  const list = [...data.doNotContact, ...entries.filter((entry) => !data.doNotContact.some((known) => sameEntry(known, entry)))];
  let removed = 0;
  const leads = data.leads.flatMap((lead) => {
    const blocked = applyBlockList(lead, list);
    if (blocked.kind === 'drop') {
      removed += 1;
      return [];
    }
    return [blocked.lead];
  });
  return { data: { ...data, doNotContact: list, leads }, removed };
}
