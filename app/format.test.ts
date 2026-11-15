import { describe, expect, it } from 'vitest';
import { roleText } from './format';
import { strings } from './strings';

describe('the role, in words (AC-6.2)', () => {
  it('shows the role when there is one', () => {
    expect(roleText({ type: 'post', role: 'Design Engineer', signals: [] })).toBe('Design Engineer');
  });

  it('says "unknown" when a hiring post has no role we could confirm', () => {
    expect(roleText({ type: 'post', role: '', signals: [] })).toBe(strings.unknown);
  });

  it('says "No open role listed" only for a funding lead that lists none', () => {
    expect(roleText({ type: 'funding', role: '', signals: ['no-open-role'] })).toBe('No open role listed');
    expect(roleText({ type: 'funding', role: '', signals: [] })).toBe(strings.unknown);
  });
});
