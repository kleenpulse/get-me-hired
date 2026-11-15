// The lead detail side panel. It is a native <dialog>, so the browser traps
// focus inside it, closes it on Escape, and returns focus when it closes.

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Lead } from '@/core/lead';
import { localDate } from '@/core/dates';
import { shortDate } from '@/app/format';
import { strings } from '@/app/strings';
import { LeadCard } from './LeadCard';
import { IconButton } from './ui';

const t = strings.lead;

export function LeadPanel({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-label={`${lead.company}: ${t.details}`}
      onClose={onClose}
      // A click on the scrim lands on the dialog itself, outside its content.
      onClick={(event) => event.target === dialog.current && dialog.current?.close()}
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-[480px] animate-panel-in overflow-y-auto bg-sheet p-0 text-foreground elev-overlay"
    >
      <div className="flex min-h-full flex-col gap-gutter p-gutter">
        <div className="flex items-center justify-between gap-3">
          <h2 className="type-title">{t.details}</h2>
          <IconButton icon={X} label={t.close} onClick={() => dialog.current?.close()} />
        </div>

        <LeadCard lead={lead} as="div" />

        <section className="rounded-card bg-card p-card">
          <h3 className="type-label">{t.history}</h3>
          <ol className="mt-2 flex flex-col gap-1 type-body">
            {lead.statusHistory.map((change, index) => (
              <li key={`${change.at}-${index}`}>
                {t.historyEntry(strings.statuses[change.status], shortDate(localDate(new Date(change.at))))}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </dialog>
  );
}
