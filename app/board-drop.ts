// What a drop on a Board column should do. Pulled out of the screen so it can
// be tested: a column also receives text, links and files dragged in from
// other pages and apps, and those must change nothing.

import type { Lead, LeadStatus } from '@/core/lead';

/** The drag data type of a Board tile. Anything dragged without it is ignored. */
export const DRAG_TYPE = 'application/x-get-me-hired-lead';

/**
 * The lead to move, or `null` when the drop should do nothing: it isn't one of
 * this Board's tiles, the key isn't a saved lead, or the lead is already in
 * that column.
 */
export function droppedLead(
  types: readonly string[],
  key: string,
  leads: readonly Lead[],
  status: LeadStatus,
): Lead | null {
  if (!types.includes(DRAG_TYPE) || !key) return null;
  const lead = leads.find((entry) => entry.key === key);
  return lead && lead.status !== status ? lead : null;
}
