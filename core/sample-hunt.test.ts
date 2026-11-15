import { describe, expect, it } from 'vitest';
import { DROP_REASONS, HUNT_STEPS, type HuntProgress } from './hunt';
import { emailContacts } from './lead';
import { followupsDue } from './lifecycle';
import { buildToday, computeTier } from './ranking';
import { createSampleHunt, type Pause } from './sample-hunt';
import { buildSampleFinds, buildSamplePipeline } from './sample-leads';
import { localDate } from './dates';

const NOW = new Date(2026, 10, 16, 9, 0, 0); // a Monday morning, local time
const instant: Pause = async (_ms, signal) => !signal.aborted;

describe('sample leads (FR-1.4)', () => {
  const finds = buildSampleFinds(NOW);
  const all = [...finds.posts, ...finds.funding, ...finds.community, ...buildSamplePipeline(NOW)];

  it('marks every lead as a sample', () => {
    expect(all.length).toBeGreaterThanOrEqual(8);
    expect(all.every((lead) => lead.sample)).toBe(true);
  });

  it('uses only invented .example addresses and links', () => {
    for (const lead of all) {
      const urls = [lead.companyUrl, ...lead.sources.map((source) => source.url), ...lead.hooks.map((hook) => hook.url)];
      for (const url of urls) expect(new URL(url).hostname.endsWith('.example')).toBe(true);
      for (const contact of emailContacts(lead)) expect(contact.value.endsWith('.example')).toBe(true);
    }
  });

  it('gives every email exactly one label, with evidence for Published and Pattern (AC-5.3)', () => {
    for (const lead of all) {
      for (const contact of emailContacts(lead)) {
        expect(['published', 'pattern', 'guess']).toContain(contact.label);
        if (contact.label !== 'guess') expect(contact.evidence).toBeTruthy();
      }
    }
  });

  it('gives each lead 1 to 3 hooks, each with a link, and a fit line of at most 140 characters', () => {
    for (const lead of all) {
      expect(lead.hooks.length).toBeGreaterThanOrEqual(1);
      expect(lead.hooks.length).toBeLessThanOrEqual(3);
      expect(lead.fit.length).toBeLessThanOrEqual(140);
      expect(lead.people.length).toBeLessThanOrEqual(3);
    }
  });

  it('stores the tier that the signals and addresses give', () => {
    for (const lead of all) expect(lead.tier).toBe(computeTier(lead));
    expect(new Set(all.map((lead) => lead.tier))).toEqual(new Set(['A', 'B', 'C']));
  });

  it('has unique keys', () => {
    expect(new Set(all.map((lead) => lead.key)).size).toBe(all.length);
  });

  it('includes a follow-up that is due, so Today shows one', () => {
    const today = localDate(NOW);
    const due = buildSamplePipeline(NOW).flatMap((lead) => followupsDue(lead, today));
    expect(due).toHaveLength(1);
    const list = buildToday(all, { today, nowMs: NOW.getTime(), dailyTarget: 20 });
    expect(list.entries[0]?.group).toBe('followup');
  });
});

describe('the sample hunt', () => {
  it('runs every step in order and reports progress', async () => {
    const seen: HuntProgress[] = [];
    const result = await createSampleHunt(instant)({
      now: NOW,
      signal: new AbortController().signal,
      onProgress: (progress) => seen.push(progress),
    });

    expect(result.status).toBe('completed');
    expect(result.steps.map((step) => step.id)).toEqual([...HUNT_STEPS]);
    expect(result.steps.every((step) => step.state === 'done' && step.count !== null)).toBe(true);
    expect(result.leads).toHaveLength(5);
    expect(result.dropped).toHaveLength(8);

    // The counts only ever go up, and the last report matches the result.
    const kept = seen.map((progress) => progress.kept);
    expect(kept).toEqual([...kept].sort((a, b) => a - b));
    expect(seen.at(-1)).toMatchObject({ kept: 5, dropped: 8 });
    // At most one step runs at a time.
    for (const progress of seen) {
      expect(progress.steps.filter((step) => step.state === 'running').length).toBeLessThanOrEqual(1);
    }
  });

  it('gives every dropped lead exactly one reason code from §9.1', async () => {
    const result = await createSampleHunt(instant)({ now: NOW, signal: new AbortController().signal, onProgress: () => {} });
    for (const dropped of result.dropped) expect(DROP_REASONS).toContain(dropped.reason);
  });

  it('keeps what it found when cancelled partway (AC-4.10)', async () => {
    const controller = new AbortController();
    let pauses = 0;
    // Cancel during the third step, after the posts were kept.
    const pause: Pause = async () => {
      pauses += 1;
      if (pauses === 3) controller.abort();
      return !controller.signal.aborted;
    };
    const result = await createSampleHunt(pause)({ now: NOW, signal: controller.signal, onProgress: () => {} });

    expect(result.status).toBe('cancelled');
    expect(result.leads).toHaveLength(2);
    expect(result.steps.map((step) => step.state)).toEqual(['done', 'done', 'running', 'waiting', 'waiting']);
  });

  it('finds nothing when cancelled before it starts', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await createSampleHunt(instant)({ now: NOW, signal: controller.signal, onProgress: () => {} });
    expect(result).toMatchObject({ status: 'cancelled', leads: [], dropped: [] });
  });
});
