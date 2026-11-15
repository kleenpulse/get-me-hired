// The sample hunt (FR-1.4). It searches nothing and calls no provider: it
// plays back invented results through the same steps a real hunt takes, so
// people can see how a hunt works before they add a key.

import {
  waitingSteps,
  type DroppedLead,
  type HuntOptions,
  type HuntResult,
  type HuntRunner,
  type HuntStep,
  type HuntStepId,
} from './hunt';
import type { Lead } from './lead';
import { buildSampleFinds } from './sample-leads';

/** Waits, and ends early with `false` if the hunt is cancelled. */
export type Pause = (ms: number, signal: AbortSignal) => Promise<boolean>;

const STEP_MS = 900;

const DROPPED: Record<'posts' | 'funding' | 'community', DroppedLead[]> = {
  posts: [
    { company: 'Brindle Staffing', reason: 'recruiter', sourceUrl: 'https://brindlestaffing.example/sample-post' },
    { company: 'Fennel Robotics', reason: 'role-mismatch', sourceUrl: 'https://fennelrobotics.example/sample-post' },
    { company: 'Oakmere', reason: 'stale', sourceUrl: 'https://oakmere.example/sample-post' },
    { company: 'Saltbox', reason: 'too-popular', sourceUrl: 'https://saltbox.example/sample-post' },
  ],
  funding: [
    { company: 'Pinewell', reason: 'stale', sourceUrl: 'https://pinewell.example/news/seed' },
    { company: 'Glasswing', reason: 'unverifiable', sourceUrl: 'https://glasswing.example/news' },
  ],
  community: [
    { company: 'Ironbark', reason: 'location', sourceUrl: 'https://ironbark.example/sample-hiring-thread' },
    { company: 'Tamarack', reason: 'pay-below-floor', sourceUrl: 'https://tamarack.example/sample-hiring-thread' },
  ],
};

/** Builds a sample hunt. `pause` is passed in so tests can run it with no real waiting. */
export function createSampleHunt(pause: Pause): HuntRunner {
  return async ({ now, signal, onProgress }: HuntOptions): Promise<HuntResult> => {
    const finds = buildSampleFinds(now);
    const steps: HuntStep[] = waitingSteps();
    const leads: Lead[] = [];
    const dropped: DroppedLead[] = [];

    const report = () => onProgress({ steps: steps.map((step) => ({ ...step })), kept: leads.length, dropped: dropped.length });
    const set = (id: HuntStepId, change: Partial<HuntStep>) => {
      const step = steps.find((entry) => entry.id === id);
      if (step) Object.assign(step, change);
      report();
    };

    /** Runs one step. Returns false if the hunt was cancelled while it ran. */
    const run = async (id: HuntStepId, count: number, finish: () => void): Promise<boolean> => {
      set(id, { state: 'running' });
      if (!(await pause(STEP_MS, signal))) return false;
      finish();
      set(id, { state: 'done', count });
      return true;
    };

    report();
    const finished =
      (await run('posts', finds.posts.length + DROPPED.posts.length, () => {})) &&
      (await run('freshness', finds.posts.length + DROPPED.posts.length, () => {
        leads.push(...finds.posts);
        dropped.push(...DROPPED.posts);
      })) &&
      (await run('funding', finds.funding.length + DROPPED.funding.length, () => {
        leads.push(...finds.funding);
        dropped.push(...DROPPED.funding);
      })) &&
      (await run('community', finds.community.length + DROPPED.community.length, () => {
        leads.push(...finds.community);
        dropped.push(...DROPPED.community);
      })) &&
      (await run('contacts', leads.reduce((total, lead) => total + lead.people.length, 0), () => {}));

    return { status: finished ? 'completed' : 'cancelled', leads, dropped, steps };
  };
}
