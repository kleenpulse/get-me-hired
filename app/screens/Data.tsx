// Data: where the data lives (FR-1.5, AC-1.5), backup and restore (FR-9.2),
// the do-not-contact list (FR-5.7), sample mode, and "Delete everything"
// behind a typed confirmation (FR-9.5).

import { Ban, Check, Download, FileUp, HardDrive, TriangleAlert, X } from 'lucide-react';
import { useId, useRef, useState, type ChangeEvent } from 'react';
import { applyBlockList, readTypedEntry, sameEntry, type BlockEntry } from '@/core/block';
import { INPUT } from '@/components/fields';
import { Banner, Button, Card, IconButton } from '@/components/ui';
import type { Incoming } from '../backup';
import { browserName, shortDate } from '../format';
import { useApp } from '../state';
import { strings } from '../strings';

const t = strings.data;
const b = t.backup;
const k = t.block;

function describeEntry(entry: BlockEntry): string {
  if (entry.kind === 'email') return k.kinds.email(entry.value);
  if (entry.kind === 'domain') return k.kinds.domain(entry.value);
  return k.kinds.person(entry.value, entry.at);
}

function BlockCard() {
  const { data, today, actions } = useApp();
  const inputId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<{ entry: BlockEntry; removes: number } | null>(null);
  const [message, setMessage] = useState<{ tone: 'info' | 'failure'; text: string } | null>(null);

  const block = (entry: BlockEntry) => {
    const removed = actions.block([entry]);
    setText('');
    setPending(null);
    setMessage({ tone: 'info', text: k.done(entry.value, removed) });
  };

  const submit = () => {
    const read = readTypedEntry(text, today);
    if (!read.ok) return setMessage({ tone: 'failure', text: read.reason === 'shared' ? k.shared : k.invalid });
    if (data.doNotContact.some((known) => sameEntry(known, read.entry))) return setMessage({ tone: 'failure', text: k.already });
    // A domain can remove saved leads, so it asks first and says how many (it can't be undone).
    const removes = data.leads.filter((lead) => applyBlockList(lead, [read.entry]).kind === 'drop').length;
    if (removes === 0) return block(read.entry);
    setPending({ entry: read.entry, removes });
    dialog.current?.showModal();
  };

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="type-title">{k.title}</h2>
      <p className="max-w-[68ch] type-body">{k.body}</p>
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label htmlFor={inputId} className="type-label">
          {k.label}
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setMessage(null);
            }}
            placeholder={k.placeholder}
            autoComplete="off"
            spellCheck={false}
            className={INPUT}
          />
          <Button type="submit" icon={Ban} disabled={!text.trim()}>
            {k.add}
          </Button>
        </div>
      </form>
      <div role="status">
        {message && (
          <Banner tone={message.tone} icon={message.tone === 'info' ? Check : TriangleAlert}>
            {message.text}
          </Banner>
        )}
      </div>

      {data.doNotContact.length === 0 ? (
        <p className="text-ink-2 type-caption">{k.empty}</p>
      ) : (
        <ul aria-label={k.listLabel} className="flex flex-col gap-1">
          {data.doNotContact.map((entry) => (
            <li key={`${entry.kind}:${entry.value}:${entry.kind === 'person' ? entry.at : ''}`} className="flex items-center gap-2 rounded-pill bg-lift py-1 pr-1 pl-4">
              <span className="min-w-0 flex-1 break-words type-body">{describeEntry(entry)}</span>
              <IconButton
                icon={X}
                label={k.unblock(entry.value)}
                onClick={() => {
                  actions.unblock(entry);
                  setMessage({ tone: 'info', text: k.unblocked(entry.value) });
                }}
                className="size-9"
              />
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialog}
        aria-labelledby="block-title"
        onClose={() => setPending(null)}
        className="m-auto w-[min(440px,calc(100vw-2*var(--gutter)))] rounded-card border border-hairline bg-sheet p-card text-foreground elev-overlay"
      >
        {pending && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              block(pending.entry);
              dialog.current?.close();
            }}
          >
            <h3 id="block-title" className="type-title">
              {k.confirmTitle(pending.entry.value)}
            </h3>
            <p className="type-body">{k.confirmBody(pending.removes)}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={() => dialog.current?.close()}>{k.cancel}</Button>
              <Button type="submit" variant="destructive">
                {k.confirm}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </Card>
  );
}

/** A backup is a few megabytes at most. A bigger file is refused before it is read. */
const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

function BackupCard() {
  const { data, actions } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<Incoming | null>(null);
  const [replaceProfile, setReplaceProfile] = useState(false);
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'failure'; text: string } | null>(null);
  const last = data.settings.lastBackupOn;

  const open = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setMessage(null);
    if (file.size > MAX_BACKUP_BYTES) return setMessage({ tone: 'failure', text: b.problems['too-big'] });
    setReading(true);
    const [{ readBackup }, { inflateRaw }] = await Promise.all([import('../backup'), import('../inflate')]);
    const result = await readBackup(new Uint8Array(await file.arrayBuffer()), inflateRaw).finally(() => setReading(false));
    if (!result.ok) return setMessage({ tone: 'failure', text: b.problems[result.problem] });
    setPending(result.incoming);
    setReplaceProfile(false);
    dialog.current?.showModal();
  };

  const bringIn = async () => {
    if (!pending) return;
    const summary = await actions.importBackup(pending, replaceProfile);
    dialog.current?.close();
    setPending(null);
    setMessage({
      tone: 'info',
      text: [b.done(summary.added, summary.alreadyHere, summary.runsAdded), b.profileDone[summary.profile], summary.needsReview > 0 ? b.reviewDone(summary.needsReview) : '']
        .filter(Boolean)
        .join(' '),
    });
  };

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="type-title">{b.title}</h2>
      <p className="max-w-[68ch] type-body">{b.body}</p>
      <p className="text-ink-2 type-caption">{last ? b.last(shortDate(last)) : b.never}</p>
      <div className="flex flex-wrap gap-2">
        <Button icon={Download} onClick={() => void actions.exportBackup()}>
          {b.export}
        </Button>
        <Button icon={FileUp} disabled={reading} onClick={() => fileInput.current?.click()}>
          {reading ? b.reading : b.import}
        </Button>
        <label className="hidden">
          {b.import}
          <input ref={fileInput} type="file" accept=".zip,application/zip" tabIndex={-1} onChange={(event) => void open(event)} />
        </label>
      </div>
      <div role="status">
        {message && (
          <Banner tone={message.tone} icon={message.tone === 'info' ? Check : TriangleAlert}>
            {message.text}
          </Banner>
        )}
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="import-title"
        onClose={() => setPending(null)}
        className="m-auto w-[min(480px,calc(100vw-2*var(--gutter)))] rounded-card border border-hairline bg-sheet p-card text-foreground elev-overlay"
      >
        {pending && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void bringIn();
            }}
          >
            <h3 id="import-title" className="type-title">
              {b.confirmTitle}
            </h3>
            <p className="type-body">{b.contents(pending.leads.length, pending.runs.filter((run) => run.report).length, pending.profile !== null)}</p>
            <p className="max-w-[68ch] text-ink-2 type-caption">{b.mergeNote}</p>
            {/* Only asked when there is a profile on both sides. Keeping yours is the default. */}
            {pending.profile && data.profile && (
              <label className="flex min-h-11 cursor-pointer items-center gap-3 type-label">
                <input
                  type="checkbox"
                  checked={replaceProfile}
                  onChange={(event) => setReplaceProfile(event.target.checked)}
                  className="size-5 cursor-pointer accent-[var(--foreground)]"
                />
                {b.replaceProfile}
              </label>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={() => dialog.current?.close()}>{b.cancel}</Button>
              <Button type="submit" variant="primary">
                {b.confirm}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </Card>
  );
}

function DeleteEverything() {
  const { actions } = useApp();
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');
  const [failed, setFailed] = useState(false);
  const d = t.deleteAll;

  const close = () => {
    dialog.current?.close();
    setTyped('');
    setFailed(false);
  };

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="type-title">{d.title}</h2>
      <p className="max-w-[68ch] type-body">{d.body}</p>
      <div>
        <Button onClick={() => dialog.current?.showModal()}>{d.open}</Button>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="delete-title"
        onClose={() => {
          setTyped('');
          setFailed(false);
        }}
        className="m-auto w-[min(440px,calc(100vw-2*var(--gutter)))] rounded-card bg-sheet p-card text-foreground elev-overlay"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (typed !== d.word) return;
            actions.deleteEverything().then(close, () => setFailed(true));
          }}
        >
          <h3 id="delete-title" className="type-title">
            {d.confirmTitle}
          </h3>
          {failed && (
            <p role="alert" className="rounded-tile bg-critical-soft px-4 py-3 type-body">
              {d.failed}
            </p>
          )}
          <p className="type-body">{d.confirmBody}</p>
          <label className="flex flex-col gap-1.5">
            <span className="type-label">{d.typeLabel}</span>
            <input
              name="confirm"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="min-h-[46px] rounded-pill bg-nested px-4 type-data"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={close}>{d.cancel}</Button>
            <Button type="submit" variant="destructive" disabled={typed !== d.word}>
              {d.confirm}
            </Button>
          </div>
        </form>
      </dialog>
    </Card>
  );
}

export function Data() {
  const { data, persistence, savingOff, actions } = useApp();
  const browser = browserName(navigator.userAgent);

  return (
    <div className="flex flex-col gap-gutter">
      <header className="px-2 pt-2">
        <h1 className="type-display">{t.title}</h1>
      </header>

      <div className="grid gap-gutter md:grid-cols-2 md:items-start">
        <Card className="flex flex-col gap-3">
          <h2 className="type-title">{t.storage.title}</h2>
          {savingOff ? (
            <p className="max-w-[68ch] type-body">{t.storage.savingOff(browser)}</p>
          ) : (
            <>
              <p className="max-w-[68ch] type-body">{t.storage.body(browser)}</p>
              <Banner
                tone={persistence === 'granted' || persistence === 'unknown' ? 'info' : 'warning'}
                icon={persistence === 'granted' || persistence === 'unknown' ? HardDrive : TriangleAlert}
              >
                {t.storage.persistent[persistence]}
              </Banner>
              <p className="max-w-[68ch] text-ink-2 type-caption">{t.storage.warning}</p>
            </>
          )}
        </Card>

        <div className="flex flex-col gap-gutter">
          <BackupCard />
          <BlockCard />
          <Card className="flex flex-col gap-3">
            <h2 className="type-title">{t.sample.title}</h2>
            <p className="max-w-[68ch] type-body">{data.settings.sampleMode ? t.sample.on : t.sample.off}</p>
            <div>
              {data.settings.sampleMode ? (
                <Button onClick={actions.clearSampleData}>{t.sample.turnOff}</Button>
              ) : (
                <Button onClick={actions.startSampleMode}>{t.sample.turnOn}</Button>
              )}
            </div>
          </Card>

          <DeleteEverything />
        </div>
      </div>
    </div>
  );
}
