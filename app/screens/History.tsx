// History (FR-8.2): every hunt, newest first, with its run report (FR-8.1).
// Sample hunts are labelled, and their reports are named apart (FR-1.4).

import { ChevronDown, Download, FlaskConical } from 'lucide-react';
import { useId, useState } from 'react';
import { Button, Card, cx, EmptyState, StatusPill, Tag } from '@/components/ui';
import type { RunRecord } from '../data';
import { downloadText } from '../download';
import { clockTime, shortDate } from '../format';
import { useApp } from '../state';
import { strings } from '../strings';

const t = strings.history;

function RunCard({ run }: { run: RunRecord }) {
  const [open, setOpen] = useState(false);
  const reportId = useId();
  const fileName = run.reportName ? `${run.sample ? 'sample-' : ''}${run.reportName}` : null;

  return (
    <Card as="article" aria-labelledby={`${reportId}-title`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id={`${reportId}-title`} className="type-title tabular">
          {shortDate(run.date)} · {clockTime(run.at)}
        </h2>
        <StatusPill dot={run.status === 'completed'}>{t.status[run.status]}</StatusPill>
        {run.sample && <Tag icon={FlaskConical}>{t.sample}</Tag>}
      </div>
      <p className="text-ink-2 type-caption tabular">{t.counts(run.kept, run.dropped.length)}</p>

      {run.report && fileName ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button icon={ChevronDown} aria-expanded={open} aria-controls={reportId} onClick={() => setOpen(!open)}>
              {open ? t.hide : t.show}
            </Button>
            <Button icon={Download} onClick={() => downloadText(fileName, run.report ?? '', 'text/markdown')}>
              {t.download}
            </Button>
          </div>
          <pre
            id={reportId}
            hidden={!open}
            className={cx('max-w-full overflow-x-auto rounded-tile bg-lift p-4 whitespace-pre-wrap break-words type-body')}
          >
            {run.report}
          </pre>
        </>
      ) : (
        <p className="text-ink-2 type-caption">{t.noReport}</p>
      )}
    </Card>
  );
}

export function History() {
  const { data } = useApp();
  const runs = [...data.runs].reverse();

  return (
    <div className="flex max-w-[860px] flex-col gap-gutter">
      <header className="px-2 pt-2">
        <h1 className="type-display">{t.title}</h1>
        <p className="mt-1 max-w-[68ch] text-ink-2 type-body">{t.intro}</p>
      </header>
      {runs.length === 0 ? (
        <EmptyState title={t.empty.title} body={t.empty.body} />
      ) : (
        <ol className="flex flex-col gap-gutter">
          {runs.map((run) => (
            <li key={run.at}>
              <RunCard run={run} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
