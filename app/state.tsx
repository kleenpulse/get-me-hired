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
import { flushSync } from 'react-dom';
import { sameEntry, type BlockEntry } from '@/core/block';
import { spentThisMonth } from '@/core/budget';
import { localDate } from '@/core/dates';
import { waitingSteps, type HuntProgress, type HuntResult, type HuntRunner, type HuntStep } from '@/core/hunt';
import type { Lead, LeadStatus, StatusChange } from '@/core/lead';
import { cleanProfile, missingFields, type Profile } from '@/core/profile';
import { classifyProviderError, PROVIDER_IDS, PROVIDERS, type ProviderId } from '@/core/providers';
import {
  applyAutomaticMoves,
  markEmailed,
  markFollowupSent,
  setStatus,
  undoStatus,
  unmarkEmailed,
  type SetStatusOptions,
} from '@/core/lifecycle';
import { createSampleHunt, type Pause } from '@/core/sample-hunt';
import { buildSamplePipeline } from '@/core/sample-leads';
import { emptyData, type AppData, type Settings } from './data';
import { applyDisplay, clearDisplayCopy, DEFAULT_DISPLAY, writeDisplayCopy } from './display';
import {
  clearData,
  loadData,
  NewerDataError,
  StorageBlockedError,
  readPersistence,
  requestPersistence,
  saveData,
  saveSealedKeys,
  loadKeyRecord,
  type KeyRecord,
  saveKeys,
  type Persistence,
  type StoredKeys,
} from './storage';
import type { Incoming, MergeSummary } from './backup';
import { downloadBlob } from './download';
import { deletePerson } from './erase';
import { capAllowsStart, capState, type CapState } from './cap';
import { addFound, applyBlocks } from './found';
import { browserLocks, withHuntLock } from './hunt-lock';
import { unsavedScreen } from './router';
import { shouldRunOnOpen } from './run-on-open';
import { anySourceOn, huntSources } from './sources';
import { TabSync } from './tab-sync';
import { newPassphrase, openKeys, sealedProviders, sealKeys, unlock, WrongPassphraseError, type Unlocked } from '@/core/key-crypto';
import { usd } from './format';
import { strings } from './strings';

export interface HuntState {
  running: boolean;
  sample: boolean;
  progress: HuntProgress | null;
  /** The outcome of the last hunt in this session, in words. */
  message: string | null;
  /** True when that hunt stopped with a problem, so the message is shown as one. */
  failed?: boolean;
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
  /**
   * A manual move (§8.2 rule 5). For "not-now", `snoozeUntil` is the return date
   * (FR-6.12). Returns what Undo needs, or null when nothing moved.
   */
  setStatus: (key: string, status: LeadStatus, options?: SetStatusOptions) => MoveRecord | null;
  /** Undoes a move within its 10 seconds (FR-6.13). False when the lead changed since, so it can't. */
  undoStatus: (move: MoveRecord) => boolean;
  /** Saves the profile, cleaned first, so what is saved is what `profile.md` can carry. */
  saveProfile: (profile: Profile) => void;
  /** Runs the app in memory only, after the browser refused to store data. */
  continueWithoutSaving: () => void;
  /** Changes settings that save as they're made: the daily target, the cadence, the display (FR-10.2, FR-10.5). */
  updateSettings: (change: Partial<Pick<Settings, 'dailyTarget' | 'cadence' | 'display' | 'monthlyCap' | 'runOnOpen' | 'sources'>>) => void;
  /**
   * Adds entries to the do-not-contact list (FR-5.7) and applies them to saved
   * leads at once: leads on a blocked domain are removed, and blocked people and
   * addresses taken off. Returns how many leads were removed.
   */
  block: (entries: BlockEntry[]) => number;
  unblock: (entry: BlockEntry) => void;
  /**
   * Deletes one person's name and contacts everywhere the app stores them, and
   * keeps the company lead (FR-9.5). With `block`, they also go on the
   * do-not-contact list. False when that person isn't at that place any more.
   */
  deletePerson: (key: string, personIndex: number, name: string, block: BlockEntry | null) => boolean;
  /** Downloads a backup ZIP of the real data, and notes the date (FR-9.2). */
  exportBackup: () => Promise<void>;
  /** Brings a read backup in, merged by lead key (FR-6.8). Resolves with what happened. */
  importBackup: (incoming: Incoming, replaceProfile: boolean) => Promise<MergeSummary>;
  /** Stores a key that passed its test and makes its provider the one hunts use. Rejects if storage fails. */
  saveKey: (provider: ProviderId, key: string) => Promise<void>;
  /** Deletes a key from storage at once (AC-10.1). Rejects if storage fails. */
  removeKey: (provider: ProviderId) => Promise<void>;
  deleteEverything: () => Promise<void>;
  /** Opens the encrypted keys for this tab. False when the passphrase isn't right. */
  unlockKeys: (passphrase: string) => Promise<boolean>;
  /** Encrypts the stored keys with a new passphrase, or changes it while unlocked. */
  setPassphrase: (passphrase: string) => Promise<void>;
  /** Stores the keys plain again. Only while unlocked. */
  removePassphrase: () => Promise<void>;
  /** Forgets the keys in this tab until the passphrase is entered again. */
  lockKeys: () => void;
  /** A forgotten passphrase: deletes every stored key. Nothing can be recovered. */
  forgetKeys: () => Promise<void>;
  /** Hides the note that another tab changed the data. */
  dismissChangedElsewhere: () => void;
}

/** What Undo needs about one move (FR-6.13). */
export interface MoveRecord {
  key: string;
  /** The lead as it was before the move. */
  before: Lead;
  /** The move's own history entry. */
  entry: StatusChange;
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
  /**
   * Set when another tab's data was read in and something here gave way to it:
   * `dropped`, a save here was refused; `draft-kept`, unsaved form changes here were kept;
   * `keys-locked`, another tab changed the key passphrase, so the keys here were locked.
   */
  changedElsewhere: false | 'dropped' | 'draft-kept' | 'keys-locked';
  /**
   * The key passphrase (FR-10.4): `none`, keys are stored plain; `locked`, they're
   * encrypted and this tab hasn't been given the passphrase; `unlocked`, it has.
   */
  keyLock: KeyLock;
  /** Counts the times another tab's saved data was read in. Screens use it as a key, so their forms start over. */
  reloads: number;
  /**
   * The providers that have a key saved. The keys themselves stay inside the
   * provider component, so no screen can show or log one by accident.
   */
  keyProviders: ProviderId[];
  hunt: HuntState;
  actions: Actions;
}

export type KeyLock = 'none' | 'locked' | 'unlocked';

function providersWithKeys(keys: StoredKeys): ProviderId[] {
  return PROVIDER_IDS.filter((id) => Boolean(keys[id]));
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

function providerName(provider: ProviderId | null): string {
  return provider ? PROVIDERS[provider].name : strings.hunt.yourProvider;
}

/** The outcome of a hunt, in words. */
function huntMessage(result: HuntResult, added: number, provider: ProviderId | null, data: AppData, today: string): string {
  if (result.status === 'failed') {
    // A hunt stopped at the cap names it, and says when the month's total leaves calls out (AC-4.13).
    const cap =
      result.problem === 'cap-reached'
        ? { usd: usd(data.settings.monthlyCap), partial: spentThisMonth(data.runs, today).partial || (result.usage?.unreported ?? 0) > 0 }
        : undefined;
    return strings.hunt.failed(result.problem ?? 'unknown', providerName(provider), added, cap);
  }
  if (result.status === 'cancelled') return strings.hunt.cancelled(result.leads.length);
  const outcome = added === 0 ? strings.hunt.nothingNew : strings.hunt.finished(added);
  return [
    outcome,
    result.failedSources?.length ? strings.hunt.failedSources(result.failedSources) : '',
    result.unread ? strings.hunt.unread(result.unread) : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<AppData>(emptyData);
  const [now, setNow] = useState(() => new Date());
  const [persistence, setPersistence] = useState<AppState['persistence']>('unknown');
  const [saveFailed, setSaveFailed] = useState(false);
  const [loadFailed, setLoadFailed] = useState<AppState['loadFailed']>(false);
  const [savingOff, setSavingOff] = useState(false);
  // The same flag for the actions, which are made once and don't see new renders.
  const savingOffRef = useRef(false);
  const [keyProviders, setKeyProviders] = useState<ProviderId[]>([]);
  // The keys themselves. Never put in React state or context (see AppState.keyProviders).
  const keys = useRef<StoredKeys>({});
  // The AES key derived from the passphrase, while this tab is unlocked. Memory only, never
  // stored or sent to other tabs, so each tab asks once and a reload asks again (FR-10.4).
  const unlocked = useRef<Unlocked | null>(null);
  const [keyLock, setKeyLock] = useState<KeyLock>('none');
  const keyLockRef = useRef<KeyLock>('none');
  keyLockRef.current = keyLock;
  const [hunt, setHunt] = useState<HuntState>(IDLE_HUNT);

  const today = localDate(now);
  const huntControl = useRef<AbortController | null>(null);
  const askedToPersist = useRef(false);
  const loaded = useRef<AppData | null>(null);
  // The newest data, for code that runs outside a render (a hunt finishing).
  const latest = useRef(data);
  latest.current = data;
  // Tells the other tabs of this app that the saved data changed.
  const channel = useRef<BroadcastChannel | null>(null);
  const [changedElsewhere, setChangedElsewhere] = useState<AppState['changedElsewhere']>(false);
  const [reloads, setReloads] = useState(0);

  // Keeps this tab in step with the others: ordered writes over the right revision, and
  // never a copy built before another tab's data was read in (tab-sync.ts).
  const sync = useRef<TabSync | null>(null);
  if (!sync.current) {
    sync.current = new TabSync(
      { load: loadData, save: saveData },
      {
        replace: (next) => {
          loaded.current = next;
          setData(next);
          setReloads((count) => count + 1);
          // Profile with unsaved changes keeps them (App.tsx doesn't re-key it). Say so.
          if (unsavedScreen() === 'profile') setChangedElsewhere((current) => current || 'draft-kept');
        },
        dropped: () => setChangedElsewhere('dropped'),
      },
    );
  }
  const tabSync = sync.current;

  /**
   * Takes in the keys record as stored. Sealed keys open only with the key this tab already
   * holds for that same record. When another tab set, changed or removed the passphrase,
   * that key no longer fits, so the keys here lock, and the app says so.
   */
  const takeKeys = useCallback(async (record: KeyRecord) => {
    if (record.kind === 'plain') {
      unlocked.current = null;
      keys.current = record.keys;
      setKeyProviders(providersWithKeys(record.keys));
      setKeyLock('none');
      return;
    }
    setKeyProviders(sealedProviders(record.sealed));
    const held = unlocked.current;
    if (held) {
      try {
        keys.current = await openKeys(record.sealed, held);
        setKeyLock('unlocked');
        return;
      } catch {
        setChangedElsewhere((current) => current || 'keys-locked');
      }
    }
    unlocked.current = null;
    keys.current = {};
    setKeyLock('locked');
  }, []);

  /** Reads the saved data and keys again, after another tab changed them. */
  const readAgain = useCallback(async () => {
    await tabSync.reload();
    await takeKeys(await loadKeyRecord());
  }, [tabSync, takeKeys]);

  /** Writes the data, and tells the other tabs. A copy another tab made stale is never written. */
  const write = useCallback(
    async (next: AppData): Promise<void> => {
      const outcome = await tabSync.write(next);
      if (outcome === 'saved') {
        setSaveFailed(false);
        channel.current?.postMessage('saved');
      } else if (outcome === 'failed') setSaveFailed(true);
    },
    [tabSync],
  );

  // Read the saved data once.
  useEffect(() => {
    let active = true;
    loadData()
      .then((saved) => {
        if (!active) return;
        const first = tabSync.start(saved);
        if (first) {
          loaded.current = first;
          setData(first);
        }
        // Keys are read only once the data opened, so a broken store shows one error, not two.
        return loadKeyRecord().then((record) => (active ? takeKeys(record) : undefined));
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
    void write(data);
    if (!askedToPersist.current) {
      askedToPersist.current = true;
      requestPersistence().then(setPersistence, () => setPersistence('unsupported'));
    }
  }, [data, ready, loadFailed, savingOff, write]);

  // Other tabs: read the data again when one of them saves, and when this tab is shown
  // again, in case a message was missed. Changes save as they're made, so there's no
  // unsaved work here to lose by reading again.
  useEffect(() => {
    if (!ready || loadFailed || savingOff) return;
    const again = () => void readAgain().catch(() => {});
    const onShow = () => document.visibilityState === 'visible' && again();
    document.addEventListener('visibilitychange', onShow);
    const tabs = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('get-me-hired');
    if (tabs) tabs.onmessage = again;
    channel.current = tabs;
    return () => {
      document.removeEventListener('visibilitychange', onShow);
      tabs?.close();
      channel.current = null;
    };
  }, [ready, loadFailed, savingOff, readAgain]);

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

  // The two moves the app makes on its own (FRD §8.2 rule 6): on open, when the date changes,
  // and when the follow-up rules change, so a confirmed new cadence closes those leads at once.
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
  }, [ready, today, data.settings.cadence]);

  // Theme and text size follow the settings. The fast copy is kept only when saving is on (display.ts).
  const display = data.settings.display;
  useEffect(() => {
    if (!ready) return;
    applyDisplay(display);
    if (savingOff || loadFailed) return;
    // Kept only when it differs from the defaults, so after "Delete everything" nothing is left behind.
    if (display.theme === DEFAULT_DISPLAY.theme && display.textSize === DEFAULT_DISPLAY.textSize) clearDisplayCopy();
    else writeDisplayCopy(display);
  }, [ready, display, savingOff, loadFailed]);

  // Stop a running hunt if the app goes away.
  useEffect(() => () => huntControl.current?.abort(), []);

  // True while changes are saved (see the save effect), for code that runs outside a render.
  const canSave = useRef(false);
  canSave.current = ready && !loadFailed && !savingOff;

  /**
   * Applies a change at once and writes it to storage, resolving when it's written. A
   * hunt holds the cross-tab lock until its run is saved, so another tab that takes the
   * lock next reads it (hunt-lock.ts).
   */
  const commit = useCallback((change: (current: AppData) => AppData): Promise<void> => {
    const next: { data: AppData | null } = { data: null };
    flushSync(() =>
      setData((current) => {
        next.data = change(current);
        return next.data;
      }),
    );
    if (!canSave.current || !next.data) return Promise.resolve();
    // Written here, so the lock is held until it lands. The save effect then has nothing to do.
    loaded.current = next.data;
    return write(next.data);
  }, [write]);

  /** One hunt, from loading the runner to saving what it found. Resolves once its run is written. */
  const huntWith = useCallback(
    (
      control: AbortController,
      sample: boolean,
      provider: ProviderId | null,
      key: string | undefined,
      profile: Profile | null,
      leads: readonly Lead[],
      cap: CapState | null,
    ): Promise<void> => {
      // The real hunt and the AI SDK load only now, so the first page load doesn't pay for them.
      const runner: Promise<HuntRunner> =
        sample || !provider || !key || !profile
          ? Promise.resolve(createSampleHunt(pause))
          : import('@/core/real-hunt').then(({ createRealHunt }) =>
              createRealHunt({
                provider,
                key,
                profile,
                fetch: window.fetch.bind(window),
                knownKeys: new Set(leads.map((lead) => lead.key)),
                blockList: latest.current.doNotContact,
                // The user's switches (FR-10.3). Funding stays off: Gemini's page reader can't see
                // links, so no round can be confirmed at its own article (AC-4.6). It comes back
                // with a page reader that returns links (Firecrawl, FR-2.3). FRD §19.
                sources: huntSources(latest.current.settings),
                // Checked before every model call. A free model has no cap to reach.
                ...(cap && cap.kind === 'ok' ? { cap: { usd: cap.cap, spentUsd: cap.spent.usd } } : {}),
              }),
            );

      return runner
        .then((run) =>
          run({
            now: new Date(),
            signal: control.signal,
            onProgress: (progress) => setHunt((current) => ({ ...current, progress })),
          }),
        )
        .then((result) => {
          const finishedAt = new Date();
          const known = new Set(latest.current.leads.map((lead) => lead.key));
          const added = result.leads.filter((lead) => !known.has(lead.key)).length;
          const saved = commit((current) => addFound(current, result, finishedAt, sample, provider));
          setHunt((current) => ({
            ...current,
            running: false,
            progress: { steps: result.steps, kept: result.leads.length, dropped: result.dropped.length },
            message: huntMessage(result, added, provider, latest.current, localDate(finishedAt)),
            failed: result.status === 'failed',
          }));
          return saved;
        })
        .catch((error: unknown) => {
          // The hunt couldn't even load (offline, say). It still gets a run and a report (AC-8.1).
          const problem = classifyProviderError(error);
          // The same rule as real-hunt.ts: search steps and switched-off stages say so, the rest failed.
          const steps = waitingSteps().map((step): HuntStep =>
            step.id === 'posts' || step.id === 'freshness'
              ? { ...step, state: 'skipped', skipReason: 'needs-search' }
              : step.id === 'funding'
                ? { ...step, state: 'skipped', skipReason: 'switched-off' }
                : { ...step, state: 'failed' },
          );
          const saved = commit((current) => addFound(current, { status: 'failed', problem, leads: [], dropped: [], steps }, new Date(), sample, provider));
          setHunt((current) => ({
            ...current,
            running: false,
            failed: true,
            message: strings.hunt.failed(problem, providerName(provider), 0),
          }));
          return saved;
        })
        .finally(() => {
          huntControl.current = null;
        });
    },
    [],
  );

  /**
   * Starts a hunt. `auto` is run on open (FR-4.2): it starts only with the hunt lock, and
   * only when the saved data, read again inside the lock, shows no real hunt today.
   */
  const startHunt = useCallback((auto: boolean) => {
    // A second click while a hunt runs does nothing (AC-4.1).
    if (huntControl.current) return;
    const { settings, profile, leads } = latest.current;
    const sample = settings.sampleMode;
    const provider = settings.provider;
    const key = provider ? keys.current[provider] : undefined;
    // A real hunt needs a provider with a saved key and a complete profile (FR-3.6).
    if (!sample && (!provider || !key || !profile || missingFields(profile).length > 0)) return;
    // Every source off: a real hunt would search nothing, so it doesn't start. Today says why.
    if (!sample && !anySourceOn(settings)) return;
    // A real hunt that could go past this month's cap doesn't start (AC-4.13). Today says why.
    const today = localDate(new Date());
    const cap = !sample && provider ? capState(latest.current, provider, today) : null;
    if (cap && !capAllowsStart(cap)) return;

    // Taken now, so a second click while the lock is asked for does nothing either.
    const control = new AbortController();
    huntControl.current = control;
    const giveUp = (message: string | null) => {
      if (huntControl.current === control) huntControl.current = null;
      if (message) setHunt({ ...IDLE_HUNT, message });
    };

    const hunt = (): Promise<void> => {
      setHunt({ running: true, sample, progress: null, message: null });
      return huntWith(control, sample, provider, key, profile, leads, cap);
    };

    // One hunt at a time across tabs (hunt-lock.ts). Without the Web Locks API a click still
    // hunts, as before, but nothing starts on its own.
    const locks = browserLocks();
    if (!locks) {
      if (auto) giveUp(null);
      else void hunt();
      return;
    }
    withHuntLock(locks, async () => {
      if (control.signal.aborted) return giveUp(null);
      if (auto) {
        // Another tab may have hunted since this one loaded: ask the saved data, not this tab's copy.
        const fresh = await loadData().catch(() => null);
        if (!fresh || !shouldRunOnOpen(fresh, providersWithKeys(keys.current), localDate(new Date()))) return giveUp(null);
      }
      await hunt();
    }).then(
      (outcome) => outcome === 'busy' && giveUp(strings.hunt.otherTab),
      () => giveUp(null),
    );
  }, []);

  // Run on open (FR-4.2): once per page load, after the saved data and keys are read.
  // Turning the setting on later doesn't start a hunt until the next open.
  const openChecked = useRef(false);
  useEffect(() => {
    // Locked keys: wait. Run on open checks again once this tab is unlocked (FR-10.4).
    if (!ready || openChecked.current || keyLock === 'locked') return;
    openChecked.current = true;
    if (loadFailed || savingOff) return;
    const go = () => {
      // Only keys this tab can use count: none while locked.
      if (shouldRunOnOpen(latest.current, providersWithKeys(keys.current), localDate(new Date()))) startHunt(true);
    };
    // A page the browser loads ahead of a visit (prerendering) waits until it's really opened.
    const page = document as Document & { prerendering?: boolean };
    if (page.prerendering) document.addEventListener('prerenderingchange', go, { once: true });
    else go();
  }, [ready, loadFailed, savingOff, keyLock, keyProviders, startHunt]);

  // Closing the tab during a real hunt asks first (FRD §10.2). A sample hunt loses nothing.
  useEffect(() => {
    if (!hunt.running || hunt.sample) return;
    const onUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [hunt.running, hunt.sample]);

  const actions = useMemo<Actions>(() => {
    const update = (key: string, change: (lead: Lead, moment: Date) => Lead) =>
      setData((current) => {
        const moment = new Date();
        return replaceLead(current, key, (lead) => change(lead, moment));
      });

    /** Stores the keys: sealed with the passphrase when one is set, else plain. Never while locked. */
    const storeKeys = async (next: StoredKeys) => {
      if (keyLockRef.current === 'locked') throw new Error('Unlock the keys first');
      if (savingOffRef.current) return;
      const held = unlocked.current;
      const record = held ? await sealKeys(next, held) : null;
      await tabSync.run(() => (record ? saveSealedKeys(record) : saveKeys(next)));
      channel.current?.postMessage('saved');
    };

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

      runHunt: () => startHunt(false),
      cancelHunt: () => huntControl.current?.abort(),

      markEmailed: (key, personIndex) =>
        update(key, (lead, moment) => markEmailed(lead, personIndex, localDate(moment), moment)),
      unmarkEmailed: (key, personIndex) => update(key, (lead, moment) => unmarkEmailed(lead, personIndex, moment)),
      markFollowupSent: (key, personIndex) =>
        update(key, (lead, moment) => markFollowupSent(lead, personIndex, localDate(moment))),
      setStatus: (key, status, options) => {
        const before = latest.current.leads.find((lead) => lead.key === key) ?? null;
        if (!before || before.status === status) return null;
        // One moment for the move, so Undo can find the move's own history entry.
        const moment = new Date();
        setData((current) => replaceLead(current, key, (lead) => setStatus(lead, status, localDate(moment), moment, options)));
        return { key, before, entry: { status, at: moment.toISOString() } };
      },

      // The update runs at once (flushSync), so the result says whether the inverse
      // really applied to the lead as it is, never a guess from a moment before.
      undoStatus: (move) => {
        let applied = false;
        flushSync(() =>
          setData((current) =>
            replaceLead(current, move.key, (lead) => {
              const undone = undoStatus(lead, move.before, move.entry);
              applied = undone !== null;
              return undone ?? lead;
            }),
          ),
        );
        return applied;
      },

      saveProfile: (profile) => setData((current) => ({ ...current, profile: cleanProfile(profile) })),

      updateSettings: (change) => setData((current) => ({ ...current, settings: { ...current.settings, ...change } })),

      // A functional update, so a change already queued (a hunt finishing, a lead marked
      // emailed) is never overwritten. The count for the message comes from the same helper.
      block: (entries) => {
        setData((current) => applyBlocks(current, entries).data);
        return applyBlocks(latest.current, entries).removed;
      },

      deletePerson: (key, personIndex, name, block) => {
        const erase = (current: AppData): AppData | null => {
          const erased = deletePerson(current, key, personIndex, name);
          return erased && block ? applyBlocks(erased, [block]).data : erased;
        };
        const done = erase(latest.current) !== null;
        setData((current) => erase(current) ?? current);
        return done;
      },

      unblock: (entry) =>
        setData((current) => ({ ...current, doNotContact: current.doNotContact.filter((known) => !sameEntry(known, entry)) })),

      // The backup code loads only when it's used, so the first page load doesn't pay for it.
      exportBackup: async () => {
        const { backupFileName, backupZip } = await import('./backup');
        const now = new Date();
        const bytes = backupZip(latest.current, now);
        downloadBlob(backupFileName(localDate(now)), new Blob([new Uint8Array(bytes)], { type: 'application/zip' }));
        setData((current) => ({ ...current, settings: { ...current.settings, lastBackupOn: localDate(now) } }));
      },

      importBackup: async (incoming, replaceProfile) => {
        const { mergeBackup } = await import('./backup');
        const { data: merged, summary } = mergeBackup(latest.current, incoming, replaceProfile);
        latest.current = merged;
        setData(merged);
        return summary;
      },

      // Skips the welcome screens: their last step says data is saved, which isn't true now.
      continueWithoutSaving: () => {
        savingOffRef.current = true;
        setSavingOff(true);
        setLoadFailed(false);
        setData((current) => ({ ...current, settings: { ...current.settings, welcomeDone: true } }));
      },

      saveKey: async (provider, key) => {
        const next = { ...keys.current, [provider]: key.trim() };
        await storeKeys(next);
        keys.current = next;
        setKeyProviders(providersWithKeys(next));
        setData((current) => ({ ...current, settings: { ...current.settings, provider } }));
      },

      removeKey: async (provider) => {
        const next = { ...keys.current };
        delete next[provider];
        await storeKeys(next);
        keys.current = next;
        const left = providersWithKeys(next);
        setKeyProviders(left);
        // Hunts move to another provider that still has a key, if there is one.
        setData((current) =>
          current.settings.provider === provider
            ? { ...current, settings: { ...current.settings, provider: left[0] ?? null } }
            : current,
        );
      },

      dismissChangedElsewhere: () => setChangedElsewhere(false),

      unlockKeys: async (passphrase) => {
        const record = await loadKeyRecord();
        if (record.kind === 'plain') {
          await takeKeys(record);
          return true;
        }
        try {
          const held = await unlock(record.sealed, passphrase);
          keys.current = await openKeys(record.sealed, held);
          unlocked.current = held;
        } catch (error) {
          if (error instanceof WrongPassphraseError) return false;
          throw error;
        }
        setKeyProviders(sealedProviders(record.sealed));
        setKeyLock('unlocked');
        return true;
      },

      setPassphrase: async (passphrase) => {
        if (keyLockRef.current === 'locked') throw new Error('Unlock the keys first');
        const held = await newPassphrase(passphrase);
        const sealed = await sealKeys(keys.current, held);
        if (!savingOffRef.current) {
          await tabSync.run(() => saveSealedKeys(sealed));
          channel.current?.postMessage('saved');
        }
        unlocked.current = held;
        setKeyLock('unlocked');
      },

      removePassphrase: async () => {
        if (keyLockRef.current !== 'unlocked') throw new Error('Unlock the keys first');
        const plain = keys.current;
        if (!savingOffRef.current) {
          await tabSync.run(() => saveKeys(plain));
          channel.current?.postMessage('saved');
        }
        unlocked.current = null;
        setKeyLock('none');
      },

      lockKeys: () => {
        if (keyLockRef.current !== 'unlocked') return;
        unlocked.current = null;
        keys.current = {};
        setKeyLock('locked');
      },

      forgetKeys: async () => {
        if (!savingOffRef.current) {
          await tabSync.run(() => saveKeys({}));
          channel.current?.postMessage('saved');
        }
        unlocked.current = null;
        keys.current = {};
        setKeyProviders([]);
        setKeyLock('none');
        setData((current) => ({ ...current, settings: { ...current.settings, provider: null } }));
      },

      deleteEverything: async () => {
        huntControl.current?.abort();
        // With saving off there is nothing stored, and storage would refuse the request anyway.
        if (!savingOffRef.current) {
          await tabSync.clear(clearData);
          // The other tabs read again, find nothing, and start over too.
          channel.current?.postMessage('saved');
        }
        const fresh = tabSync.stamp(emptyData());
        // The theme and text size copy goes too: Delete everything wipes all app data (FR-9.5).
        clearDisplayCopy();
        // With saving off, the welcome screens stay skipped: their last step says data is saved.
        if (savingOffRef.current) fresh.settings.welcomeDone = true;
        keys.current = {};
        unlocked.current = null;
        setKeyLock('none');
        setKeyProviders([]);
        loaded.current = fresh;
        setHunt(IDLE_HUNT);
        setData(fresh);
      },
    };
  }, [startHunt, tabSync, takeKeys]);

  const state = useMemo<AppState>(
    () => ({ ready, data, now, today, persistence, saveFailed, loadFailed, savingOff, changedElsewhere, keyLock, reloads, keyProviders, hunt, actions }),
    [ready, data, now, today, persistence, saveFailed, loadFailed, savingOff, changedElsewhere, keyLock, reloads, keyProviders, hunt, actions],
  );

  return <AppContext.Provider value={state}>{children}</AppContext.Provider>;
}
