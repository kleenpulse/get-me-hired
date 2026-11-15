// The lead card (FR-6.2): company, freshness, facts, signals, fit, people and
// contacts with their labels, hooks and sources. A field that is not known
// says so. It is never left blank.

import { Banknote, Briefcase, Check, Clock, Copy, Mail, MapPin, ThumbsUp } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { personEntry } from '@/core/block';
import { emailedCount, type Contact, type Lead, type Person, type Signal } from '@/core/lead';
import { nextStepFor } from '@/core/lifecycle';
import { PROVIDERS } from '@/core/providers';
import { newGroupOf, type TodayReason } from '@/core/ranking';
import { ageText, freshness, roleText, roundAgeText, shortDate, whyLine } from '@/app/format';
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

function PersonBlock({ lead, person, index }: { lead: Lead; person: Person; index: number }) {
  const { actions, data, today } = useApp();
  const emails = person.contacts.filter((contact) => contact.method === 'email');
  const others = person.contacts.filter((contact) => contact.method !== 'email');
  const emailedOn = person.emailedOn[0];
  const step = lead.status === 'emailed' ? nextStepFor(person, data.settings.cadence) : null;
  const followupDue = step?.kind === 'followup' && step.dueOn <= today ? step : null;
  const blockThem = personEntry(person.name, lead, today);

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
      </div>
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
  const total = lead.people.length;
  const titleId = useId();
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

      <div className="flex flex-col gap-2">
        <SectionLabel aside={total > 0 ? t.peopleProgress(emailedCount(lead), total) : undefined}>
          {t.peopleLabel}
        </SectionLabel>
        {total === 0 ? (
          <p className="type-body">{t.noPeople}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lead.people.map((person, index) => (
              <PersonBlock key={person.name} lead={lead} person={person} index={index} />
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
    </Card>
  );
}
