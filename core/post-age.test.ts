import { describe, expect, it } from 'vitest';
import { checkPostAge, decodePostTime, FRESH_MAX_HOURS } from './post-age';

const HOUR_MS = 3_600_000;
const X_EPOCH_MS = 1288834974657n;

// Invented IDs built from a chosen time, so no fixture points at a real post.
const linkedinId = (ms: number) => (BigInt(ms) << 22n).toString();
const xId = (ms: number) => ((BigInt(ms) - X_EPOCH_MS) << 22n).toString();

const POSTED = Date.UTC(2026, 10, 14, 6, 0, 0);
const POSTED_ISO = '2026-11-14T06:00:00.000Z';

describe('decodePostTime', () => {
  it('decodes the X fixture from AC-4.4', () => {
    const decoded = decodePostTime('x.com/elonmusk/status/1585841080431321088');
    expect(decoded).toEqual({
      platform: 'x',
      id: '1585841080431321088',
      postedAtMs: Date.parse('2022-10-28T03:49:11.734Z'),
    });
  });

  it.each([
    ['activity-<id>', (id: string) => `https://www.linkedin.com/posts/ada-example_were-hiring-activity-${id}-aBcD`],
    ['ugcPost-<id>', (id: string) => `https://www.linkedin.com/posts/ada-example_hiring-ugcPost-${id}-xYz1`],
    ['share-<id>', (id: string) => `https://www.linkedin.com/posts/ada-example_hiring-share-${id}-q2Rs`],
    ['urn:li:activity:<id>', (id: string) => `https://www.linkedin.com/feed/update/urn:li:activity:${id}/`],
    ['urn:li:ugcPost:<id>', (id: string) => `https://www.linkedin.com/feed/update/urn:li:ugcPost:${id}`],
    ['urn:li:share:<id>', (id: string) => `https://www.linkedin.com/feed/update/urn:li:share:${id}`],
    ['percent-encoded urn', (id: string) => `https://www.linkedin.com/feed/update/urn%3Ali%3Aactivity%3A${id}`],
    ['no scheme', (id: string) => `linkedin.com/feed/update/urn:li:activity:${id}`],
    ['query string after', (id: string) => `https://www.linkedin.com/posts/ada-example_x-activity-${id}-aBcD?utm_source=share`],
  ])('decodes a LinkedIn URL with %s', (_label, build) => {
    const id = linkedinId(POSTED);
    expect(decodePostTime(build(id))).toEqual({ platform: 'linkedin', id, postedAtMs: POSTED });
  });

  it.each([
    ['x.com', (id: string) => `https://x.com/ada_example/status/${id}`],
    ['twitter.com', (id: string) => `https://twitter.com/ada_example/status/${id}`],
    ['mobile.twitter.com', (id: string) => `https://mobile.twitter.com/ada_example/status/${id}`],
    ['statuses', (id: string) => `https://twitter.com/ada_example/statuses/${id}`],
    ['i/web/status', (id: string) => `https://x.com/i/web/status/${id}`],
    ['query string after', (id: string) => `https://x.com/ada_example/status/${id}?s=20`],
    ['upper case', (id: string) => `HTTPS://X.COM/Ada_Example/Status/${id}`],
  ])('decodes an X URL on %s', (_label, build) => {
    const id = xId(POSTED);
    expect(decodePostTime(build(id))).toEqual({ platform: 'x', id, postedAtMs: POSTED });
  });

  it('keeps millisecond precision for IDs beyond the safe integer range', () => {
    const ms = POSTED + 734;
    const id = (BigInt(linkedinId(ms)) + 4_194_303n).toString(); // every low bit set
    expect(decodePostTime(`https://www.linkedin.com/feed/update/urn:li:activity:${id}`)?.postedAtMs).toBe(ms);
  });

  it('reads the whole ID when it starts with a 3', () => {
    // 19 digits starting with 3. The skill's `[:\-%3A]+` class would eat the leading 3.
    const id = '3000000000000000000';
    expect(decodePostTime(`https://www.linkedin.com/feed/update/urn:li:activity:${id}`)?.id).toBe(id);
  });

  it.each([
    ['a company page', 'https://www.linkedin.com/company/northpeak-example/'],
    ['a profile', 'https://www.linkedin.com/in/ada-example/'],
    ['a job listing', 'https://www.linkedin.com/jobs/view/4012345678'],
    ['an X profile', 'https://x.com/ada_example'],
    ['a short ID', 'https://x.com/ada_example/status/12345'],
    ['another site', 'https://news.ycombinator.com/item?id=99000001'],
    ['a host that only ends in x.com', `https://netflix.com/ada/status/${xId(POSTED)}`],
    ['a host that only ends in linkedin.com', `https://notlinkedin.com/posts/a-activity-${linkedinId(POSTED)}-aBcD`],
    ['an empty string', ''],
  ])('returns null for %s', (_label, url) => {
    expect(decodePostTime(url)).toBeNull();
  });
});

describe('checkPostAge', () => {
  const url = `https://www.linkedin.com/posts/ada-example_were-hiring-activity-${linkedinId(POSTED)}-aBcD`;

  it('reports a fresh post with its age', () => {
    expect(checkPostAge(url, POSTED + 18_720_000)).toEqual({
      status: 'fresh',
      platform: 'linkedin',
      id: linkedinId(POSTED),
      postedAt: POSTED_ISO,
      ageHours: 5.2,
    });
  });

  it('counts exactly 24.0 hours as fresh', () => {
    expect(checkPostAge(url, POSTED + FRESH_MAX_HOURS * HOUR_MS).status).toBe('fresh');
  });

  it('drops a post one millisecond over 24 hours', () => {
    expect(checkPostAge(url, POSTED + FRESH_MAX_HOURS * HOUR_MS + 1).status).toBe('stale');
  });

  it('drops a post that would round down to 24.0 hours', () => {
    const result = checkPostAge(url, POSTED + 24.04 * HOUR_MS);
    expect(result.status).toBe('stale');
  });

  it('reports the AC-4.4 X fixture as stale today', () => {
    const result = checkPostAge('x.com/elonmusk/status/1585841080431321088', Date.UTC(2026, 10, 14));
    expect(result).toMatchObject({ status: 'stale', platform: 'x', postedAt: '2022-10-28T03:49:11.734Z' });
  });

  it('allows a minute of clock skew', () => {
    expect(checkPostAge(url, POSTED - 30_000).status).toBe('fresh');
  });

  it('never calls a post from the future fresh', () => {
    expect(checkPostAge(url, POSTED - 2 * HOUR_MS).status).toBe('implausible');
  });

  it('never calls a post from before 2010 fresh or stale', () => {
    const old = `https://www.linkedin.com/feed/update/urn:li:activity:${linkedinId(Date.UTC(2005, 0, 1))}`;
    expect(checkPostAge(old, POSTED).status).toBe('implausible');
  });

  it('treats the largest 20-digit ID as implausible', () => {
    const huge = 'https://www.linkedin.com/feed/update/urn:li:activity:99999999999999999999';
    expect(checkPostAge(huge, POSTED)).toMatchObject({ status: 'implausible' });
  });

  it('returns unknown when the URL has no post ID', () => {
    expect(checkPostAge('https://northpeak.example/careers', POSTED)).toEqual({ status: 'unknown' });
  });
});
