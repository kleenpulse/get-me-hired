// The lead card (FR-6.2): company, freshness, facts, signals, fit, people and
// contacts with their labels, hooks and sources. A field that is not known
// says so. It is never left blank.

import { Banknote, Briefcase, Check, Clock, Copy, Mail, MapPin, ThumbsUp } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { personEntry } from '@/core/block';
import { cleanNotes, emailedCount, NOTES_MAX, type Contact, type Lead, type Person, type Signal } from '@/core/lead';
import { nextStepFor } from '@/core/lifecycle';
import { PROVIDERS } from '@/core/providers';
import { newGroupOf, type TodayReason } from '@/core/ranking';
import { ageText, freshness, roleText, roundAgeText, shortDate, whyLine } from '@/app/format';
import { isScrubbed } from '@/app/retention';
import { createNotesSaver, type NotesSaver } from '@/app/notes-saver';
import { useApp } from '@/app/state';
import { strings } from '@/app/strings';
import { ContactLabelPill, FreshnessChip, TierChip } from './lead-parts';
import { Button, Card, cx, IconButton, StatPill, Tag, UnverifiedTag } from './ui';

const t = strings.lead;

/** Signals that mean "we could not confirm this", shown dashed. */
const UNVERIFIED: readonly Signal[] = ['pay-unknown', 'visa-unknown', 'guess-only'];

function ExternalLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={className}>
      {children}
    </a>
  );
}

function host(url: string): string {
  return URL.canParse(url) ? new URL(url).host.replace(/^www\./, '') : url;
}

function EmailRow({ contact, person }: { contact: Contact; person: Person }) {
  const [copied, setCopied] = useState(false);
  const [explained, setExplained] = useState(false);
  const explainId = useId();
  const label = contact.label ?? 'guess';

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    navigator.clipboard.writeText(contact.value).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 break-all type-data">{contact.value}</span>
        <ContactLabelPill label={label} />
        <span className="ml-auto flex items-center gap-2">
          <IconButton icon={copied ? Check : Copy} label={copied ? t.copied : t.copy(contact.value)} onClick={copy} />
          {/* The link holds only the address: no subject and no body (AC-6.5). */}
          <a
            href={`mailto:${contact.value}`}
            aria-label={t.openMail(person.name)}
            title={t.openMail(person.name)}
            className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-nested transition-transform duration-150 hover:brightness-95 active:scale-[0.98]"
          >
            <Mail size={20} strokeWidth={1.5} aria-hidden />
          </a>
        </span>
        <span role="status" className="sr-only">
          {copied ? t.copied : ''}
        </span>
      </div>

      <p className="flex flex-wrap items-center gap-x-2 text-ink-2 type-caption">
        {label === 'published' && contact.evidence && (
          <ExternalLink href={contact.evidence}>{t.foundOn}</ExternalLink>
        )}
        {label === 'pattern' && contact.evidence && <span>{t.patternFrom(contact.evidence)}</span>}
        {label !== 'published' && (
          <>
            <span className="text-foreground">{t.verify}</span>
            <button
              type="button"
              aria-expanded={explained}
              aria-controls={explainId}
              onClick={() => setExplained((open) => !open)}
              className="inline-flex min-h-6 min-w-6 cursor-pointer items-center underline underline-offset-2"
            >
              {t.verifyWhy}
            </button>
          </>
        )}
      </p>
      {label !== 'published' && (
        <p id={explainId} hidden={!explained} className="max-w-[68ch] rounded-note bg-lift p-3 type-body">
          {t.verifyExplain[label]}
        </p>
      )}
    </div>
  );
}

/** What the post asked for, shown second: the method says to email even then (FR-5.6). */
function AskedRow({ contact }: { contact: Contact }) {
  if (contact.method === 'email') return null;
  return (
    <p className="text-ink-2 type-caption">
      {t.asked}:{' '}
      {contact.method === 'dm' ? (
        <span className="text-foreground">
          {t.askedMethods.dm} {contact.value}
        </span>
      ) : (
        <ExternalLink href={contact.value} className="text-foreground">
          {t.askedMethods[contact.method]}
        </ExternalLink>
      )}
    </p>
  );
}

function PersonBlock({
  lead,
  person,
  index,
  onDeleted,
}: {
  lead: Lead;
  person: Person;
  index: number;
  /** Called after a delete, with what to tell screen readers. */
  onDeleted: (message: string) => void;
}) {
  const { actions, data, today } = useApp();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const d = t.deleteDialog;
  const emails = person.contacts.filter((contact) => contact.method === 'email');
  const others = person.contacts.filter((contact) => contact.method !== 'email');
  const emailedOn = person.emailedOn[0];
  const step = lead.status === 'emailed' ? nextStepFor(person, data.settings.cadence) : null;
  const followupDue = step?.kind === 'followup' && step.dueOn <= today ? step : null;
  const blockThem = personEntry(person.name, lead, today);
  const remove = (block: boolean) => {
    dialog.current?.close();
    const done = actions.deletePerson(lead.key, index, person.name, block ? blockThem : null);
    if (done) onDeleted(block ? t.deletedAndBlocked(person.name) : t.deleted(person.name));
  };

  return (
    <li className="flex flex-col gap-2.5 rounded-tile bg-glass p-3.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="type-label">{person.name}</span>
        <span className="text-ink-2 type-caption">{person.role}</span>
      </div>

      {emails.map((contact) => (
        <EmailRow key={contact.value} contact={contact} person={person} />
      ))}
      {others.map((contact) => (
        <AskedRow key={`${contact.method}:${contact.value}`} contact={contact} />
      ))}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {emailedOn ? (
          <>
            <span className="inline-flex items-center gap-1.5 type-label">
              <Check size={16} strokeWidth={1.5} aria-hidden />
              {t.emailedOn(shortDate(emailedOn))}
            </span>
            {person.followupsSent.map((date, sent) => (
              <span key={date + sent} className="text-ink-2 type-caption">
                {t.followupSentOn(sent + 1, shortDate(date))}
              </span>
            ))}
            {followupDue ? (
              <Button onClick={() => actions.markFollowupSent(lead.key, index)}>{t.markFollowup(followupDue.number)}</Button>
            ) : (
              emailedOn === today &&
              person.followupsSent.length === 0 && (
                <Button variant="quiet" onClick={() => actions.unmarkEmailed(lead.key, index)}>
                  {t.undo}
                </Button>
              )
            )}
          </>
        ) : (
          <Button onClick={() => actions.markEmailed(lead.key, index)}>{t.markEmailed}</Button>
        )}
        {/* FR-5.7: block this person at this company. It asks first, and can be undone under Data. */}
        {blockThem && (
          <Button
            variant="quiet"
            aria-label={t.dontContactFor(person.name)}
            onClick={() => {
              if (window.confirm(t.dontContactConfirm(person.name, lead.company))) actions.block([blockThem]);
            }}
            className="ml-auto text-ink-2"
          >
            {t.dontContact}
          </Button>
        )}
        {/* FR-9.5: delete this person's name and contacts everywhere, and keep the lead. */}
        <Button
          variant="quiet"
          aria-label={t.deletePersonFor(person.name)}
          onClick={() => {
            dialog.current?.showModal();
            // The safe choice gets focus, not the first button (Delete).
            cancel.current?.focus();
          }}
          className={cx('text-ink-2', !blockThem && 'ml-auto')}
        >
          {t.deletePerson}
        </Button>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[min(480px,calc(100vw-2*var(--gutter)))] rounded-card border border-hairline bg-sheet p-card text-foreground elev-overlay"
      >
        <div className="flex flex-col gap-4">
          <h2 id={titleId} className="type-title">
            {d.title(person.name)}
          </h2>
          <p className="max-w-[68ch] type-body">{d.body(lead.company)}</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {d.stays.map((line) => (
              <li key={line} className="max-w-[68ch] text-ink-2 type-body">
                {line}
              </li>
            ))}
          </ul>
          {/* Three choices don't fit on one line, so they stack. Focus starts on Cancel. */}
          <div className="flex flex-col gap-2">
            <Button variant="destructive" onClick={() => remove(false)} className="w-full justify-center">
              {d.deleteOnly}
            </Button>
            {blockThem && (
              <Button onClick={() => remove(true)} className="w-full justify-center">
                {d.deleteAndBlock}
              </Button>
            )}
            <Button ref={cancel} onClick={() => dialog.current?.close()} className="w-full justify-center">
              {d.cancel}
            </Button>
          </div>
        </div>
      </dialog>
    </li>
  );
}

function SectionLabel({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h4 className="text-ink-2 type-caption">{children}</h4>
      {aside && <span className="text-ink-2 type-caption tabular">{aside}</span>}
    </div>
  );
}

/**
 * The user's own notes on a lead (FR-6.7). Plain text in a text box, never
 * shown as HTML or Markdown. Saved when the box loses focus, or with Save.
 * They stay with the lead when a person is deleted or removed, travel in
 * backups, and never go into a hunt.
 */
function NotesBlock({ lead }: { lead: Lead }) {
  const { actions } = useApp();
  const id = useId();
  const [text, setText] = useState(lead.notes);
  const [saved, setSaved] = useState(false);
  // What this box last saved, so a change made elsewhere (an import) shows here, and its own
  // save never rewrites the box while you type (a trailing space would vanish).
  const lastSaved = useRef(lead.notes);
  const mounted = useRef(true);
  const key = lead.key;
  // Saves as you type, after a pause, and when the box, the page or the card goes away
  // (notes-saver.ts). Only a real change is saved.
  const saver = useRef<NotesSaver | null>(null);
  if (!saver.current) {
    saver.current = createNotesSaver(
      (notes) => {
        lastSaved.current = notes;
        actions.setNotes(key, notes);
        if (mounted.current) setSaved(true);
      },
      lead.notes,
      { set: (run, ms) => window.setTimeout(run, ms), clear: (timer) => window.clearTimeout(timer) },
    );
  }

  useEffect(() => {
    if (lead.notes === lastSaved.current) return;
    lastSaved.current = lead.notes;
    saver.current?.saved(lead.notes);
    setText(lead.notes);
  }, [lead.notes]);

  useEffect(() => {
    mounted.current = true;
    const onHide = () => saver.current?.flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      mounted.current = false;
      window.removeEventListener('pagehide', onHide);
      saver.current?.dispose();
    };
  }, []);

  const dirty = cleanNotes(text) !== lead.notes;
  const save = () => saver.current?.flush();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ink-2 type-caption">
        {t.notesLabel}
      </label>
      <textarea
        id={id}
        name="notes"
        rows={3}
        maxLength={NOTES_MAX}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          saver.current?.change(event.target.value);
          setSaved(false);
        }}
        onBlur={save}
        aria-describedby={`${id}-help`}
        className="min-h-24 w-full resize-y rounded-tile bg-lift px-4 py-3 text-foreground placeholder:text-ink-3 type-body"
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p id={`${id}-help`} className="max-w-[68ch] text-ink-2 type-caption">
          {t.notesHelp} {t.notesLeft(NOTES_MAX - text.length)}
        </p>
        {dirty && <Button onClick={save}>{t.saveNotes}</Button>}
        <span role="status" className="text-ink-2 type-caption">
          {saved && !dirty ? t.notesSaved : ''}
        </span>
      </div>
    </div>
  );
}

interface LeadCardProps {
  lead: Lead;
  /** Why the lead is in Today's list. Left out on the Board. */
  reason?: TodayReason;
  /** `div` when the card sits inside another surface, such as the side panel. */
  as?: 'article' | 'div';
  className?: string;
}

export function LeadCard({ lead, reason, as = 'article', className }: LeadCardProps) {
  const { now, today } = useApp();
  const nowMs = now.getTime();
  const group = newGroupOf(lead);
  const ring = freshness(lead, nowMs);
  const followupDue = reason?.kind === 'followup';
  // People retention removed (FR-9.7) aren't people to write to.
  const scrubbed = isScrubbed(lead);
  const total = scrubbed ? 0 : lead.people.length;
  const titleId = useId();
  const [deleted, setDeleted] = useState('');
  const people = useRef<HTMLDivElement>(null);
  const readBy = lead.sources.find((source) => source.readBy)?.readBy;

  return (
    <Card as={as} aria-labelledby={titleId} className={cx('flex flex-col gap-4', className)}>
      <header className="flex items-start gap-3.5">
        <FreshnessChip
          letter={lead.company.charAt(0).toUpperCase()}
          left={followupDue ? 1 : ring.left}
          tone={followupDue ? 'warn' : ring.tone}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={titleId} className="type-title">
              {lead.company}
            </h3>
            {lead.sample && <Tag>{t.sample}</Tag>}
          </div>
          <p className="max-w-[68ch] type-body">{lead.about || strings.unknown}</p>
          {reason && <p className="text-ink-2 type-caption">{whyLine(reason, lead, today, nowMs)}</p>}
        </div>
        <TierChip tier={lead.tier} />
      </header>

      <div className="flex flex-wrap gap-2">
        {lead.postedAt === null ? (
          <UnverifiedTag icon={Clock}>{t.age.unknown}</UnverifiedTag>
        ) : group === 'funding' ? (
          <StatPill icon={Clock} value={roundAgeText(lead, nowMs)} name={t.facts.announced} />
        ) : (
          <StatPill icon={Clock} value={ageText(lead, nowMs)} name={t.facts.posted} />
        )}
        {typeof lead.likes === 'number' && <StatPill icon={ThumbsUp} value={lead.likes} name={t.facts.likes} />}
        {lead.likes === 'unknown' && <UnverifiedTag icon={ThumbsUp}>{t.facts.likesUnknown}</UnverifiedTag>}
        {lead.round && <StatPill icon={Banknote} value={lead.round} name={t.facts.round} />}
        <StatPill icon={Briefcase} value={roleText(lead)} name={t.facts.role} />
        <StatPill icon={MapPin} value={lead.location || strings.unknown} name={t.facts.location} />
      </div>
      {/* Facts an AI read for the app, which the app could not check itself (principle 2). */}
      {readBy && <p className="max-w-[68ch] text-ink-2 type-caption">{t.readBy(PROVIDERS[readBy].name)}</p>}

      {lead.signals.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel>{t.signalsLabel}</SectionLabel>
          <ul className="flex flex-wrap gap-2">
            {lead.signals.map((signal) => (
              <li key={signal}>
                {UNVERIFIED.includes(signal) ? (
                  <UnverifiedTag>{t.signals[signal]}</UnverifiedTag>
                ) : (
                  <Tag>{t.signals[signal]}</Tag>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <SectionLabel>{t.fitLabel}</SectionLabel>
        <p className="max-w-[68ch] type-body">{lead.fit || strings.unknown}</p>
      </div>

      <div ref={people} tabIndex={-1} className="flex flex-col gap-2 outline-none">
        <p role="status" className="sr-only">
          {deleted}
        </p>
        <SectionLabel aside={total > 0 ? t.peopleProgress(emailedCount(lead), total) : undefined}>
          {t.peopleLabel}
        </SectionLabel>
        {scrubbed ? (
          <p className="text-ink-2 type-body">{t.peopleRemoved}</p>
        ) : total === 0 ? (
          <p className="type-body">{t.noPeople}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lead.people.map((person, index) => (
              <PersonBlock
                key={person.name}
                lead={lead}
                person={person}
                index={index}
                onDeleted={(message) => {
                  setDeleted(message);
                  // The person's block is gone, so focus moves to the section it was in.
                  people.current?.focus();
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {lead.hooks.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel>{t.hooksLabel}</SectionLabel>
          <ul className="flex flex-col gap-2">
            {lead.hooks.map((hook) => (
              <li key={hook.text} className="rounded-note bg-lift p-3">
                <p className="max-w-[68ch] type-body">{hook.text}</p>
                <p className="mt-1 text-ink-2 type-caption">
                  {t.hookSource}: <ExternalLink href={hook.url}>{host(hook.url)}</ExternalLink>
                </p>
              </li>
            ))}
          </ul>
          <p className="text-ink-2 type-caption">{t.hooksNote}</p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <SectionLabel>{t.sourcesLabel}</SectionLabel>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 type-caption">
          {lead.sources.map((source) => (
            <li key={source.url}>
              {t.sourceKinds[source.kind]}: <ExternalLink href={source.url}>{host(source.url)}</ExternalLink>
            </li>
          ))}
        </ul>
      </div>

      <NotesBlock lead={lead} />
    </Card>
  );
}
