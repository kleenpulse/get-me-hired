// Your profile (FRD §6.3): the five questions and every field in FR-3.3, with
// ideas to tap next to the list fields (FR-3.4). Nothing is saved until "Save
// profile", and leaving with unsaved changes asks first (AC-3.2). The profile
// downloads and opens as the skill's `profile.md` (FR-3.5, AC-3.3).
//
// Building the profile from a CV, a LinkedIn PDF or a portfolio URL needs an
// AI provider (FR-3.1, FR-3.7). It comes with the provider key screen.

import { Check, Download, FileUp, Plus, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  badProofLinks,
  cleanProfile,
  emptyProfile,
  looksLikeProfileMd,
  missingFields,
  readProfileMd,
  REMOTE_PREFERENCES,
  writeProfileMd,
  type Profile as ProfileData,
} from '@/core/profile';
import { ChipField, FieldLabel, INPUT, TextField } from '@/components/fields';
import { Banner, Button, Card, cx, IconButton } from '@/components/ui';
import { downloadText } from '../download';
import { setLeaveGuard } from '../router';
import { useApp } from '../state';
import { strings } from '../strings';

const t = strings.profile;
const f = t.fields;

/** A profile.md is a few kilobytes. Anything this big is something else. */
const MAX_FILE_BYTES = 1_000_000;

const same = (a: ProfileData, b: ProfileData) => JSON.stringify(cleanProfile(a)) === JSON.stringify(cleanProfile(b));

function Group({ id, title, caption, children }: { id: string; title: string; caption: string; children: ReactNode }) {
  return (
    <Card aria-labelledby={id} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 border-b border-hairline pb-4">
        <h2 id={id} className="type-title">
          {title}
        </h2>
        <p className="max-w-[68ch] text-ink-2 type-caption">{caption}</p>
      </div>
      {children}
    </Card>
  );
}

function RemoteChoice({ value, onChange }: { value: ProfileData['remote']; onChange: (value: ProfileData['remote']) => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 type-label">{f.remote.label}</legend>
      <div className="flex flex-wrap gap-2">
        {REMOTE_PREFERENCES.map((option) => (
          <label
            key={option}
            className={cx(
              'inline-flex min-h-[46px] cursor-pointer items-center gap-2 rounded-pill px-4 type-label transition-[background-color,box-shadow] duration-150 ease-dawn',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
              value === option ? 'bg-lift elev-lift' : 'bg-nested hover:brightness-95',
            )}
          >
            <input
              type="radio"
              name="remote"
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {value === option && <Check size={16} strokeWidth={1.5} aria-hidden />}
            {f.remote.options[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ProofLinks({
  links,
  showErrors,
  onChange,
}: {
  links: ProfileData['proofLinks'];
  showErrors: boolean;
  onChange: (links: ProfileData['proofLinks']) => void;
}) {
  const p = f.proofLinks;
  const bad = new Set(badProofLinks({ ...emptyProfile(), proofLinks: links }));
  const addButton = useRef<HTMLButtonElement>(null);
  const [focusRow, setFocusRow] = useState<number | null>(null);
  const list = useRef<HTMLOListElement>(null);

  // After adding a row, move focus into it. After removing one, back to the add button.
  useEffect(() => {
    if (focusRow === null) return;
    if (focusRow < 0) addButton.current?.focus();
    else list.current?.querySelectorAll<HTMLInputElement>('input[type="url"]')[focusRow]?.focus();
    setFocusRow(null);
  }, [focusRow]);

  const change = (index: number, part: 'url' | 'line', text: string) =>
    onChange(links.map((link, at) => (at === index ? { ...link, [part]: text } : link)));

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel id="proof-label">{p.label}</FieldLabel>
      <p className="max-w-[68ch] text-ink-2 type-caption">{p.help}</p>
      {links.length > 0 && (
        <ol ref={list} aria-labelledby="proof-label" className="flex flex-col gap-2">
          {links.map((link, index) => {
            const error = showErrors && bad.has(index);
            const number = index + 1;
            return (
              // Rows have no stable id, and their order is the order the user typed them.
              <li key={index} className="flex flex-col gap-2 rounded-tile bg-nested p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-2 type-caption">{p.item(number)}</span>
                  <IconButton
                    icon={X}
                    label={p.remove(number)}
                    onClick={() => {
                      onChange(links.filter((_, at) => at !== index));
                      setFocusRow(-1);
                    }}
                    className="size-9 bg-lift"
                  />
                </div>
                <TextField
                  label={p.url}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  placeholder="https://"
                  value={link.url}
                  error={error ? p.bad : undefined}
                  onChange={(text) => change(index, 'url', text)}
                />
                <TextField label={p.line} value={link.line} onChange={(text) => change(index, 'line', text)} />
              </li>
            );
          })}
        </ol>
      )}
      <div>
        <Button
          ref={addButton}
          icon={Plus}
          onClick={() => {
            onChange([...links, { url: '', line: '' }]);
            setFocusRow(links.length);
          }}
        >
          {p.add}
        </Button>
      </div>
    </div>
  );
}

function Facts({ facts, onChange }: { facts: string[]; onChange: (facts: string[]) => void }) {
  const b = f.background;
  const list = useRef<HTMLOListElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const [focusRow, setFocusRow] = useState<number | null>(null);

  useEffect(() => {
    if (focusRow === null) return;
    if (focusRow < 0) addButton.current?.focus();
    else list.current?.querySelectorAll<HTMLInputElement>('input')[focusRow]?.focus();
    setFocusRow(null);
  }, [focusRow]);

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel id="facts-label">{b.label}</FieldLabel>
      <p className="max-w-[68ch] text-ink-2 type-caption">{b.help}</p>
      {facts.length > 0 && (
        <ol ref={list} aria-labelledby="facts-label" className="flex flex-col gap-2">
          {facts.map((fact, index) => (
            <li key={index} className="flex items-center gap-2">
              <input
                aria-label={b.item(index + 1)}
                value={fact}
                onChange={(event) => onChange(facts.map((value, at) => (at === index ? event.target.value : value)))}
                className={INPUT}
              />
              <IconButton
                icon={X}
                label={b.remove(index + 1)}
                onClick={() => {
                  onChange(facts.filter((_, at) => at !== index));
                  setFocusRow(-1);
                }}
              />
            </li>
          ))}
        </ol>
      )}
      <div>
        <Button
          ref={addButton}
          icon={Plus}
          onClick={() => {
            onChange([...facts, '']);
            setFocusRow(facts.length);
          }}
        >
          {b.add}
        </Button>
      </div>
    </div>
  );
}

export function Profile() {
  const { data, savingOff, actions } = useApp();
  const saved = data.profile ?? emptyProfile();
  const [draft, setDraft] = useState<ProfileData>(saved);
  const [showErrors, setShowErrors] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'failure' } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const dirty = !same(draft, saved);
  const missing = missingFields(cleanProfile(draft));
  const set = <K extends keyof ProfileData>(key: K) => (value: ProfileData[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage(null);
  };

  // Ask before leaving with unsaved changes (AC-3.2): inside the app, and when the tab closes.
  useEffect(() => {
    if (!dirty) return;
    const stopGuard = setLeaveGuard(() => window.confirm(t.leave));
    const onUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      stopGuard();
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [dirty]);

  const save = () => {
    if (badProofLinks(draft).length > 0) {
      setShowErrors(true);
      setMessage({ text: t.fixFirst, tone: 'failure' });
      return;
    }
    const clean = cleanProfile(draft);
    actions.saveProfile(clean);
    setDraft(clean);
    setShowErrors(false);
    setMessage({ text: savingOff ? t.savedForNow : t.saved, tone: 'info' });
  };

  const open = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setMessage({ text: t.file.tooBig, tone: 'failure' });
    let text: string;
    try {
      text = await file.text();
    } catch {
      return setMessage({ text: t.file.unreadable, tone: 'failure' });
    }
    if (!looksLikeProfileMd(text)) return setMessage({ text: t.file.notProfile, tone: 'failure' });
    setDraft(readProfileMd(text));
    setShowErrors(true);
    setMessage({ text: t.file.opened, tone: 'info' });
  };

  return (
    <div className="flex max-w-[760px] flex-col gap-gutter">
      <header className="px-2 pt-2">
        <h1 className="type-display">{t.title}</h1>
        <p className="mt-1 max-w-[68ch] text-ink-2 type-body">{t.intro}</p>
      </header>

      {missing.length > 0 && (
        <Banner tone="warning" icon={TriangleAlert}>
          {t.missing(missing)}
        </Banner>
      )}

      <Group id="group-basics" title={t.groups.basics.title} caption={t.groups.basics.caption}>
        <ChipField
          label={f.roles.label}
          help={f.roles.help}
          required
          values={draft.roles}
          onChange={set('roles')}
          examples={f.roles.examples}
        />
        <ChipField
          label={f.skills.label}
          help={f.skills.help}
          required
          values={draft.skills}
          onChange={set('skills')}
          examples={f.skills.examples}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label={f.location.label}
            help={f.location.help}
            placeholder={f.location.placeholder}
            required
            autoComplete="address-level2"
            value={draft.location}
            onChange={set('location')}
          />
          <TextField
            label={f.timeZone.label}
            help={f.timeZone.help}
            placeholder={f.timeZone.placeholder}
            value={draft.timeZone}
            onChange={set('timeZone')}
          />
        </div>
        <RemoteChoice value={draft.remote} onChange={set('remote')} />
        <TextField
          label={f.floor.label}
          help={f.floor.help}
          placeholder={f.floor.placeholder}
          required
          value={draft.floor}
          onChange={set('floor')}
        />
        <ProofLinks links={draft.proofLinks} showErrors={showErrors} onChange={set('proofLinks')} />
      </Group>

      <Group id="group-prefer" title={t.groups.prefer.title} caption={t.groups.prefer.caption}>
        <ChipField
          label={f.domains.label}
          help={f.domains.help}
          values={draft.domains}
          onChange={set('domains')}
          examples={f.domains.examples}
        />
        <ChipField
          label={f.stages.label}
          help={f.stages.help}
          values={draft.stages}
          onChange={set('stages')}
          examples={f.stages.examples}
        />
        <TextField
          label={f.teamSize.label}
          help={f.teamSize.help}
          placeholder={f.teamSize.placeholder}
          value={draft.teamSize}
          onChange={set('teamSize')}
        />
      </Group>

      <Group id="group-skip" title={t.groups.skip.title} caption={t.groups.skip.caption}>
        <ChipField
          label={f.skipCompanies.label}
          help={f.skipCompanies.help}
          values={draft.skipCompanies}
          onChange={set('skipCompanies')}
          examples={f.skipCompanies.examples}
        />
        <ChipField
          label={f.skipRoles.label}
          help={f.skipRoles.help}
          values={draft.skipRoles}
          onChange={set('skipRoles')}
          examples={f.skipRoles.examples}
        />
      </Group>

      <Group id="group-moving" title={t.groups.moving.title} caption={t.groups.moving.caption}>
        <TextField label={f.relocation.label} help={f.relocation.help} value={draft.relocation} onChange={set('relocation')} />
        <TextField label={f.visa.label} help={f.visa.help} value={draft.visa} onChange={set('visa')} />
      </Group>

      <Group id="group-background" title={t.groups.background.title} caption={t.groups.background.caption}>
        <Facts facts={draft.background} onChange={set('background')} />
      </Group>

      <Card aria-labelledby="file-title" className="flex flex-col gap-3">
        <h2 id="file-title" className="type-title">
          {t.file.title}
        </h2>
        <p className="max-w-[68ch] type-body">{t.file.body}</p>
        <div className="flex flex-wrap gap-2">
          <Button icon={Download} onClick={() => downloadText('profile.md', writeProfileMd(cleanProfile(draft)), 'text/markdown')}>
            {t.file.download}
          </Button>
          <Button icon={FileUp} onClick={() => fileInput.current?.click()}>
            {t.file.open}
          </Button>
          {/* The button above opens this. It stays hidden, and its label keeps form tools happy. */}
          <label className="hidden">
            {t.file.open}
            <input
              ref={fileInput}
              type="file"
              accept=".md,text/markdown,text/plain"
              tabIndex={-1}
              onChange={(event) => void open(event)}
            />
          </label>
        </div>
      </Card>

      {/* The save bar stays in view while the form scrolls. */}
      <div className="sticky bottom-[calc(64px+var(--gutter))] z-10 lg:bottom-gutter">
        <Card as="div" className="flex items-center justify-between gap-3 border border-hairline elev-overlay">
          <p role="status" className={cx('min-w-0 flex-1 type-body', message?.tone === 'failure' && 'text-critical')}>
            {message?.text ?? (dirty ? t.unsaved : savingOff ? t.allSavedForNow : t.allSaved)}
          </p>
          <Button variant="primary" onClick={save} disabled={!dirty && data.profile !== null} className="shrink-0">
            {t.save}
          </Button>
        </Card>
      </div>
    </div>
  );
}
