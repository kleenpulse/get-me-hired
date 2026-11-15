import { describe, expect, it } from 'vitest';
import { findEmails, firstWebUrl, foldText, isPlainEmail, isQuoted, isWebUrl } from './evidence';

describe('quotes (principle 2)', () => {
  it('finds a quote despite curly quotes, dashes, spacing and case', () => {
    const source = "Remote — worldwide. We're hiring a   Frontend Engineer.";
    expect(isQuoted('remote - worldwide', source)).toBe(true);
    expect(isQuoted('We’re hiring a frontend engineer', source)).toBe(true);
    expect(isQuoted('"Remote — worldwide."', source)).toBe(true);
  });

  it('refuses words that are not there, and quotes too short to prove anything', () => {
    expect(isQuoted('onsite in Berlin', 'Remote, worldwide')).toBe(false);
    expect(isQuoted('Re', 'Remote')).toBe(false);
    expect(isQuoted('', 'Remote')).toBe(false);
  });

  it('folds the same way on both sides', () => {
    expect(foldText('  A “B”—c… ')).toBe('a "b"-c...');
  });
});

describe('email addresses (AC-5.3)', () => {
  it('reads plain addresses, and addresses in a link', () => {
    expect(findEmails('Email jobs@quillstack.example or see mailto:Ana@QuillStack.example.')).toEqual([
      'jobs@quillstack.example',
      'ana@quillstack.example',
    ]);
  });

  it('reads addresses written with a bracketed "at" to dodge spam robots', () => {
    expect(findEmails('Write to ana [at] quillstack [dot] example')).toEqual(['ana@quillstack.example']);
    expect(findEmails('Write to ana (at) quillstack.example')).toEqual(['ana@quillstack.example']);
    expect(findEmails('jobs (at) acme.example.')).toEqual(['jobs@acme.example']);
    expect(findEmails('jane.doe [at] gmail [dot] example')).toEqual(['jane.doe@gmail.example']);
    expect(findEmails('jane [ at ] acme [ dot ] example')).toEqual(['jane@acme.example']);
  });

  it('keeps a spelled-out dot in the name, instead of starting halfway through it', () => {
    expect(findEmails('jane [dot] doe [at] gmail [dot] example')).toEqual(['jane.doe@gmail.example']);
    expect(findEmails('jane dot doe [at] gmail dot example')).toEqual(['jane.doe@gmail.example']);
  });

  it('never reads a bare "at" as "@", which would invent addresses', () => {
    expect(findEmails('Write to ana at quillstack dot example')).toEqual([]);
    expect(findEmails('Apply at acme dot example')).toEqual([]);
    expect(findEmails('Find us at quillstack dot example')).toEqual([]);
    expect(findEmails('Email me at jane dot doe at gmail dot example')).toEqual([]);
    expect(findEmails('jane at acme dot co dot uk')).toEqual([]);
  });

  it('does not turn ordinary English into an address', () => {
    expect(findEmails('We are located at quillstack.example, and we meet at noon.')).toEqual([]);
    expect(findEmails('Find us at quillstack dot example or write to hi [at] quillstack [dot] example')).toEqual([
      'hi@quillstack.example',
    ]);
  });

  it('refuses anything that could carry a subject or body', () => {
    expect(isPlainEmail('ana@quillstack.example')).toBe(true);
    expect(isPlainEmail('ana@quillstack.example?subject=hi')).toBe(false);
    expect(isPlainEmail('ana@quillstack.example&body=hi')).toBe(false);
    expect(isPlainEmail('ana@localhost')).toBe(false);
  });
});

describe('links', () => {
  it('allows only web addresses', () => {
    expect(isWebUrl('https://quillstack.example/jobs')).toBe(true);
    expect(isWebUrl('javascript:alert(1)')).toBe(false);
    expect(isWebUrl('mailto:ana@quillstack.example')).toBe(false);
  });

  it('finds the first web address and drops sentence punctuation', () => {
    expect(firstWebUrl('See (https://quillstack.example/jobs). Thanks')).toBe('https://quillstack.example/jobs');
    expect(firstWebUrl('No links here')).toBeNull();
  });
});
