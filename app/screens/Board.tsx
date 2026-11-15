// The Board (FR-6.3): every lead by status. On wide screens the statuses are
// columns side by side. Under 768px they stack into a list grouped by status
// (FR-6.14). Leads move with a "Move to" menu, which works by keyboard and on
// phones. Drag-and-drop comes later, on top of the same menu.

import { useState } from 'react';
import { emailedCount, type Lead, type LeadStatus } from '@/core/lead';
import { LeadPanel } from '@/components/LeadPanel';
import { TierChip } from '@/components/lead-parts';
import { Card, EmptyState, Tag } from '@/components/ui';
import { Link } from '../router';
import { useApp } from '../state';
import { strings } from '../strings';

const t = strings.board;

/** The columns that are always shown, in pipeline order. */
const MAIN_STATUSES: LeadStatus[] = ['new', 'emailed', 'replied', 'call', 'offer', 'not-now', 'skip'];
/** Shown only when they hold a lead. */
const CLOSED_STATUSES: LeadStatus[] = ['no-reply', 'rejected'];
const ALL_STATUSES: LeadStatus[] = [...MAIN_STATUSES, ...CLOSED_STATUSES];

function Tile({ lead, onOpen, onMove }: { lead: Lead; onOpen: () => void; onMove: (status: LeadStatus) => void }) {
  const total = lead.people.length;
  return (
    <li className="flex flex-col gap-2.5 rounded-tile bg-lift p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <button
            type="button"
            onClick={onOpen}
            className="cursor-pointer text-left underline-offset-4 type-label hover:underline"
          >
            {lead.company}
          </button>
          <span className="text-ink-2 type-caption">{lead.role || strings.lead.facts.noRole}</span>
        </div>
        <TierChip tier={lead.tier} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {total > 0 && (
          <span className="text-ink-2 type-caption tabular">{strings.lead.peopleProgress(emailedCount(lead), total)}</span>
        )}
        {lead.sample && <Tag>{strings.lead.sample}</Tag>}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-ink-2 type-caption">{strings.lead.moveTo}</span>
        <select
          name="status"
          aria-label={strings.lead.moveToFor(lead.company)}
          value={lead.status}
          onChange={(event) => onMove(event.target.value as LeadStatus)}
          className="min-h-11 cursor-pointer rounded-pill bg-nested px-4 type-label"
        >
          {ALL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {strings.statuses[status]}
            </option>
          ))}
        </select>
      </label>
    </li>
  );
}

export function Board() {
  const { data, actions } = useApp();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const open = data.leads.find((lead) => lead.key === openKey) ?? null;

  const columns = ALL_STATUSES.map((status) => ({
    status,
    leads: data.leads.filter((lead) => lead.status === status),
  })).filter((column) => MAIN_STATUSES.includes(column.status) || column.leads.length > 0);

  const move = (lead: Lead, status: LeadStatus) => {
    if (status === lead.status) return;
    actions.setStatus(lead.key, status);
    setAnnouncement(t.moved(lead.company, strings.statuses[status]));
  };

  return (
    <div className="flex flex-col gap-gutter">
      <header className="px-2 pt-2">
        <h1 className="type-display">{t.title}</h1>
        <p className="mt-1 text-ink-2 type-body">{t.intro}</p>
      </header>

      {/* Screen readers hear where a lead went (AC-6.3). */}
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {data.leads.length === 0 ? (
        <EmptyState
          title={t.empty.title}
          body={t.empty.body}
          action={
            <Link
              to="today"
              className="inline-flex min-h-[46px] items-center rounded-pill bg-nested px-5 no-underline type-label hover:brightness-95"
            >
              {t.empty.action}
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-gutter md:flex-row md:items-start md:overflow-x-auto md:pb-2">
          {columns.map(({ status, leads }) => (
            <Card key={status} aria-labelledby={`column-${status}`} className="flex flex-col gap-3 md:w-[300px] md:shrink-0">
              <div className="flex items-baseline justify-between gap-2">
                <h2 id={`column-${status}`} className="type-title">
                  {strings.statuses[status]}
                </h2>
                <span className="text-ink-2 type-caption tabular">{t.count(leads.length)}</span>
              </div>
              {leads.length === 0 ? (
                <p className="text-ink-2 type-caption">{t.emptyColumn}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {leads.map((lead) => (
                    <Tile key={lead.key} lead={lead} onOpen={() => setOpenKey(lead.key)} onMove={(status) => move(lead, status)} />
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}

      {open && <LeadPanel key={open.key} lead={open} onClose={() => setOpenKey(null)} />}
    </div>
  );
}
