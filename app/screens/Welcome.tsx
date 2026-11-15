// The welcome flow (FR-1.2): what the app does, what it will never do, and
// what it costs and where the data lives. One centred column, no rail.

import { Check, Shield } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, Card } from '@/components/ui';
import { browserName } from '../format';
import { useApp } from '../state';
import { strings } from '../strings';

const t = strings.welcome;
const STEPS = 3;

function Points({ items, icon: Glyph }: { items: readonly string[]; icon: typeof Check }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 rounded-note bg-glass p-3">
          <Glyph size={20} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0" />
          <span className="type-body">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Welcome() {
  const { actions } = useApp();
  const [step, setStep] = useState(1);
  const heading = useRef<HTMLHeadingElement>(null);
  const browser = browserName(navigator.userAgent);

  // Move focus to the new heading, so keyboard and screen reader users follow the step change.
  useEffect(() => {
    if (step > 1) heading.current?.focus();
  }, [step]);

  const title = step === 1 ? t.does.title : step === 2 ? t.wont.title : t.cost.title;

  return (
    <div className="flex min-h-dvh lg:p-gutter">
      <main className="flex flex-1 items-center justify-center bg-sheet p-gutter lg:rounded-frame">
        <Card tone="dawn" className="flex w-full max-w-[560px] flex-col gap-5">
          <p className="text-ink-2 type-caption">
            {strings.appName} · {t.stepOf(step, STEPS)}
          </p>
          <h1 ref={heading} tabIndex={-1} className="outline-none type-display">
            {title}
          </h1>

          {step === 1 && (
            <>
              <p className="max-w-[68ch] type-body">{t.does.lead}</p>
              <Points items={t.does.points} icon={Check} />
            </>
          )}

          {step === 2 && (
            <>
              <p className="max-w-[68ch] type-body">{t.wont.lead}</p>
              <Points items={t.wont.points} icon={Shield} />
            </>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-2.5">
              <div className="rounded-note bg-glass p-3">
                <h2 className="type-label">{t.cost.costTitle}</h2>
                <p className="mt-1 type-body">{t.cost.cost}</p>
              </div>
              <div className="rounded-note bg-glass p-3">
                <h2 className="type-label">{t.cost.storageTitle}</h2>
                <p className="mt-1 type-body">{t.cost.storage(browser)}</p>
              </div>
              <p className="text-ink-2 type-caption">{t.cost.contactsNote}</p>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            {step > 1 ? (
              <Button variant="quiet" onClick={() => setStep(step - 1)}>
                {t.back}
              </Button>
            ) : (
              <span />
            )}
            {step < STEPS ? (
              <Button variant="primary" onClick={() => setStep(step + 1)}>
                {t.continue}
              </Button>
            ) : (
              <Button variant="primary" onClick={actions.finishWelcome}>
                {t.start}
              </Button>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
