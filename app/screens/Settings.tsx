// Settings: the AI provider and its key (FR-2.4, FR-10.1), the daily target and
// follow-up rules (FR-10.2), and the theme and text size (FR-10.5).
//
// The key screen:
// where to get a key, a key field that is hidden by default, a Test button,
// and a plain-language reason when a test fails (AC-2.4). A key is saved only
// after it works, and "Remove key" deletes it at once (AC-10.1).
//
// The key typed here lives in this screen's state until it is tested. It is
// never logged, never put in the address, and never shown again once saved.

import { Check, ClipboardPaste, ExternalLink, Eye, EyeOff, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import {
  PROVIDER_IDS,
  PROVIDERS,
  testProviderKey,
  type KeyProblem,
  type ProviderChecks,
  type ProviderId,
} from '@/core/providers';
import { closedByCadence } from '@/core/lifecycle';
import { spentThisMonth } from '@/core/budget';
import { PRICES_CHECKED_ON } from '@/core/prices';
import {
  CLOSE_RANGE,
  DAILY_TARGET_RANGE,
  DELAY_RANGE,
  isValidDailyTarget,
  isValidMonthlyCap,
  isWholeIn,
  MONTHLY_CAP_RANGE,
} from '@/core/settings-bounds';
import { ChoicePills, INPUT } from '@/components/fields';
import { Banner, Button, Card, cx, IconButton, StatusPill, Tag } from '@/components/ui';
import { TEXT_SIZES, THEMES } from '../display';
import { usd } from '../format';
import { useApp } from '../state';
import { strings } from '../strings';

const t = strings.settings;
const c = t.provider.checks;
const CHECK_ORDER: (keyof ProviderChecks)[] = ['browser', 'structured', 'search'];

type Outcome =
  | { kind: 'connected' }
  | { kind: 'problem'; problem: KeyProblem }
  | { kind: 'save-failed' }
  | { kind: 'removed' }
  | { kind: 'remove-failed' }
  | { kind: 'empty' }
  | { kind: 'paste-failed' };

function ProviderRow({
  id,
  selected,
  hasKey,
  active,
  onSelect,
}: {
  id: ProviderId;
  selected: boolean;
  hasKey: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  const info = PROVIDERS[id];
  const offered = info.status === 'ready';
  return (
    <label
      className={cx(
        'flex min-h-14 items-center gap-3 rounded-pill py-1 pr-4 pl-1.5 transition-[background-color,box-shadow] duration-150 ease-dawn',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
        !offered && 'opacity-45',
        offered && 'cursor-pointer',
        selected ? 'bg-lift elev-lift' : offered && 'hover:bg-glass',
      )}
    >
      <input
        type="radio"
        name="provider"
        value={id}
        checked={selected}
        disabled={!offered}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cx('flex size-[46px] shrink-0 items-center justify-center rounded-pill type-label', selected ? 'bg-nested' : 'bg-lift')}
      >
        {info.name.charAt(0)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="type-label">{info.name}</span>
        <span className="text-ink-2 type-caption">{t.provider.about[id]}</span>
      </span>
      {hasKey && (
        <span className="inline-flex items-center gap-1.5 text-ink-2 type-caption">
          <Check size={14} strokeWidth={1.5} aria-hidden />
          {active ? t.provider.inUse : t.provider.keySaved}
        </span>
      )}
    </label>
  );
}

function KeyCard({ id }: { id: ProviderId }) {
  const { keyProviders, savingOff, actions } = useApp();
  const info = PROVIDERS[id];
  const k = t.key;
  const inputId = useId();
  const [key, setKey] = useState('');
  const [shown, setShown] = useState(false);
  const [testing, setTesting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const control = useRef<AbortController | null>(null);
  const hasKey = keyProviders.includes(id);
  const canPaste = typeof navigator.clipboard?.readText === 'function';
  // A password field makes browsers offer to save the key in their password manager, which
  // can sync it to the cloud (NFR-3). So the field is plain text, with its letters drawn as
  // dots. Only a browser that can't draw them as dots gets a password field instead.
  const canMask = typeof CSS !== 'undefined' && CSS.supports('-webkit-text-security', 'disc');
  const inputType = shown || canMask ? 'text' : 'password';

  // Leaving the screen, or picking another provider, stops a test in flight.
  useEffect(() => () => control.current?.abort(), []);

  const test = async () => {
    if (!key.trim()) return setOutcome({ kind: 'empty' });
    control.current?.abort();
    const current = new AbortController();
    control.current = current;
    setTesting(true);
    setOutcome(null);
    const result = await testProviderKey(id, key, { fetch: window.fetch.bind(window), signal: current.signal });
    if (current.signal.aborted) return;
    setTesting(false);
    if (!result.ok) return setOutcome({ kind: 'problem', problem: result.problem });
    try {
      await actions.saveKey(id, key);
      setKey('');
      setShown(false);
      setOutcome({ kind: 'connected' });
    } catch {
      setOutcome({ kind: 'save-failed' });
    }
  };

  const remove = async () => {
    try {
      await actions.removeKey(id);
      setOutcome({ kind: 'removed' });
    } catch {
      setOutcome({ kind: 'remove-failed' });
    }
  };

  const paste = async () => {
    try {
      setKey((await navigator.clipboard.readText()).trim());
      setOutcome(null);
    } catch {
      setOutcome({ kind: 'paste-failed' });
    }
  };

  const message = (() => {
    if (!outcome) return null;
    switch (outcome.kind) {
      case 'connected':
        return { tone: 'info' as const, text: savingOff ? k.connectedForNow(info.name) : k.connected(info.name) };
      case 'problem':
        return { tone: 'failure' as const, text: k.problems[outcome.problem](info.name) };
      case 'save-failed':
        return { tone: 'failure' as const, text: k.saveFailed };
      case 'removed':
        return { tone: 'info' as const, text: k.removed(info.name) };
      case 'remove-failed':
        return { tone: 'failure' as const, text: k.removeFailed };
      case 'empty':
        return { tone: 'warning' as const, text: k.empty };
      case 'paste-failed':
        return { tone: 'warning' as const, text: k.pasteFailed };
    }
  })();

  return (
    <Card aria-labelledby="key-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
        <h2 id="key-title" className="type-title">
          {k.title(info.name)}
        </h2>
        {hasKey && <StatusPill dot>{t.provider.keySaved}</StatusPill>}
      </div>

      {/* The FR-2.2 check results, so the user knows before getting a key (AC-2.2, D13). */}
      <section aria-labelledby="checks-title" className="flex flex-col gap-2">
        <h3 id="checks-title" className="text-ink-2 type-caption">
          {c.title}
        </h3>
        <dl className="flex flex-col gap-1">
          {CHECK_ORDER.map((check) => (
            <div key={check} className="flex flex-wrap items-baseline justify-between gap-x-3">
              <dt className="type-body">{c.names[check]}</dt>
              <dd className="type-label">{c.results[info.checks[check]]}</dd>
            </div>
          ))}
        </dl>
        {c.searchNote[id] && <p className="max-w-[68ch] text-ink-2 type-caption">{c.searchNote[id]}</p>}
      </section>

      <ol className="flex list-decimal flex-col gap-1.5 pl-5 type-body">
        {k.steps[id].map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="type-body">
        <a href={info.keyUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5">
          {k.openKeyPage(info.name)}
          <ExternalLink size={16} strokeWidth={1.5} aria-hidden />
          <span className="sr-only">{k.opensNewTab}</span>
        </a>
      </p>

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void test();
        }}
      >
        <label htmlFor={inputId} className="type-label">
          {hasKey ? k.replaceLabel : k.label}
        </label>
        <div className="flex items-center gap-2">
          <input
            id={inputId}
            name="key"
            type={inputType}
            value={key}
            onChange={(event) => {
              setKey(event.target.value);
              setOutcome(null);
            }}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby={`${inputId}-note`}
            data-1p-ignore
            data-lpignore="true"
            className={cx(INPUT, 'type-data', !shown && canMask && '[-webkit-text-security:disc]')}
          />
          <IconButton icon={shown ? EyeOff : Eye} label={shown ? k.hide : k.show} onClick={() => setShown(!shown)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" disabled={testing}>
            {testing ? k.testing : k.test}
          </Button>
          {canPaste && (
            <Button icon={ClipboardPaste} onClick={() => void paste()}>
              {k.paste}
            </Button>
          )}
          {hasKey && (
            <Button variant="quiet" onClick={() => void remove()}>
              {k.remove}
            </Button>
          )}
        </div>
        <p id={`${inputId}-note`} className="max-w-[68ch] text-ink-2 type-caption">
          {k.testNote(info.name)}
        </p>
      </form>

      <div role="status" aria-live="polite">
        {message && (
          <Banner tone={message.tone} icon={message.tone === 'info' ? Check : TriangleAlert}>
            {message.text}
          </Banner>
        )}
      </div>

      <div className="flex flex-col gap-1.5 rounded-note bg-lift p-3">
        <p className="max-w-[68ch] type-body">{k.privacy(info.name)}</p>
        <p className="max-w-[68ch] text-ink-2 type-caption">{k.shared}</p>
      </div>
    </Card>
  );
}

export function Settings() {
  const { data, keyProviders } = useApp();
  const active = data.settings.provider;
  const [selected, setSelected] = useState<ProviderId>(active ?? 'gemini');

  return (
    <div className="flex flex-col gap-gutter">
      <header className="px-2 pt-2">
        <h1 className="type-display">{t.title}</h1>
      </header>

      <div className="grid gap-gutter md:grid-cols-2 md:items-start">
        <Card aria-labelledby="provider-title" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 border-b border-hairline pb-4">
            <h2 id="provider-title" className="type-title">
              {t.provider.title}
            </h2>
            <p className="max-w-[68ch] text-ink-2 type-caption">{t.provider.caption}</p>
          </div>
          <p className="type-body">{active ? t.provider.using(PROVIDERS[active].name) : t.provider.none}</p>
          <fieldset className="flex flex-col gap-1">
            <legend className="sr-only">{t.provider.listLabel}</legend>
            {PROVIDER_IDS.map((id) => (
              <ProviderRow
                key={id}
                id={id}
                selected={selected === id}
                hasKey={keyProviders.includes(id)}
                active={active === id}
                onSelect={() => setSelected(id)}
              />
            ))}
          </fieldset>
          {PROVIDER_IDS.some((id) => PROVIDERS[id].status !== 'ready') && (
            <p className="max-w-[68ch] text-ink-2 type-caption">
              {t.provider.notOffered(
                PROVIDER_IDS.filter((id) => PROVIDERS[id].status !== 'ready').map((id) => PROVIDERS[id].name),
              )}
            </p>
          )}
        </Card>

        {/* A new card for each provider, so nothing typed for one carries over to another. */}
        <KeyCard key={selected} id={selected} />
      </div>

      <div className="grid gap-gutter md:grid-cols-2 md:items-start">
        <DayCard />
        <div className="flex flex-col gap-gutter">
          <SourcesCard />
          <SpendCard />
          <LookCard />
        </div>
      </div>
    </div>
  );
}

/** A whole number field that only accepts values in range. */
function NumberField({
  label,
  help,
  error,
  value,
  onChange,
}: {
  label: string;
  help: string;
  error: string | null;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="type-label">
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-help`}
        className={cx(INPUT, 'max-w-32 tabular')}
      />
      <p id={`${id}-help`} className={cx('max-w-[68ch] type-caption', error ? 'text-critical' : 'text-ink-2')}>
        {error ?? help}
      </p>
    </div>
  );
}

const asWhole = (text: string) => (/^\d{1,4}$/.test(text.trim()) ? Number(text.trim()) : Number.NaN);

/** FR-10.2: the daily target, and the follow-up rules (FRD §8.2), within their ranges. */
function DayCard() {
  const { data, today, now, actions } = useApp();
  const d = t.day;
  const settings = data.settings;
  const [target, setTarget] = useState(String(settings.dailyTarget));
  const [count, setCount] = useState(String(settings.cadence.followupDelays.length));
  const [delays, setDelays] = useState(settings.cadence.followupDelays.map(String));
  const [close, setClose] = useState(String(settings.cadence.closeAfter));
  const [message, setMessage] = useState<string | null>(null);

  const targetOk = isValidDailyTarget(asWhole(target));
  const followups = Number(count);
  const shown = Array.from({ length: followups }, (_, index) => delays[index] ?? '5');
  const delaysOk = shown.map((delay) => isWholeIn(asWhole(delay), DELAY_RANGE));
  const closeOk = isWholeIn(asWhole(close), CLOSE_RANGE);

  const saveCadence = () => {
    if (!delaysOk.every(Boolean) || !closeOk) return;
    const cadence = { followupDelays: shown.map(asWhole), closeAfter: asWhole(close) };
    // Follow-up dates are worked out from the emailed dates, so new rules act on the past.
    const closing = closedByCadence(data.leads, today, now, cadence);
    if (closing > 0 && !window.confirm(d.closes(closing))) return;
    actions.updateSettings({ cadence });
    setMessage(d.saved);
  };

  return (
    <Card aria-labelledby="day-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 border-b border-hairline pb-4">
        <h2 id="day-title" className="type-title">
          {d.title}
        </h2>
        <p className="max-w-[68ch] text-ink-2 type-caption">{d.caption}</p>
      </div>

      <NumberField
        label={d.target}
        help={d.targetHelp(DAILY_TARGET_RANGE.min, DAILY_TARGET_RANGE.max)}
        error={targetOk ? null : d.targetBad(DAILY_TARGET_RANGE.min, DAILY_TARGET_RANGE.max)}
        value={target}
        onChange={(text) => {
          setTarget(text);
          const value = asWhole(text);
          if (isValidDailyTarget(value)) actions.updateSettings({ dailyTarget: value });
        }}
      />

      {/* FR-4.2: it saves at once, and starts nothing until the app is next opened. */}
      <div className="flex flex-col gap-1.5">
        <ChoicePills
          label={d.runOnOpen}
          name="run-on-open"
          options={['off', 'on'] as const}
          labels={d.runOnOpenChoices}
          value={settings.runOnOpen ? 'on' : 'off'}
          onChange={(value) => actions.updateSettings({ runOnOpen: value === 'on' })}
        />
        <p className="max-w-[68ch] text-ink-2 type-caption">{d.runOnOpenHelp}</p>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          saveCadence();
        }}
      >
        <ChoicePills
          label={d.followups}
          name="followups"
          options={['0', '1', '2', '3'] as const}
          labels={{ 0: d.followupCount(0), 1: d.followupCount(1), 2: d.followupCount(2), 3: d.followupCount(3) }}
          value={count as '0' | '1' | '2' | '3'}
          onChange={(value) => {
            setCount(value);
            setMessage(null);
          }}
        />
        <p className="-mt-2 max-w-[68ch] text-ink-2 type-caption">{d.followupsHelp}</p>
        {shown.map((delay, index) => (
          <NumberField
            // The fields are numbered, and their order never changes.
            key={index}
            label={d.delay(index + 1)}
            help={d.daysHelp(DELAY_RANGE.min, DELAY_RANGE.max)}
            error={delaysOk[index] ? null : d.daysBad(DELAY_RANGE.min, DELAY_RANGE.max)}
            value={delay}
            onChange={(text) => {
              setDelays(shown.map((old, at) => (at === index ? text : old)));
              setMessage(null);
            }}
          />
        ))}
        <NumberField
          label={d.closeAfter}
          help={d.daysHelp(CLOSE_RANGE.min, CLOSE_RANGE.max)}
          error={closeOk ? null : d.daysBad(CLOSE_RANGE.min, CLOSE_RANGE.max)}
          value={close}
          onChange={(text) => {
            setClose(text);
            setMessage(null);
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!delaysOk.every(Boolean) || !closeOk}>
            {d.save}
          </Button>
          <p role="status" className="text-ink-2 type-caption">
            {message}
          </p>
        </div>
      </form>
    </Card>
  );
}

/** FR-10.5: theme and text size, applied at once. */
/** A source that can't run yet: shown as off, with why, never as a switch that does nothing. */
function UnavailableSource({ name, why }: { name: string; why: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-label">{name}</span>
        <Tag>{t.sources.unavailable}</Tag>
      </div>
      <p className="max-w-[68ch] text-ink-2 type-caption">{why}</p>
    </div>
  );
}

/** FR-10.3: sources on or off. Only the Hacker News thread can run today. */
function SourcesCard() {
  const { data, actions } = useApp();
  const s = t.sources;
  const sources = data.settings.sources;
  return (
    <Card aria-labelledby="sources-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 border-b border-hairline pb-4">
        <h2 id="sources-title" className="type-title">
          {s.title}
        </h2>
        <p className="max-w-[68ch] text-ink-2 type-caption">{s.caption}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <ChoicePills
          label={s.community}
          name="source-community"
          options={['off', 'on'] as const}
          labels={s.choices}
          value={sources.community ? 'on' : 'off'}
          onChange={(value) => actions.updateSettings({ sources: { ...sources, community: value === 'on' } })}
        />
        <p className="max-w-[68ch] text-ink-2 type-caption">{s.communityHelp}</p>
      </div>
      <UnavailableSource name={s.funding} why={s.fundingWhy} />
      <UnavailableSource name={s.posts} why={s.postsWhy} />
    </Card>
  );
}

/**
 * FR-10.2: the monthly spending cap (AC-4.13), in whole dollars at the list
 * price. It says plainly that the app can't see whether the key is billed.
 */
function SpendCard() {
  const { data, today, actions } = useApp();
  const s = t.spend;
  const [cap, setCap] = useState(String(data.settings.monthlyCap));
  const capOk = isValidMonthlyCap(asWhole(cap));
  const spent = spentThisMonth(data.runs, today);

  return (
    <Card aria-labelledby="spend-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 border-b border-hairline pb-4">
        <h2 id="spend-title" className="type-title">
          {s.title}
        </h2>
        <p className="max-w-[68ch] text-ink-2 type-caption">{s.caption}</p>
      </div>

      <NumberField
        label={s.cap}
        help={s.capHelp(MONTHLY_CAP_RANGE.min, MONTHLY_CAP_RANGE.max)}
        error={capOk ? null : s.capBad(MONTHLY_CAP_RANGE.min, MONTHLY_CAP_RANGE.max)}
        value={cap}
        onChange={(text) => {
          setCap(text);
          const value = asWhole(text);
          if (isValidMonthlyCap(value)) actions.updateSettings({ monthlyCap: value });
        }}
      />

      <p className="max-w-[68ch] type-body">
        {s.month(usd(spent.usd), usd(data.settings.monthlyCap))} {spent.partial ? s.partial : ''}
      </p>
      <p className="max-w-[68ch] text-ink-2 type-caption">{s.billing(PRICES_CHECKED_ON)}</p>
    </Card>
  );
}

function LookCard() {
  const { data, actions } = useApp();
  const l = t.look;
  const display = data.settings.display;
  return (
    <Card aria-labelledby="look-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 border-b border-hairline pb-4">
        <h2 id="look-title" className="type-title">
          {l.title}
        </h2>
        <p className="max-w-[68ch] text-ink-2 type-caption">{l.caption}</p>
      </div>
      <ChoicePills
        label={l.theme}
        name="theme"
        options={THEMES}
        labels={l.themes}
        value={display.theme}
        onChange={(theme) => actions.updateSettings({ display: { ...display, theme } })}
      />
      <ChoicePills
        label={l.textSize}
        name="text-size"
        options={TEXT_SIZES}
        labels={l.textSizes}
        value={display.textSize}
        onChange={(textSize) => actions.updateSettings({ display: { ...display, textSize } })}
      />
    </Card>
  );
}
