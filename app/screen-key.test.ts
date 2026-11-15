import { describe, expect, it } from 'vitest';
import { screenKey } from './screen-key';

describe('the key of a screen when another tab saves', () => {
  it('moves to the newest read, so the form starts over with the new data', () => {
    expect(screenKey(false, 3, 2)).toBe(3);
  });

  it('stays while the screen has unsaved changes, so the draft is kept', () => {
    expect(screenKey(true, 3, 2)).toBe(2);
    expect(screenKey(true, 5, 2)).toBe(2);
  });

  it('catches up once the changes are saved or thrown away', () => {
    expect(screenKey(false, 5, 2)).toBe(5);
  });
});
