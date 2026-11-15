// The app shell: one white frame, with a labelled rail on wide screens and a
// bottom bar on narrow ones (DESIGN.md, Layout).

import { CalendarCheck, Columns3, Database } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Link, type Route } from '@/app/router';
import { strings } from '@/app/strings';
import { cx, type Icon } from './ui';

const ITEMS: { route: Route; label: string; icon: Icon; pinned?: boolean }[] = [
  { route: 'today', label: strings.nav.today, icon: CalendarCheck },
  { route: 'board', label: strings.nav.board, icon: Columns3 },
  { route: 'data', label: strings.nav.data, icon: Database, pinned: true },
];

function NavItem({ item, active, bar }: { item: (typeof ITEMS)[number]; active: boolean; bar?: boolean }) {
  const Glyph = item.icon;
  return (
    <Link
      to={item.route}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'relative flex flex-col items-center justify-center gap-1 rounded-tile no-underline type-caption',
        bar ? 'min-h-14 flex-1' : 'min-h-[72px] w-[76px]',
        active ? 'text-foreground' : 'text-ink-2 hover:text-foreground',
      )}
    >
      {/* One shared tile that slides between items. */}
      {active && (
        <motion.span
          layoutId={bar ? 'nav-tile-bar' : 'nav-tile-rail'}
          aria-hidden
          className="absolute inset-0 rounded-tile bg-card"
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        />
      )}
      <Glyph size={20} strokeWidth={1.5} aria-hidden className="relative" />
      <span className="relative">{item.label}</span>
    </Link>
  );
}

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const main = ITEMS.filter((item) => !item.pinned);
  const pinned = ITEMS.filter((item) => item.pinned);

  return (
    <div className="min-h-dvh lg:p-gutter">
      <a
        href="#main"
        className="sr-only rounded-pill bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        {strings.skipToContent}
      </a>

      <div className="mx-auto flex min-h-dvh max-w-[1600px] bg-sheet lg:min-h-[calc(100dvh-2*var(--gutter))] lg:rounded-frame">
        <nav
          aria-label={strings.nav.label}
          className="sticky top-0 hidden h-[calc(100dvh-2*var(--gutter))] w-[104px] shrink-0 flex-col items-center gap-1 py-gutter lg:flex"
        >
          {main.map((item) => (
            <NavItem key={item.route} item={item} active={item.route === route} />
          ))}
          <span aria-hidden className="mt-auto mb-1 h-px w-5 bg-hairline" />
          {pinned.map((item) => (
            <NavItem key={item.route} item={item} active={item.route === route} />
          ))}
        </nav>

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-gutter pb-[calc(64px+2*var(--gutter))] outline-none lg:pb-gutter lg:pl-0">
          {children}
        </main>
      </div>

      <nav
        aria-label={strings.nav.label}
        className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center gap-1 bg-sheet px-2 elev-overlay lg:hidden"
      >
        {ITEMS.map((item) => (
          <NavItem key={item.route} item={item} active={item.route === route} bar />
        ))}
      </nav>
    </div>
  );
}
