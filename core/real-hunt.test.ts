import { describe, expect, it } from 'vitest';
import { emptyProfile } from './profile';
import { createRealHunt } from './real-hunt';

describe('a real hunt that cannot start', () => {
  it('marks every step it could not run as failed, so none is left waiting', async () => {
    const calls: string[] = [];
    const fetcher = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      throw new TypeError('should not be called');
    }) as typeof fetch;
    // Anthropic is not offered yet, so its model can't be loaded.
    const result = await createRealHunt({
      provider: 'anthropic',
      key: 'test-key-not-real-0000',
      profile: emptyProfile(),
      fetch: fetcher,
      knownKeys: new Set(),
    })({ now: new Date('2026-11-15T12:00:00Z'), signal: new AbortController().signal, onProgress: () => {} });

    expect(result.status).toBe('failed');
    expect(result.problem).toBe('unknown');
    expect(result.steps.map((step) => [step.id, step.state])).toEqual([
      ['posts', 'skipped'],
      ['freshness', 'skipped'],
      ['funding', 'failed'],
      ['community', 'failed'],
      ['contacts', 'failed'],
    ]);
    expect(calls).toEqual([]);
  });

  it('shows a switched-off stage as off, not as failed', async () => {
    const fetcher = (async () => {
      throw new TypeError('should not be called');
    }) as typeof fetch;
    const result = await createRealHunt({
      provider: 'anthropic',
      key: 'test-key-not-real-0000',
      profile: emptyProfile(),
      fetch: fetcher,
      knownKeys: new Set(),
      sources: { funding: false },
    })({ now: new Date('2026-11-15T12:00:00Z'), signal: new AbortController().signal, onProgress: () => {} });

    expect(result.steps.map((step) => [step.id, step.state, step.skipReason ?? null])).toEqual([
      ['posts', 'skipped', 'needs-search'],
      ['freshness', 'skipped', 'needs-search'],
      ['funding', 'skipped', 'switched-off'],
      ['community', 'failed', null],
      ['contacts', 'failed', null],
    ]);
  });
});
