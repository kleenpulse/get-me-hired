// The lead as the app works with it: the 17 columns of `leads.csv` (FRD §11.2)
// as typed fields, plus the extras kept in `get-me-hired.json` (§11.3).

import type { LeadStatus, LeadType } from './leads-csv';
import type { ProviderId } from './providers';

export type { LeadStatus, LeadType } from './leads-csv';

/** How sure we are about an email address (FR-5.3). */
export type ContactLabel = 'published' | 'pattern' | 'guess';

export type ContactMethod = 'email' | 'dm' | 'form' | 'apply';

export interface Contact {
  method: ContactMethod;
  /** The address, or where to DM, or the form or apply URL. */
  value: string;
  /** Emails only. Every email has exactly one label (AC-5.3). */
  label?: ContactLabel;
  /** Published: the page the address is written on. Pattern: the example address it was built from. */
  evidence?: string;
}

export interface Person {
  name: string;
  role: string;
  contacts: Contact[];
  /** Local date (`YYYY-MM-DD`) of the first email. Empty until the user marks this person as emailed. */
  emailedOn: string[];
  /** Local dates of the follow-ups sent, oldest first. */
  followupsSent: string[];
}

/** Where a lead came from. A community thread opening is its own kind, though its CSV type is `post`. */
export type SourceKind = 'post' | 'funding' | 'community';

export interface LeadSource {
  kind: SourceKind;
  url: string;
  /** Local date the source was seen. */
  seen: string;
  /**
   * Set when an AI provider read this page for the app, and the app could not
   * check the facts itself (funding news). Shown on the lead, so a fact read by
   * the AI is never shown as checked (principle 2).
   */
  readBy?: ProviderId;
}

/** A checkable fact the user can mention in their own email (FR-4.20). Never email text. */
export interface Hook {
  text: string;
  url: string;
}

/** Soft signals (FRD §9.2). They lower the tier but never drop the lead. */
export const SIGNALS = [
  'pay-unknown',
  'relocation',
  'visa-unknown',
  'seniority-stretch',
  'outside-domains',
  'no-open-role',
  'equity-only',
  'timezone',
  'guess-only',
  'dm-or-form',
] as const;
export type Signal = (typeof SIGNALS)[number];

export type Tier = 'A' | 'B' | 'C';

/** Why a lead is back at the top of Today (FRD §8.3 and §8.2 rule 4). */
export type Attention = 'new-signal' | 'back-from-not-now';

export interface StatusChange {
  status: LeadStatus;
  /** UTC date-time. */
  at: string;
}

export interface Lead {
  /** The lead key (FRD §11.2). */
  key: string;
  /** Local date the lead was found. */
  foundOn: string;
  type: LeadType;
  company: string;
  companyUrl: string;
  /** One line on what the company does. Empty when unknown. */
  about: string;
  role: string;
  /** One line, at most 140 characters, naming a profile item. */
  fit: string;
  /** When the post, comment or round was published, as a UTC date-time. `null` when unknown. */
  postedAt: string | null;
  /** True when `postedAt` was worked out from words like "11 days ago". */
  postedAtApprox: boolean;
  /** Reactions on the post. `unknown` when the page didn't show them, `n/a` when the source has none. */
  likes: number | 'unknown' | 'n/a';
  /** For example "$4M pre-seed (lead investor)". Empty for posts. */
  round: string;
  location: string;
  people: Person[];
  hooks: Hook[];
  sources: LeadSource[];
  signals: Signal[];
  tier: Tier;
  status: LeadStatus;
  statusHistory: StatusChange[];
  /** Local date a "Not now" lead comes back. */
  snoozeUntil: string | null;
  attention: Attention | null;
  notes: string;
  /** True for the invented leads of sample mode (FR-1.4). They are always labelled, and never exported. */
  sample: boolean;
}

/** The longest a lead's notes can be (FR-6.7). Plenty for notes, and keeps one record small. */
export const NOTES_MAX = 4000;

/**
 * Notes as stored: the user's own plain text (FR-6.7). Line breaks and tabs are
 * kept, other control characters are dropped, trailing space is trimmed, and
 * the length is capped. They're never shown as HTML or Markdown, and never sent
 * with a hunt.
 */
export function cleanNotes(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, NOTES_MAX)
    .trimEnd();
}

/** The name that stands in for the people retention removed from a closed lead (FR-9.7, app/retention.ts). */
export const REMOVED = '(removed)';

/** True for the stand-in retention leaves in place of a lead's people: nobody to write to. */
export function isRemovedPerson(person: Person): boolean {
  return person.name === REMOVED && person.contacts.length === 0;
}

/** True once retention has replaced a lead's people with the one stand-in. */
export function isScrubbed(lead: Pick<Lead, 'people'>): boolean {
  return lead.people.length === 1 && lead.people[0] !== undefined && isRemovedPerson(lead.people[0]);
}

/** The email addresses on a lead, across all its people. */
export function emailContacts(lead: Lead): Contact[] {
  return lead.people.flatMap((person) => person.contacts.filter((contact) => contact.method === 'email'));
}

/** People who have been sent a first email. */
export function emailedCount(lead: Lead): number {
  return lead.people.filter((person) => person.emailedOn.length > 0).length;
}
