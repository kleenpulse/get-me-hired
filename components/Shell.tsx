// The app shell: one white frame, with a labelled rail on wide screens and a
// bottom bar on narrow ones (DESIGN.md, Layout).

import { CalendarCheck, Columns3, Database, Ellipsis, FileCheck, History, Settings, UserRound } from 'lucide-react';
import * as m from 'motion/react-m';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, type Route } from '@/app/router';
import { strings } from '@/app/strings';
import { cx, type Icon } from './ui';

// DESIGN.md: the rail is Today, Board, Draft checker, History, then the pinned ones.
// The bottom bar is Today, Board, Draft checker and More, which holds the rest.
const ITEMS: { route: Route; label: string; icon: Icon; pinned?: boolean; inMoreOnBar?: boolean }[] = [
  { route: 'today', label: strings.nav.today, icon: CalendarCheck },
  { route: 'board', label: strings.nav.board, icon: Columns3 },
  { route: 'drafts', label: strings.nav.drafts, icon: FileCheck },
  { route: 'history', label: strings.nav.history, icon: History, inMoreOnBar: true },
  { route: 'profile', label: strings.nav.profile, icon: UserRound, pinned: true },
  { route: 'data', label: strings.nav.data, icon: Database, pinned: true },
  { route: 'settings', label: strings.nav.settings, icon: Settings, pinned: true },
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
        <m.span
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
        {/* The bar holds the main items plus "More" (DESIGN.md, Shell). */}
        {main
          .filter((item) => !item.inMoreOnBar)
          .map((item) => (
            <NavItem key={item.route} item={item} active={item.route === route} bar />
          ))}
        <MoreMenu items={[...main.filter((item) => item.inMoreOnBar), ...pinned]} route={route} />
      </nav>
    </div>
  );
}

/** "More" on the bottom bar: the pinned items, in a small panel above the bar. */
function MoreMenu({ items, route }: { items: typeof ITEMS; route: Route }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const active = items.some((item) => item.route === route);

  // Close on a choice (the route changes), on Escape, or on a tap outside.
  useEffect(() => setOpen(false), [route]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative flex min-h-14 flex-1">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className={cx(
          'relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-tile type-caption',
          active || open ? 'bg-card text-foreground' : 'text-ink-2 hover:text-foreground',
        )}
      >
        <Ellipsis size={20} strokeWidth={1.5} aria-hidden />
        <span>{strings.nav.more}</span>
      </button>
      {/* After its button, so Tab moves from More into its links (WCAG 2.4.3). It still shows above the bar. */}
      {open && (
        <div
          id={panelId}
          className="absolute right-0 bottom-[calc(100%+8px)] flex w-44 flex-col gap-1 rounded-card border border-hairline bg-sheet p-2 elev-overlay"
        >
          {items.map((item) => {
            const Glyph = item.icon;
            const current = item.route === route;
            return (
              <Link
                key={item.route}
                to={item.route}
                aria-current={current ? 'page' : undefined}
                className={cx(
                  'flex min-h-11 items-center gap-3 rounded-pill px-3 no-underline type-label',
                  current ? 'bg-card' : 'hover:bg-glass',
                )}
              >
                <Glyph size={20} strokeWidth={1.5} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
