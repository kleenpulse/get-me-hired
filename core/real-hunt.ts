// A real hunt on the user's own key. It runs the stages that need no search
// provider, in the order of the steps in hunt.ts, and speaks that file's
// shape, so the screens are the same as for the sample hunt.
//
//   posts, freshness  skipped: they need web search (FRD §19)
//   funding           core/funding.ts: news listings, read by Gemini's page reader
//   community         core/hn-hunt.ts: the Hacker News "Who is hiring?" thread
//
// Load this module with a dynamic import: it sets up Zod before any schema
// exists (see loadSdk in providers.ts).

import { waitingSteps, type DroppedLead, type HuntResult, type HuntRunner, type HuntStep, type HuntStepId } from './hunt';
import type { Lead } from './lead';
import type { Profile } from './profile';
import { classifyProviderError, loadModel, loadSdk, type KeyProblem, type ProviderId } from './providers';

export interface RealHuntSettings {
  provider: ProviderId;
  key: string;
  profile: Profile;
  fetch: typeof globalThis.fetch;
  /** Keys of leads already saved, so a known one is reported as a duplicate. */
  knownKeys: ReadonlySet<string>;
  /** Sources can be switched off (FR-4.12). Both are on unless set to false. */
  sources?: { funding?: boolean; community?: boolean };
  /** The funding listing pages to read. Defaults to FUNDING_LISTINGS in funding.ts. */
  fundingListings?: readonly string[];
}

/** What a stage gets: the settings, the SDK, and one place to keep and drop leads. */
export interface StageContext {
  settings: RealHuntSettings;
  now: Date;
  signal: AbortSignal;
  sdk: Awaited<ReturnType<typeof loadSdk>>;
  model: Awaited<ReturnType<typeof loadModel>>;
  set: (id: HuntStepId, change: Partial<HuntStep>) => void;
  /** Keeps a lead, or reports it as a duplicate of one already saved or found in this run. */
  keep: (lead: Lead) => void;
  drop: (dropped: DroppedLead) => void;
  /** Openings or items that could not be read (FR-4.11). */
  addUnread: (count: number) => void;
  /** A source that couldn't be searched today, by host name (FR-4.11). */
  addFailedSource: (host: string) => void;
}

/** How a stage ended. A key or account problem stops the whole hunt. */
export type StageEnd = 'done' | 'cancelled' | { stop: NonNullable<HuntResult['problem']> };

/** Problems that would fail every later call too, so the hunt stops at once. */
export function stopsTheHunt(error: unknown): KeyProblem | null {
  const problem = classifyProviderError(error);
  return problem === 'wrong-key' || problem === 'no-credit' || problem === 'no-connection' || problem === 'rate-limited'
    ? problem
    : null;
}

export function createRealHunt(settings: RealHuntSettings): HuntRunner {
  return async ({ now, signal, onProgress }): Promise<HuntResult> => {
    const steps: HuntStep[] = waitingSteps();
    const leads: Lead[] = [];
    const dropped: DroppedLead[] = [];
    const failedSources: string[] = [];
    let unread = 0;

    const report = () => onProgress({ steps: steps.map((step) => ({ ...step })), kept: leads.length, dropped: dropped.length });
    const set = (id: HuntStepId, change: Partial<HuntStep>) => {
      Object.assign(steps.find((step) => step.id === id) ?? {}, change);
      report();
    };
    const finish = (status: HuntResult['status'], problem?: HuntResult['problem']): HuntResult => ({
      status,
      leads,
      dropped,
      steps: steps.map((step) => ({ ...step })),
      ...(problem ? { problem } : {}),
      ...(unread > 0 ? { unread } : {}),
      ...(failedSources.length > 0 ? { failedSources } : {}),
    });

    // Fresh posts and their age check need web search, which no free key has (FRD §19).
    set('posts', { state: 'skipped', skipReason: 'needs-search' });
    set('freshness', { state: 'skipped', skipReason: 'needs-search' });

    let sdk: StageContext['sdk'];
    let model: StageContext['model'];
    try {
      sdk = await loadSdk();
      model = await loadModel(settings.provider, settings.key, settings.fetch);
    } catch (error) {
      // Nothing could run, so no step is left "waiting" beside the failure (a failed
      // download of the SDK while offline reads as no connection). A stage that is
      // switched off says so, as in the stage loop below: it didn't fail, it wasn't run.
      const on = { funding: settings.sources?.funding !== false, community: settings.sources?.community !== false };
      for (const id of ['funding', 'community'] as const) {
        set(id, on[id] ? { state: 'failed' } : { state: 'skipped', skipReason: 'switched-off' });
      }
      set('contacts', { state: 'failed' });
      return finish('failed', classifyProviderError(error));
    }

    const context: StageContext = {
      settings,
      now,
      signal,
      sdk,
      model,
      set,
      keep: (lead) => {
        if (settings.knownKeys.has(lead.key) || leads.some((found) => found.key === lead.key)) {
          dropped.push({ company: lead.company, reason: 'duplicate', sourceUrl: lead.sources[0]?.url ?? '' });
        } else leads.push(lead);
        report();
      },
      drop: (entry) => {
        dropped.push(entry);
        report();
      },
      addUnread: (count) => {
        unread += count;
      },
      addFailedSource: (host) => {
        if (!failedSources.includes(host)) failedSources.push(host);
      },
    };

    const stages: [HuntStepId, boolean, () => Promise<StageEnd>][] = [
      ['funding', settings.sources?.funding !== false, async () => (await import('./funding')).runFundingStage(context)],
      ['community', settings.sources?.community !== false, async () => (await import('./hn-hunt')).runHnStage(context)],
    ];
    for (const [id, on, run] of stages) {
      if (!on) {
        set(id, { state: 'skipped', skipReason: 'switched-off' });
        continue;
      }
      if (signal.aborted) return finish('cancelled');
      const end = await run();
      if (end === 'cancelled') return finish('cancelled');
      if (end !== 'done') return finish('failed', end.stop);
    }

    set('contacts', { state: 'done', count: leads.reduce((total, lead) => total + lead.people.length, 0) });
    return finish('completed');
  };
}
