// The draft checker (FR-7.1, FR-7.2): the user pastes an email they wrote and
// checks it. Each of the 6 checks passes, shows a problem with its line, or
// says it wasn't checked. The draft is never rewritten, never saved, and never
// sent anywhere: it lives in this screen only (FRD §4 principle 1, NFR-2).

import { Check, CircleHelp, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { checkDraft, type DraftCheck, type DraftProblem } from '@/core/draft-check';
import { isScrubbed } from '@/core/lead';
import { Button, Card, cx } from '@/components/ui';
import { INPUT } from '@/components/fields';
import { useApp } from '../state';
import { strings } from '../strings';

const t = strings.drafts;

function problemText(problem: DraftProblem): string {
  switch (problem.kind) {
    case 'too-long':
      return t.problems.tooLong(problem.lines);
    case 'stock-opener':
      return t.problems.stockOpener;
    case 'no-link':
      return t.problems.noLink;
    case 'many-links':
      return t.problems.manyLinks(problem.links);
    case 'no-subject':
      return t.problems.noSubject;
    case 'subject-misses':
      return t.problems.subjectMisses;
  }
}

function Result({ check }: { check: DraftCheck }) {
  const { icon: Glyph, text, tone } =
    check.state === 'pass'
      ? { icon: Check, text: t.passed, tone: 'text-ink-2' }
      : check.state === 'problem'
        ? {
            icon: TriangleAlert,
            text: check.line ? `${t.onLine(check.line)} ${problemText(check.problem)}` : problemText(check.problem),
            tone: 'text-foreground',
          }
        : check.state === 'needs-ai'
          ? { icon: CircleHelp, text: t.needsAi, tone: 'text-ink-2' }
          : { icon: CircleHelp, text: t.needsLead, tone: 'text-ink-2' };
  return (
    <li className="flex items-start gap-3 rounded-tile bg-lift p-3.5">
      <Glyph size={18} strokeWidth={1.5} aria-hidden className={cx('mt-0.5 shrink-0', tone)} />
      <div className="flex min-w-0 flex-col">
        <span className="type-label">{t.checks[check.id]}</span>
        <span className={cx('type-body', tone)}>{text}</span>
      </div>
    </li>
  );
}

export function Drafts() {
  const { data } = useApp();
  const subjectId = useId();
  const leadId = useId();
  const bodyId = useId();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [leadKey, setLeadKey] = useState('');
  const [results, setResults] = useState<DraftCheck[] | null>(null);
  const leads = data.leads.filter((lead) => !isScrubbed(lead));
  const lead = leads.find((entry) => entry.key === leadKey) ?? null;
  const problems = results?.filter((check) => check.state === 'problem').length ?? 0;

  return (
    <div className="flex flex-col gap-gutter">
      <header className="px-2 pt-2">
        <h1 className="type-display">{t.title}</h1>
        <p className="mt-1 max-w-[68ch] text-ink-2 type-body">{t.intro}</p>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-gutter lg:grid-cols-2 lg:items-start">
        <Card aria-labelledby="draft-title" className="flex flex-col gap-4">
          <h2 id="draft-title" className="type-title">
            {t.yourDraft}
          </h2>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setResults(checkDraft({ subject, body, lead }));
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor={leadId} className="type-label">
                {t.forLead}
              </label>
              <select id={leadId} value={leadKey} onChange={(event) => setLeadKey(event.target.value)} className="min-h-11 w-full min-w-0 cursor-pointer rounded-pill bg-nested px-4 type-label">
                <option value="">{t.noLead}</option>
                {leads.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.role ? t.leadOption(entry.company, entry.role) : entry.company}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={subjectId} className="type-label">
                {t.subject}
              </label>
              <input id={subjectId} value={subject} onChange={(event) => setSubject(event.target.value)} autoComplete="off" className={INPUT} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={bodyId} className="type-label">
                {t.body}
              </label>
              <textarea
                id={bodyId}
                rows={10}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                aria-describedby={`${bodyId}-note`}
                className="min-h-56 w-full resize-y rounded-tile bg-lift px-4 py-3 text-foreground type-body"
              />
              <p id={`${bodyId}-note`} className="max-w-[68ch] text-ink-2 type-caption">
                {t.private}
              </p>
            </div>
            <div>
              <Button type="submit" variant="primary">
                {results ? t.checkAgain : t.check}
              </Button>
            </div>
          </form>
        </Card>

        <Card aria-labelledby="results-title" className="flex flex-col gap-4">
          <h2 id="results-title" className="type-title">
            {t.results}
          </h2>
          <p role="status" className="text-ink-2 type-body">
            {results ? (problems === 0 ? t.noProblems : t.problemCount(problems)) : t.notYet}
          </p>
          {results && (
            <ul className="flex flex-col gap-2">
              {results.map((check) => (
                <Result key={check.id} check={check} />
              ))}
            </ul>
          )}
          <p className="max-w-[68ch] text-ink-2 type-caption">{t.neverRewrites}</p>
        </Card>
      </div>
    </div>
  );
}
