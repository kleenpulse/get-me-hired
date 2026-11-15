import { describe, expect, it } from 'vitest';
import { cleanNotes, NOTES_MAX } from './lead';

describe('notes on a lead (FR-6.7)', () => {
  it('keep line breaks and tabs, and drop other control characters', () => {
    expect(cleanNotes('Called on Monday.\r\nFollow up\tFriday.\rDone')).toBe('Called on Monday.\nFollow up\tFriday.\nDone');
    expect(cleanNotes('bell\u0007 and escape\u001b and null\u0000 gone')).toBe('bell and escape and null gone');
  });

  it('are plain text: markup is kept as typed, to be shown as text', () => {
    expect(cleanNotes('<b>bold</b> **stars**')).toBe('<b>bold</b> **stars**');
  });

  it('trim trailing space and stop at the cap', () => {
    expect(cleanNotes('note   \n\n')).toBe('note');
    expect(cleanNotes('x'.repeat(NOTES_MAX + 50))).toHaveLength(NOTES_MAX);
  });
});
