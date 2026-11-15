// Settings. For now it holds the AI provider and its key (FR-2.4, FR-10.1):
// where to get a key, a key field that is hidden by default, a Test button,
// and a plain-language reason when a test fails (AC-2.4). A key is saved only
// after it works, and "Remove key" deletes it at once (AC-10.1).
//
// The key typed here lives in this screen's state until it is tested. It is
// never logged, never put in the address, and never shown again once saved.

import { Check, ClipboardPaste, ExternalLink, Eye, EyeOff, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { PROVIDER_IDS, PROVIDERS, testProviderKey, type KeyProblem, type ProviderId } from '@/core/providers';
import { INPUT } from '@/components/fields';
import { Banner, Button, Card, cx, IconButton, StatusPill } from '@/components/ui';
import { useApp } from '../state';
import { strings } from '../strings';

const t = strings.settings;

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
            type={shown ? 'text' : 'password'}
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
            className={cx(INPUT, 'type-data')}
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
    </div>
  );
}
