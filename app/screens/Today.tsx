// Today, the home screen (FR-6.1). It answers one question: "who do I write to
// now?" The ranked list is one column, with the Day card beside it.

import {
  Banknote,
  BellRing,
  Check,
  FlaskConical,
  Megaphone,
  MessagesSquare,
  Minus,
  Reply,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import { missingFields } from '@/core/profile';
import { buildToday, type TodayGroup } from '@/core/ranking';
import { LeadCard } from '@/components/LeadCard';
import { Banner, Button, Card, cx, EmptyState, StatusPill, type Icon } from '@/components/ui';
import { clockTime } from '../format';
import { Link } from '../router';
import { useApp, type HuntState } from '../state';
import { strings } from '../strings';

const t = strings.today;

type Filter = TodayGroup | 'all';

const GROUP_ICONS: Record<Filter, Icon> = {
  all: Users,
  followup: Reply,
  attention: BellRing,
  post: Megaphone,
  funding: Banknote,
  community: MessagesSquare,
};

const GROUP_ORDER: TodayGroup[] = ['followup', 'attention', 'post', 'funding', 'community'];

const RING_RADIUS = 24;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** The daily counter (FR-6.11): a ring that fills as people are emailed. */
function Counter({ done, target }: { done: number; target: number }) {
  const share = target > 0 ? Math.min(1, done / target) : 0;
  const style = { '--ring-gap': `${RING_LENGTH * (1 - share)}` } as CSSProperties;
  return (
    <div className="flex items-center gap-3.5">
      <svg aria-hidden width="56" height="56" viewBox="0 0 56 56" className="-rotate-90 shrink-0" style={style}>
        <circle cx="28" cy="28" r={RING_RADIUS} fill="none" strokeWidth="4" className="stroke-glass" />
        <circle
          cx="28"
          cy="28"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset="var(--ring-gap)"
          className="stroke-foreground transition-[stroke-dashoffset] duration-[600ms] ease-dawn"
        />
      </svg>
      <p className="flex flex-col">
        <span className="type-display tabular">{t.counter(done, target)}</span>
        <span className="text-ink-2 type-caption">{t.counterCaption}</span>
      </p>
    </div>
  );
}

function GroupRow({
  filter,
  label,
  people,
  selected,
  onSelect,
}: {
  filter: Filter;
  label: string;
  people: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const Glyph = GROUP_ICONS[filter];
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cx(
        'flex min-h-14 shrink-0 cursor-pointer items-center gap-3 rounded-pill py-1 pr-4 pl-1.5 text-left transition-[background-color,box-shadow] duration-150 ease-dawn lg:w-full',
        selected ? 'bg-lift elev-lift' : 'hover:bg-glass',
      )}
    >
      <span className={cx('flex size-[46px] shrink-0 items-center justify-center rounded-pill', selected ? 'bg-nested' : 'bg-glass')}>
        <Glyph size={20} strokeWidth={1.5} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="type-label">{label}</span>
        <span className="text-ink-2 type-caption tabular">{t.people(people)}</span>
      </span>
    </button>
  );
}

function HuntCard({ hunt, onCancel }: { hunt: HuntState; onCancel: () => void }) {
  const h = strings.hunt;
  const progress = hunt.progress;
  return (
    <Card tone="slate" aria-labelledby="hunt-title" className="flex flex-col gap-4">
      <h2 id="hunt-title" className="type-title">
        {hunt.sample ? h.sampleTitle : h.title}
      </h2>

      {/* A live region, so screen readers hear each step as it changes (FR-4.10). */}
      <ol aria-live="polite" className="flex flex-col gap-2">
        {(progress?.steps ?? []).map((step) => (
          <li key={step.id} className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-lift">
              {step.state === 'done' && <Check size={16} strokeWidth={1.5} aria-hidden />}
              {step.state === 'failed' && <X size={16} strokeWidth={1.5} aria-hidden />}
              {step.state === 'running' && <span aria-hidden className="size-2 animate-fresh-dot rounded-pill bg-signal" />}
              {step.state === 'waiting' && <span aria-hidden className="size-3 rounded-pill border border-ink-3" />}
              {step.state === 'skipped' && <Minus size={16} strokeWidth={1.5} aria-hidden />}
            </span>
            <span className="min-w-0 flex-1 type-label">
              {h.steps[step.id]}
              <span className="sr-only">. {h.stepStates[step.state]}</span>
            </span>
            {step.state === 'skipped' && step.skipReason && (
              <span className="rounded-pill bg-glass px-2.5 py-1 text-ink-2 type-caption">{h.skipReasons[step.skipReason]}</span>
            )}
            {step.count !== null && (
              <span className="rounded-pill bg-glass px-2.5 py-1 type-caption tabular">{h.stepCount(step.count)}</span>
            )}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="type-label tabular">{h.tally(progress?.kept ?? 0, progress?.dropped ?? 0)}</p>
        <Button onClick={onCancel} className="bg-glass">
          {h.cancel}
        </Button>
      </div>
    </Card>
  );
}

export function Today() {
  const { data, today, now, hunt, keyProviders, actions } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const { sampleMode, dailyTarget, cadence } = data.settings;

  const list = useMemo(
    () => buildToday(data.leads, { today, nowMs: now.getTime(), dailyTarget, cadence }),
    [data.leads, today, now, dailyTarget, cadence],
  );

  const shown = filter === 'all' ? list.entries : list.entries.filter((entry) => entry.group === filter);
  const totalPeople = GROUP_ORDER.reduce((sum, group) => sum + list.people[group], 0);
  // A hunt that stopped with a problem doesn't count as today's hunt.
  const lastRun = data.runs.findLast((run) => run.date === today && run.status !== 'failed');
  const doneToday = list.done.emailed + list.done.followups;

  const missing = missingFields(data.profile);
  const provider = data.settings.provider;
  const hasKey = provider !== null && keyProviders.includes(provider);
  // A real hunt needs a complete profile and a saved key (FR-3.6). A sample hunt needs neither.
  const canHunt = sampleMode || (missing.length === 0 && hasKey);

  const empty =
    list.entries.length > 0
      ? null
      : !sampleMode && data.leads.length === 0
        ? !data.profile
          ? 'noProfile'
          : canHunt
            ? data.runs.some((run) => !run.sample && run.status === 'completed')
              ? 'nothingYet'
              : 'readyToHunt'
            : 'first'
        : sampleMode && data.runs.length === 0
          ? 'sampleReady'
          : 'done';

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-gutter lg:grid-cols-4 lg:items-start">
      <h1 className="sr-only">{t.title}</h1>

      <Card tone="dawn" as="aside" aria-label={t.title} className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-gutter lg:order-last">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="type-title">{t.title}</h2>
          {hunt.running ? (
            <StatusPill dot pulsing>
              {t.hunting}
            </StatusPill>
          ) : (
            <StatusPill>{lastRun ? t.hunted(clockTime(lastRun.at)) : t.notRun}</StatusPill>
          )}
        </div>

        <Counter done={list.done.emailed} target={dailyTarget} />

        <span aria-hidden className="h-px bg-hairline" />

        <div role="group" aria-label={t.groupsLabel} className="-mx-1.5 flex gap-2 overflow-x-auto px-1.5 py-1 [scrollbar-width:none] lg:flex-col lg:overflow-visible [&::-webkit-scrollbar]:hidden">
          <GroupRow filter="all" label={t.all} people={totalPeople} selected={filter === 'all'} onSelect={() => setFilter('all')} />
          {GROUP_ORDER.filter((group) => list.people[group] > 0 || group === filter).map((group) => (
            <GroupRow
              key={group}
              filter={group}
              label={t.groups[group]}
              people={list.people[group]}
              selected={filter === group}
              onSelect={() => setFilter(group)}
            />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            icon={sampleMode ? FlaskConical : undefined}
            disabled={!canHunt || hunt.running}
            onClick={actions.runHunt}
            aria-describedby="hunt-note"
            className="w-full"
          >
            {sampleMode ? t.runSampleHunt : t.runHunt}
          </Button>
          <p id="hunt-note" className="text-ink-2 type-caption">
            {sampleMode
              ? t.sampleHuntNote
              : missing.length > 0
                ? t.huntNeedsProfile(missing)
                : hasKey
                  ? t.huntReady
                  : t.huntNeedsKey}
          </p>
        </div>
      </Card>

      <div className="flex min-w-0 flex-col gap-gutter lg:col-span-3">
        {hunt.running && <HuntCard hunt={hunt} onCancel={actions.cancelHunt} />}

        {/* Always present, so screen readers announce the outcome when it arrives. */}
        <p role="status" className="sr-only">
          {hunt.running ? '' : (hunt.message ?? '')}
        </p>
        {!hunt.running && hunt.message && (
          <div aria-hidden>
            <Banner tone={hunt.failed ? 'failure' : 'info'} icon={hunt.failed ? TriangleAlert : Check}>
              {hunt.message}
            </Banner>
          </div>
        )}

        {sampleMode && (
          <Banner icon={FlaskConical} action={<Button onClick={actions.clearSampleData}>{t.clearSample}</Button>}>
            {t.sampleBanner}
          </Banner>
        )}

        {empty === 'noProfile' && (
          <EmptyState
            title={t.empty.noProfile.title}
            body={t.empty.noProfile.body}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  to="profile"
                  className="inline-flex min-h-[46px] items-center rounded-pill bg-nested px-5 no-underline type-label hover:brightness-95"
                >
                  {t.empty.noProfile.action}
                </Link>
                <Button variant="quiet" onClick={actions.startSampleMode}>
                  {t.empty.noProfile.sample}
                </Button>
              </div>
            }
          />
        )}
        {empty === 'first' && (
          <EmptyState
            title={t.empty.first.title}
            body={t.empty.first.body}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  to="settings"
                  className="inline-flex min-h-[46px] items-center rounded-pill bg-nested px-5 no-underline type-label hover:brightness-95"
                >
                  {t.empty.first.settings}
                </Link>
                <Button variant="quiet" onClick={actions.startSampleMode}>
                  {t.empty.first.action}
                </Button>
              </div>
            }
          />
        )}
        {empty === 'nothingYet' && !hunt.running && (
          <EmptyState
            title={t.empty.nothingYet.title}
            body={t.empty.nothingYet.body}
            action={
              <Link
                to="profile"
                className="inline-flex min-h-[46px] items-center rounded-pill bg-nested px-5 no-underline type-label hover:brightness-95"
              >
                {t.empty.nothingYet.action}
              </Link>
            }
          />
        )}
        {empty === 'readyToHunt' && !hunt.running && (
          <EmptyState title={t.empty.readyToHunt.title} body={t.empty.readyToHunt.body} />
        )}
        {empty === 'sampleReady' && !hunt.running && (
          <EmptyState title={t.empty.sampleReady.title} body={t.empty.sampleReady.body} />
        )}
        {empty === 'done' && !hunt.running && (
          <EmptyState
            title={t.empty.done.title}
            body={doneToday > 0 ? t.empty.done.body(list.done.emailed, list.done.followups) : undefined}
            action={
              <Link
                to="board"
                className="inline-flex min-h-[46px] items-center rounded-pill bg-nested px-5 no-underline type-label hover:brightness-95"
              >
                {t.empty.done.action}
              </Link>
            }
          />
        )}

        {list.entries.length > 0 && shown.length === 0 && (
          <EmptyState
            title={t.empty.filtered.title}
            action={<Button onClick={() => setFilter('all')}>{t.empty.filtered.action}</Button>}
          />
        )}

        {shown.length > 0 && (
          <ol className="flex flex-col gap-gutter">
            {shown.map((entry) => (
              <li key={entry.lead.key}>
                <LeadCard lead={entry.lead} reason={entry.reason} />
              </li>
            ))}
          </ol>
        )}

        {list.leftOut > 0 && filter === 'all' && <p className="px-2 text-ink-2 type-caption">{t.leftOut(list.leftOut)}</p>}
      </div>
    </div>
  );
}
