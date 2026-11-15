// The run report (FR-8.1, AC-8.1): one Markdown file per hunt, in the agent
// skill's `runs/YYYY-MM-DD.md` shape. The skill's 4 sections come first, word
// for word, so a report from either tool starts the same way. The app's own
// sections follow (FRD §11.5).
//
// Every hunt gets one: completed, cancelled or stopped. It holds the names and
// addresses of real people, so it is private data, kept in this browser.

import type { DroppedLead, HuntResult, HuntStep } from '@/core/hunt';
import type { Lead } from '@/core/lead';
import { followupsDue, type Cadence } from '@/core/lifecycle';
import { paidCost, PRICES, PRICES_CHECKED_ON, type Usage } from '@/core/prices';
import { PROVIDERS, type ProviderId } from '@/core/providers';
import { newGroupOf } from '@/core/ranking';
import { usd } from './format';
import { strings } from './strings';

const r = strings.report;

export interface ReportInput {
  /** The user's local date of the hunt. */
  date: string;
  status: HuntResult['status'];
  problem?: HuntResult['problem'];
  sample: boolean;
  provider: ProviderId | null;
  /** New leads this hunt added. Leads it found again are counted as duplicates in `dropped`. */
  kept: readonly Lead[];
  dropped: readonly DroppedLead[];
  steps: readonly HuntStep[];
  failedSources: readonly string[];
  unread: number;
  usage: Usage | null;
  /** The monthly cap, for a hunt that stopped at it (AC-4.13). `partial` when some calls didn't report their tokens. */
  cap?: { usd: number; partial: boolean };
  /** All saved leads, for the follow-ups due on this date. */
  leads: readonly Lead[];
  cadence: Cadence;
}

const numberFormat = new Intl.NumberFormat('en-US');

function dollars(amount: number): string {
  if (amount === 0) return '$0';
  return amount < 0.01 ? `$${amount.toFixed(4)}` : `$${amount.toFixed(2)}`;
}

/**
 * A value from a page or a model, on one line. A line break in a company name
 * could otherwise start a fake heading in the Markdown, so every interpolated
 * value goes through this.
 */
function one(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function day(isoDateTime: string | null): string {
  return isoDateTime ? isoDateTime.slice(0, 10) : strings.unknown;
}

function contactLines(lead: Lead): string[] {
  const lines = lead.people.flatMap((person) =>
    person.contacts
      .filter((contact) => contact.method === 'email')
      .map((contact) =>
        r.contact(
          one(person.name),
          one(person.role),
          one(contact.value),
          strings.lead.labels[contact.label ?? 'guess'].toLowerCase(),
          one(contact.evidence ?? strings.unknown),
        ),
      ),
  );
  return lines.length > 0 ? lines : [r.noContact];
}

function hookLines(lead: Lead): string[] {
  return lead.hooks.map((hook) => r.hook(one(hook.text), one(hook.url)));
}

function readByLine(lead: Lead): string[] {
  const readBy = lead.sources.find((source) => source.readBy)?.readBy;
  return readBy ? [r.readBy(PROVIDERS[readBy].name)] : [];
}

function postEntry(lead: Lead): string[] {
  return [
    `### ${one(lead.company)}: ${one(lead.role) || strings.unknown}`,
    r.post(one(lead.sources[0]?.url ?? strings.unknown)),
    ...readByLine(lead),
    r.fit(one(lead.fit) || strings.unknown),
    ...contactLines(lead),
    ...hookLines(lead),
  ];
}

function fundingEntry(lead: Lead): string[] {
  return [
    r.round(one(lead.company), one(lead.round) || strings.unknown, day(lead.postedAt), one(lead.sources[0]?.url ?? strings.unknown)),
    ...readByLine(lead),
    r.fit(one(lead.fit) || strings.unknown),
    ...contactLines(lead),
    ...hookLines(lead),
  ];
}

function communityEntry(lead: Lead): string[] {
  return [
    `### ${one(lead.company)}: ${one(lead.role) || strings.unknown}`,
    // The time comes from Hacker News's own record of the comment, not from the model.
    r.opening(one(lead.sources[0]?.url ?? strings.unknown), day(lead.postedAt)),
    r.fit(one(lead.fit) || strings.unknown),
    ...contactLines(lead),
    ...hookLines(lead),
  ];
}

function section(heading: string, entries: string[][]): string[] {
  return ['', heading, '', ...(entries.length > 0 ? entries.flatMap((entry) => [...entry, '']) : [r.none, ''])];
}

function list(heading: string, lines: string[]): string[] {
  return ['', heading, '', ...(lines.length > 0 ? lines : [r.none]), ''];
}

function costLines(input: ReportInput): string[] {
  if (input.sample) return [r.noProvider, r.costSample];
  if (!input.provider) return [r.costUnknown];
  const info = PROVIDERS[input.provider];
  const usage = input.usage;
  const lines = [r.provider(info.name, info.model)];
  if (!usage) return [...lines, r.costUnknown];
  lines.push(r.calls(usage.calls, numberFormat.format(usage.inputTokens), numberFormat.format(usage.outputTokens)));
  if (usage.unreported > 0) lines.push(r.unreported(usage.unreported));
  const price = PRICES[info.model];
  const paid = paidCost(info.model, usage);
  if (!price || paid === null) return [...lines, r.costUnknown];
  if (price.input === 0 && price.output === 0) return [...lines, r.costFreeModel];
  if (price.freeTier) lines.push(r.costFree(info.name));
  lines.push(r.costPaid(dollars(paid), PRICES_CHECKED_ON));
  return lines;
}

function statusLine(input: ReportInput): string {
  if (input.status === 'completed') return r.status.completed(input.kept.length, input.dropped.length);
  if (input.status === 'cancelled') return r.status.cancelled(input.kept.length, input.dropped.length);
  const provider = input.provider ? PROVIDERS[input.provider].name : strings.hunt.yourProvider;
  const cap = input.cap ? { usd: usd(input.cap.usd), partial: input.cap.partial } : undefined;
  const why = strings.hunt.failedWhy(input.problem ?? 'unknown', provider, cap);
  return r.stopped([why, input.kept.length > 0 ? strings.hunt.keptBeforeStop(input.kept.length) : ''].filter(Boolean).join(' '));
}

/** The report as Markdown, ending with one new line. */
export function writeRunReport(input: ReportInput): string {
  const kept = [...input.kept];
  const posts = kept.filter((lead) => newGroupOf(lead) === 'post');
  const funding = kept.filter((lead) => newGroupOf(lead) === 'funding');
  const community = kept.filter((lead) => newGroupOf(lead) === 'community');

  const followups = input.leads.flatMap((lead) =>
    followupsDue(lead, input.date, input.cadence).map((due) =>
      r.followup(one(lead.company), lead.people[due.personIndex]?.emailedOn[0] ?? strings.unknown, due.number),
    ),
  );

  // A stage that ran to the end and kept nothing is a dry query (the skill's references/sources.md).
  const keptBy = { posts: posts.length, funding: funding.length, community: community.length };
  const dry = (['posts', 'funding', 'community'] as const)
    .filter((id) => input.steps.find((step) => step.id === id)?.state === 'done' && keptBy[id] === 0)
    .map((id) => `- ${r.dryStep[id]}`);

  const notSearched = input.steps
    .filter((step) => step.state === 'skipped' && step.skipReason)
    .map((step) => r.notSearched(strings.hunt.steps[step.id], strings.hunt.skipReasons[step.skipReason ?? 'not-built']));

  const lines = [
    r.title(input.date),
    '',
    ...(input.sample ? [r.sampleNote, ''] : []),
    statusLine(input),
    ...section(r.headings.posts, posts.map(postEntry)),
    ...section(r.headings.funding, funding.map(fundingEntry)),
    ...list(r.headings.followups, followups),
    ...list(r.headings.dry, dry),
    ...section(r.headings.community, community.map(communityEntry)),
    ...list(
      r.headings.dropped,
      input.dropped.map((drop) => r.dropped(one(drop.company), strings.dropReasons[drop.reason], one(drop.sourceUrl))),
    ),
    ...list(r.headings.failedSources, [
      ...input.failedSources.map((host) => `- ${one(host)}`),
      ...(input.unread > 0 ? [r.unread(input.unread)] : []),
    ]),
    ...list(r.headings.notSearched, notSearched),
    ...list(r.headings.cost, costLines(input)),
  ];
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

/** The report's file name: `YYYY-MM-DD.md`, then `-2`, `-3` for later hunts that day (FRD §11.1). */
export function reportFileName(date: string, earlierRunsThatDay: number): string {
  return r.fileName(date, earlierRunsThatDay + 1);
}
