import { describe, expect, it } from 'vitest';
import { emptyData, withDefaults } from './data';
import { anySourceOn, huntSources, isSourceSwitches } from './sources';

const settings = (community: boolean) => ({ ...emptyData().settings, sources: { community } });

describe('sources (FR-10.3)', () => {
  it('are on by default', () => {
    expect(emptyData().settings.sources).toEqual({ community: true });
  });

  it('keep funding news off whatever the switches say, until a page reader returns links', () => {
    expect(huntSources(settings(true))).toEqual({ funding: false, community: true });
    expect(huntSources(settings(false))).toEqual({ funding: false, community: false });
  });

  it('say when every source is off, so a hunt would search nothing', () => {
    expect(anySourceOn(settings(true))).toBe(true);
    expect(anySourceOn(settings(false))).toBe(false);
  });

  it('take only a real true or false', () => {
    expect(isSourceSwitches({ community: false })).toBe(true);
    for (const bad of [null, 'on', {}, { community: 'false' }, { community: 1 }]) expect(isSourceSwitches(bad)).toBe(false);
  });

  it('fall back to the defaults when saved data holds something else', () => {
    const saved = (sources: unknown) =>
      withDefaults({ ...emptyData(), settings: { ...emptyData().settings, sources: sources as { community: boolean } } }).settings.sources;
    expect(saved({ community: false })).toEqual({ community: false });
    expect(saved({ community: 'no', extra: true })).toEqual({ community: true });
    expect(saved(undefined)).toEqual({ community: true });
  });
});
