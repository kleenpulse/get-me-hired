// The app's state: the saved data, the clock, and the hunt in progress.
// Screens read it with `useApp()` and change it only through its actions.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { localDate } from '@/core/dates';
import type { HuntProgress, HuntResult } from '@/core/hunt';
import type { Lead, LeadStatus } from '@/core/lead';
import { cleanProfile, type Profile } from '@/core/profile';
import {
  applyAutomaticMoves,
  markEmailed,
  markFollowupSent,
  setStatus,
  unmarkEmailed,
} from '@/core/lifecycle';
import { createSampleHunt, type Pause } from '@/core/sample-hunt';
import { buildSamplePipeline } from '@/core/sample-leads';
import { emptyData, type AppData, type RunRecord } from './data';
import {
  clearData,
  loadData,
  NewerDataError,
  StorageBlockedError,
  readPersistence,
  requestPersistence,
  saveData,
  type Persistence,
} from './storage';
import { strings } from './strings';

export interface HuntState {
  running: boolean;
  sample: boolean;
  progress: HuntProgress | null;
  /** The outcome of the last hunt in this session, in words. */
  message: string | null;
}

interface Actions {
  finishWelcome: () => void;
  startSampleMode: () => void;
  clearSampleData: () => void;
  runHunt: () => void;
  cancelHunt: () => void;
  markEmailed: (key: string, personIndex: number) => void;
  unmarkEmailed: (key: string, personIndex: number) => void;
  markFollowupSent: (key: string, personIndex: number) => void;
  setStatus: (key: string, status: LeadStatus) => void;
  /** Saves the profile, cleaned first, so what is saved is what `profile.md` can carry. */
  saveProfile: (profile: Profile) => void;
  /** Runs the app in memory only, after the browser refused to store data. */
  continueWithoutSaving: () => void;
  deleteEverything: () => Promise<void>;
}

export interface AppState {
  /** False until the saved data has been read. */
  ready: boolean;
  data: AppData;
  now: Date;
  /** The user's local date, `YYYY-MM-DD`. */
  today: string;
  persistence: Persistence | 'unknown';
  /** True when the last save failed, so the user can be told. */
  saveFailed: boolean;
  /** Why the saved data could not be opened. Nothing is saved over it while this is set. */
  loadFailed: false | 'broken' | 'newer' | 'blocked';
  /** True when the user chose to go on in a browser that won't store data. Nothing is saved. */
  savingOff: boolean;
  hunt: HuntState;
  actions: Actions;
}

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const state = useContext(AppContext);
  if (!state) throw new Error('useApp must be used inside <AppProvider>');
  return state;
}

const CLOCK_MS = 30_000;
const IDLE_HUNT: HuntState = { running: false, sample: false, progress: null, message: null };

/** Waits `ms`, and ends early with `false` when the hunt is cancelled. */
const pause: Pause = (ms, signal) =>
  new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });

function replaceLead(data: AppData, key: string, change: (lead: Lead) => Lead): AppData {
  let changed = false;
  const leads = data.leads.map((lead) => {
    if (lead.key !== key) return lead;
    const next = change(lead);
    if (next !== lead) changed = true;
    return next;
  });
  return changed ? { ...data, leads } : data;
}

/** Adds the leads a hunt found. A lead whose key already exists changes nothing (FR-6.8). */
function addFound(data: AppData, result: HuntResult, now: Date, sample: boolean): AppData {
  const known = new Set(data.leads.map((lead) => lead.key));
  const fresh = result.leads.filter((lead) => !known.has(lead.key));
  const run: RunRecord = {
    at: now.toISOString(),
    date: localDate(now),
    status: result.status,
    kept: fresh.length,
    dropped: result.dropped,
    sample,
  };
  return { ...data, leads: [...data.leads, ...fresh], runs: [...data.runs, run] };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<AppData>(emptyData);
  const [now, setNow] = useState(() => new Date());
  const [persistence, setPersistence] = useState<AppState['persistence']>('unknown');
  const [saveFailed, setSaveFailed] = useState(false);
  const [loadFailed, setLoadFailed] = useState<AppState['loadFailed']>(false);
  const [savingOff, setSavingOff] = useState(false);
  const [hunt, setHunt] = useState<HuntState>(IDLE_HUNT);

  const today = localDate(now);
  const huntControl = useRef<AbortController | null>(null);
  const askedToPersist = useRef(false);
  const loaded = useRef<AppData | null>(null);
  // The newest data, for code that runs outside a render (a hunt finishing).
  const latest = useRef(data);
  latest.current = data;

  // Read the saved data once.
  useEffect(() => {
    let active = true;
    loadData()
      .then((saved) => {
        if (!active) return;
        if (saved) {
          loaded.current = saved;
          setData(saved);
        }
      })
      .catch(
        (error: unknown) =>
          active &&
          setLoadFailed(
            error instanceof NewerDataError ? 'newer' : error instanceof StorageBlockedError ? 'blocked' : 'broken',
          ),
      )
      .finally(() => active && setReady(true));
    readPersistence()
      .then((value) => active && setPersistence(value))
      .catch(() => active && setPersistence('unsupported'));
    return () => {
      active = false;
    };
  }, []);

  // Save after every change. The first real save also asks the browser to keep the data (AC-9.1).
  useEffect(() => {
    if (!ready || loadFailed || savingOff || data === loaded.current) return;
    loaded.current = data;
    saveData(data).then(
      () => setSaveFailed(false),
      () => setSaveFailed(true),
    );
    if (!askedToPersist.current) {
      askedToPersist.current = true;
      requestPersistence().then(setPersistence, () => setPersistence('unsupported'));
    }
  }, [data, ready, loadFailed, savingOff]);

  // Keep the clock moving, so ages and "today" stay right while the tab is open.
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, CLOCK_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  // The two moves the app makes on its own (FRD §8.2 rule 6), on open and when the date changes.
  useEffect(() => {
    if (!ready) return;
    setData((current) => {
      const moment = new Date();
      let changed = false;
      const leads = current.leads.map((lead) => {
        const next = applyAutomaticMoves(lead, today, moment, current.settings.cadence);
        if (next !== lead) changed = true;
        return next;
      });
      return changed ? { ...current, leads } : current;
    });
  }, [ready, today]);

  // Stop a running hunt if the app goes away.
  useEffect(() => () => huntControl.current?.abort(), []);

  const runHunt = useCallback(() => {
    // A second click while a hunt runs does nothing (AC-4.1).
    if (huntControl.current) return;
    // Only the sample hunt exists so far. A real hunt will plug in here with the same shape.
    if (!data.settings.sampleMode) return;

    const control = new AbortController();
    huntControl.current = control;
    setHunt({ running: true, sample: true, progress: null, message: null });

    createSampleHunt(pause)({
      now: new Date(),
      signal: control.signal,
      onProgress: (progress) => setHunt((current) => ({ ...current, progress })),
    })
      .then((result) => {
        const finishedAt = new Date();
        const known = new Set(latest.current.leads.map((lead) => lead.key));
        const added = result.leads.filter((lead) => !known.has(lead.key)).length;
        setData((current) => addFound(current, result, finishedAt, true));
        setHunt((current) => ({
          ...current,
          running: false,
          progress: { steps: result.steps, kept: result.leads.length, dropped: result.dropped.length },
          message:
            result.status === 'cancelled'
              ? strings.hunt.cancelled(result.leads.length)
              : result.leads.length === 0 || added === 0
                ? strings.hunt.nothingNew
                : strings.hunt.finished(added),
        }));
      })
      .finally(() => {
        huntControl.current = null;
      });
  }, [data.settings.sampleMode]);

  const actions = useMemo<Actions>(() => {
    const update = (key: string, change: (lead: Lead, moment: Date) => Lead) =>
      setData((current) => {
        const moment = new Date();
        return replaceLead(current, key, (lead) => change(lead, moment));
      });

    return {
      finishWelcome: () =>
        setData((current) => ({ ...current, settings: { ...current.settings, welcomeDone: true } })),

      startSampleMode: () =>
        setData((current) => {
          if (current.settings.sampleMode) return current;
          const known = new Set(current.leads.map((lead) => lead.key));
          const pipeline = buildSamplePipeline(new Date()).filter((lead) => !known.has(lead.key));
          return {
            ...current,
            leads: [...current.leads, ...pipeline],
            settings: { ...current.settings, sampleMode: true },
          };
        }),

      clearSampleData: () => {
        huntControl.current?.abort();
        setHunt(IDLE_HUNT);
        setData((current) => ({
          ...current,
          leads: current.leads.filter((lead) => !lead.sample),
          runs: current.runs.filter((run) => !run.sample),
          settings: { ...current.settings, sampleMode: false },
        }));
      },

      runHunt,
      cancelHunt: () => huntControl.current?.abort(),

      markEmailed: (key, personIndex) =>
        update(key, (lead, moment) => markEmailed(lead, personIndex, localDate(moment), moment)),
      unmarkEmailed: (key, personIndex) => update(key, (lead, moment) => unmarkEmailed(lead, personIndex, moment)),
      markFollowupSent: (key, personIndex) =>
        update(key, (lead, moment) => markFollowupSent(lead, personIndex, localDate(moment))),
      setStatus: (key, status) => update(key, (lead, moment) => setStatus(lead, status, localDate(moment), moment)),

      saveProfile: (profile) => setData((current) => ({ ...current, profile: cleanProfile(profile) })),

      // Skips the welcome screens: their last step says data is saved, which isn't true now.
      continueWithoutSaving: () => {
        setSavingOff(true);
        setLoadFailed(false);
        setData((current) => ({ ...current, settings: { ...current.settings, welcomeDone: true } }));
      },

      deleteEverything: async () => {
        huntControl.current?.abort();
        await clearData();
        const fresh = emptyData();
        loaded.current = fresh;
        setHunt(IDLE_HUNT);
        setData(fresh);
      },
    };
  }, [runHunt]);

  const state = useMemo<AppState>(
    () => ({ ready, data, now, today, persistence, saveFailed, loadFailed, savingOff, hunt, actions }),
    [ready, data, now, today, persistence, saveFailed, loadFailed, savingOff, hunt, actions],
  );

  return <AppContext.Provider value={state}>{children}</AppContext.Provider>;
}
