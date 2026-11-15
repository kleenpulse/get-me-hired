// Data: where the data lives (FR-1.5, AC-1.5), sample mode, and "Delete
// everything" behind a typed confirmation (FR-9.5).

import { HardDrive, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { Banner, Button, Card } from '@/components/ui';
import { browserName } from '../format';
import { useApp } from '../state';
import { strings } from '../strings';

const t = strings.data;

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
