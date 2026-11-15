import { TriangleAlert } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { Shell } from '@/components/Shell';
import { Banner, Button, Card } from '@/components/ui';
import { useRoute, type Route } from './router';
import { Board } from './screens/Board';
import { Data } from './screens/Data';
import { History } from './screens/History';
import { Profile } from './screens/Profile';
import { Settings } from './screens/Settings';
import { Today } from './screens/Today';
import { Welcome } from './screens/Welcome';
import { useApp } from './state';
import { strings } from './strings';

const TITLES: Record<Route, string> = {
  today: strings.nav.today,
  board: strings.nav.board,
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
  const { ready, data, saveFailed, loadFailed, savingOff } = useApp();
  const route = useRoute();
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
          {route === 'today' && <Today />}
          {route === 'board' && <Board />}
          {route === 'history' && <History />}
          {route === 'profile' && <Profile />}
          {route === 'data' && <Data />}
          {route === 'settings' && <Settings />}
        </Shell>
      )}
    </MotionConfig>
  );
}
