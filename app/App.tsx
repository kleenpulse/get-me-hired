import { TriangleAlert } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { Shell } from '@/components/Shell';
import { Banner } from '@/components/ui';
import { useRoute, type Route } from './router';
import { Board } from './screens/Board';
import { Data } from './screens/Data';
import { Today } from './screens/Today';
import { Welcome } from './screens/Welcome';
import { useApp } from './state';
import { strings } from './strings';

const TITLES: Record<Route, string> = {
  today: strings.nav.today,
  board: strings.nav.board,
  data: strings.nav.data,
};

export function App() {
  const { ready, data, saveFailed, loadFailed } = useApp();
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

  return (
    // `reducedMotion="user"` turns slides and springs off when the system asks (NFR-1).
    <MotionConfig reducedMotion="user">
      {!welcomed ? (
        <Welcome />
      ) : (
        <Shell route={route}>
          {(saveFailed || loadFailed) && (
            <div role="alert" className="mb-gutter">
              <Banner tone="failure" icon={TriangleAlert}>
                {loadFailed ? strings.errors.load : strings.errors.storage}
              </Banner>
            </div>
          )}
          {route === 'today' && <Today />}
          {route === 'board' && <Board />}
          {route === 'data' && <Data />}
        </Shell>
      )}
    </MotionConfig>
  );
}
