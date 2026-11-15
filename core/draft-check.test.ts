import { describe, expect, it } from 'vitest';
import { checkDraft, messageLines, type DraftCheck } from './draft-check';

const LEAD = { role: 'Senior Frontend Engineer', hooks: [{ text: 'Our editor is used by 4,000 labs.' }] };

// An invented draft that should pass every check code can make.
const GOOD = [
  'Hi Ana,',
  '',
  'Your note about the 4,000 labs on your editor stuck with me.',
  'I built the motion system for a design tool used by 30 teams.',
  'Here it is: https://portfolio.example/motion',
  'Could we talk for 15 minutes next week?',
  '',
  'Thanks,',
  'Sam',
].join('\n');

const byId = (checks: DraftCheck[]) => Object.fromEntries(checks.map((check) => [check.id, check]));

describe('the draft checker (FR-7.1, FR-7.2)', () => {
  it('passes what code can check, and never claims the two that need judgement', () => {
    const checks = byId(checkDraft({ subject: 'Senior Frontend Engineer: motion work', body: GOOD, lead: LEAD }));
    expect(checks.length?.state).toBe('pass');
    expect(checks['proof-link']?.state).toBe('pass');
    expect(checks['stock-opener']?.state).toBe('pass');
    expect(checks.subject?.state).toBe('pass');
    expect(checks['first-line']?.state).toBe('needs-ai');
    expect(checks['small-ask']?.state).toBe('needs-ai');
  });

  it('gives all 6 checks, in the order FR-7.1 lists them', () => {
    expect(checkDraft({ subject: '', body: '', lead: null }).map((check) => check.id)).toEqual([
      'length',
      'first-line',
      'proof-link',
      'small-ask',
      'stock-opener',
      'subject',
    ]);
  });

  it('counts message lines only: no blank lines, greeting or signature', () => {
    expect(messageLines(GOOD).map((entry) => entry.line)).toEqual([3, 4, 5, 6]);
    expect(messageLines('Hello there!\nOne.\nTwo.\n\n\n').map((entry) => entry.text)).toEqual(['One.', 'Two.']);
    expect(messageLines('One.\n--\nSam, sam@x.example').map((entry) => entry.text)).toEqual(['One.']);
  });

  it('flags more than 5 lines, at the first line too many', () => {
    const body = ['One.', 'Two.', 'Three.', 'Four.', 'Five.', 'Six. https://a.example'].join('\n');
    expect(byId(checkDraft({ subject: 'x', body, lead: null })).length).toEqual({
      id: 'length',
      state: 'problem',
      problem: { kind: 'too-long', lines: 6 },
      line: 6,
    });
  });

  it('finds stock openers as whole phrases, ignoring case, accents and punctuation', () => {
    const opener = (body: string) => byId(checkDraft({ subject: 'x', body, lead: null }))['stock-opener'];
    expect(opener('Hi Ana,\nI HOPE this email finds you well!\nMore.')).toMatchObject({ state: 'problem', line: 2, problem: { phrase: 'i hope this email finds you well' } });
    expect(opener("I'm writing to ask about the role.")).toMatchObject({ state: 'problem', line: 1 });
    expect(opener('My name is Sam.')).toMatchObject({ state: 'problem' });
    // Not the phrase: "my names" and a phrase inside other words.
    expect(opener('My names for colours are odd.')).toMatchObject({ state: 'pass' });
    expect(opener('Your post on dark mode stuck with me.')).toMatchObject({ state: 'pass' });
  });

  it('wants exactly one link, in the message or the signature', () => {
    const link = (body: string) => byId(checkDraft({ subject: 'x', body, lead: null }))['proof-link'];
    expect(link('No link here.')).toMatchObject({ state: 'problem', problem: { kind: 'no-link' } });
    expect(link('One https://a.example\nTwo www.b.example')).toMatchObject({ state: 'problem', problem: { kind: 'many-links', links: 2 }, line: 2 });
    expect(link('Short note.\n\nThanks,\nSam https://sam.example')).toMatchObject({ state: 'pass' });
  });

  it("checks the subject against the lead's role or a hook, and asks for the lead first", () => {
    const subject = (text: string, lead: typeof LEAD | null) => byId(checkDraft({ subject: text, body: GOOD, lead })).subject;
    expect(subject('Motion work', null)).toEqual({ id: 'subject', state: 'needs-lead' });
    expect(subject('', LEAD)).toMatchObject({ state: 'problem', problem: { kind: 'no-subject' } });
    expect(subject('About the senior frontend engineer role', LEAD)).toMatchObject({ state: 'pass' });
    expect(subject('Your editor is used everywhere', LEAD)).toMatchObject({ state: 'pass' });
    expect(subject('Quick question', LEAD)).toMatchObject({ state: 'problem', problem: { kind: 'subject-misses' } });
    // Filler and short words from the hook don't count: "used" and "labs" are under 5 letters.
    expect(subject('Used by labs?', LEAD)).toMatchObject({ state: 'problem' });
  });
});
