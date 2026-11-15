import { RefreshCw, TriangleAlert } from 'lucide-react';
import { LazyMotion, MotionConfig } from 'motion/react';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { ScreenBoundary } from '@/components/ScreenBoundary';
import { Shell } from '@/components/Shell';
import { Banner, Button, Card } from '@/components/ui';
import { unsavedScreen, useRoute, type Route } from './router';
import { Today } from './screens/Today';
import { Welcome } from './screens/Welcome';
import { screenKey } from './screen-key';
import { useApp } from './state';
import { strings } from './strings';

// Today and Welcome load with the app. The other screens load the first time
// they're opened, so the first page load stays small.
const Board = lazy(() => import('./screens/Board').then((module) => ({ default: module.Board })));
const Drafts = lazy(() => import('./screens/Drafts').then((module) => ({ default: module.Drafts })));
const History = lazy(() => import('./screens/History').then((module) => ({ default: module.History })));
const Profile = lazy(() => import('./screens/Profile').then((module) => ({ default: module.Profile })));
const Data = lazy(() => import('./screens/Data').then((module) => ({ default: module.Data })));
const Settings = lazy(() => import('./screens/Settings').then((module) => ({ default: module.Settings })));

const loadMotionFeatures = () => import('./motion-features').then((module) => module.default);

const TITLES: Record<Route, string> = {
  today: strings.nav.today,
  board: strings.nav.board,
  drafts: strings.nav.drafts,
  history: strings.nav.history,
  profile: strings.nav.profile,
  data: strings.nav.data,
  settings: strings.nav.settings,
};

/**
 * Shown instead of the app when the saved data can't be opened. It must not
 * look like a first visit, and nothing is saved over the data (FRD §10.2).
 */
function LoadFailed({ reason }: { reason: 'broken' | 'newer' | 'blocked' }) {
  const { actions } = useApp();
  const text = strings.errors.load[reason];
  const blocked = strings.errors.load.blocked;
  return (
    <div className="flex min-h-dvh lg:p-gutter">
      <main className="flex flex-1 items-center justify-center bg-sheet p-gutter lg:rounded-frame">
        <Card tone="dawn" role="alert" className="flex w-full max-w-[560px] flex-col gap-4">
          <TriangleAlert size={24} strokeWidth={1.5} aria-hidden />
          <h1 className="type-display">{text.title}</h1>
          <p className="max-w-[68ch] type-body">{text.body}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => window.location.reload()}>
              {text.action}
            </Button>
            {/* Only when nothing could be stored: there is no saved data to hide or overwrite. */}
            {reason === 'blocked' && (
              <Button onClick={actions.continueWithoutSaving} aria-describedby="continue-note" className="bg-glass">
                {blocked.continue}
              </Button>
            )}
          </div>
          {reason === 'blocked' && (
            <p id="continue-note" className="max-w-[68ch] text-ink-2 type-caption">
              {blocked.continueNote}
            </p>
          )}
        </Card>
      </main>
    </div>
  );
}

export function App() {
  const { ready, data, saveFailed, loadFailed, savingOff, changedElsewhere, reloads, actions } = useApp();
  const route = useRoute();
  // Profile keeps its draft while it has unsaved changes: it moves to the new key only once it has none.
  const profileKey = useRef(reloads);
  profileKey.current = screenKey(unsavedScreen() === 'profile', reloads, profileKey.current);
  const welcomed = data.settings.welcomeDone;

  useEffect(() => {
    document.title = welcomed ? `${TITLES[route]} · ${strings.appName}` : strings.appName;
  }, [route, welcomed]);

  if (!ready) {
    return (
      <p role="status" className="flex min-h-dvh items-center justify-center text-ink-2 type-body">
        {strings.loading}
      </p>
    );
  }

  if (loadFailed) return <LoadFailed reason={loadFailed} />;

  return (
    // `reducedMotion="user"` turns slides and springs off when the system asks (NFR-1).
    <MotionConfig reducedMotion="user">
      {/* motion's features load in their own chunk after the first paint (motion-features.ts). `strict`
          keeps any full `motion.*` component from pulling them back into the main chunk. */}
      <LazyMotion features={loadMotionFeatures} strict>
      {!welcomed ? (
        <Welcome />
      ) : (
        <Shell route={route}>
          {(saveFailed || savingOff) && (
            <div role="alert" className="mb-gutter">
              <Banner tone={savingOff ? 'warning' : 'failure'} icon={TriangleAlert}>
                {savingOff ? strings.errors.savingOff : strings.errors.storage}
              </Banner>
            </div>
          )}
          {/* A save here was refused because another tab saved first (storage.ts). */}
          {changedElsewhere && (
            <div role="status" className="mb-gutter">
              <Banner
                icon={RefreshCw}
                action={<Button onClick={actions.dismissChangedElsewhere}>{strings.errors.dismiss}</Button>}
              >
                {changedElsewhere === 'draft-kept'
                  ? strings.errors.draftKept
                  : changedElsewhere === 'keys-locked'
                    ? strings.errors.keysLocked
                    : strings.errors.changedElsewhere}
              </Banner>
            </div>
          )}
          {/* A screen starts over when another tab's data is read in, so no form keeps an old value. */}
          {route === 'today' && <Today key={reloads} />}
          <ScreenBoundary resetKey={route}>
            <Suspense
              fallback={
                <p role="status" className="px-2 pt-2 text-ink-2 type-body">
                  {strings.loadingScreen}
                </p>
              }
            >
              {route === 'board' && <Board key={reloads} />}
              {route === 'drafts' && <Drafts />}
              {route === 'history' && <History key={reloads} />}
              {route === 'profile' && <Profile key={profileKey.current} />}
              {route === 'data' && <Data key={reloads} />}
              {route === 'settings' && <Settings key={reloads} />}
            </Suspense>
          </ScreenBoundary>
        </Shell>
      )}
      </LazyMotion>
    </MotionConfig>
  );
}
