import { describe, expect, it } from 'vitest';
import { leadKey, normaliseUrl } from './lead-key';

describe('normaliseUrl', () => {
  it.each([
    ['lowercases the scheme and host', 'HTTPS://NorthPeak.Example/Careers', 'https://northpeak.example/Careers'],
    ['drops www.', 'https://www.northpeak.example/careers', 'https://northpeak.example/careers'],
    ['drops the fragment', 'https://northpeak.example/careers#design', 'https://northpeak.example/careers'],
    ['drops a tracking query', 'https://northpeak.example/careers?utm_source=x&ref=y', 'https://northpeak.example/careers'],
    ['drops a trailing slash', 'https://northpeak.example/careers/', 'https://northpeak.example/careers'],
    ['drops the slash of a bare host', 'https://northpeak.example/', 'https://northpeak.example'],
    ['drops repeated trailing slashes', 'https://northpeak.example/careers//', 'https://northpeak.example/careers'],
    ['trims spaces around the URL', '  https://northpeak.example/careers \n', 'https://northpeak.example/careers'],
    [
      'keeps the case of the path',
      'https://x.com/Ada_Example/status/2120811336299446272?s=20',
      'https://x.com/Ada_Example/status/2120811336299446272',
    ],
    ['keeps a port', 'https://northpeak.example:8443/jobs/', 'https://northpeak.example:8443/jobs'],
    ['keeps http apart from https', 'http://northpeak.example/careers', 'http://northpeak.example/careers'],
    ['does everything at once', 'HTTPS://WWW.NorthPeak.Example/Jobs/?utm_source=x#top', 'https://northpeak.example/Jobs'],
  ])('%s', (_label, input, expected) => {
    expect(normaliseUrl(input)).toBe(expected);
  });

  it.each([
    ['twitter.com', 'https://twitter.com/Ada_Example/status/2120811336299446272'],
    ['www.twitter.com', 'https://www.twitter.com/Ada_Example/status/2120811336299446272?s=20'],
    ['mobile.twitter.com', 'https://mobile.twitter.com/Ada_Example/status/2120811336299446272'],
    ['mobile.x.com', 'https://mobile.x.com/Ada_Example/status/2120811336299446272/'],
  ])('treats %s as x.com', (_label, input) => {
    expect(normaliseUrl(input)).toBe('https://x.com/Ada_Example/status/2120811336299446272');
  });

  it('does not rename hosts that only end in twitter.com', () => {
    expect(normaliseUrl('https://nottwitter.com/a')).toBe('https://nottwitter.com/a');
  });

  it('keeps the Hacker News item id, and only that', () => {
    expect(normaliseUrl('https://news.ycombinator.com/item?id=99000001')).toBe(
      'https://news.ycombinator.com/item?id=99000001',
    );
    expect(normaliseUrl('https://news.ycombinator.com/item?p=2&id=99000001&utm_source=x#99000002')).toBe(
      'https://news.ycombinator.com/item?id=99000001',
    );
  });

  it('tells two Hacker News comments apart', () => {
    expect(normaliseUrl('https://news.ycombinator.com/item?id=99000001')).not.toBe(
      normaliseUrl('https://news.ycombinator.com/item?id=99000002'),
    );
  });

  it('does not keep an id parameter on other hosts', () => {
    expect(normaliseUrl('https://northpeak.example/item?id=7')).toBe('https://northpeak.example/item');
  });

  it('returns text that is not a web URL trimmed and otherwise unchanged', () => {
    expect(normaliseUrl('  not a url ')).toBe('not a url');
    expect(normaliseUrl('northpeak.example/careers')).toBe('northpeak.example/careers');
    expect(normaliseUrl('mailto:ada@northpeak.example')).toBe('mailto:ada@northpeak.example');
    expect(normaliseUrl('')).toBe('');
  });

  it('gives the same result when run twice', () => {
    const once = normaliseUrl('HTTPS://WWW.News.YCombinator.com/item/?id=99000001&x=1#c');
    expect(normaliseUrl(once)).toBe(once);
  });
});

describe('leadKey', () => {
  it('joins the normalised URL and the lowercased company with a pipe', () => {
    expect(leadKey('https://www.NorthPeak.example/careers/?ref=x#top', 'Northpeak Labs')).toBe(
      'https://northpeak.example/careers|northpeak labs',
    );
  });

  it('gives one key to the same lead written different ways (AC-6.8)', () => {
    const key = leadKey('https://northpeak.example/careers', 'Northpeak Labs');
    expect(leadKey('https://www.northpeak.example/careers/', 'NORTHPEAK LABS')).toBe(key);
    expect(leadKey('HTTPS://northpeak.example/careers?utm_campaign=hiring', '  Northpeak   Labs ')).toBe(key);
    expect(leadKey('https://northpeak.example/careers#apply', 'northpeak labs')).toBe(key);
  });

  it('gives different keys to two companies in one thread', () => {
    const thread = 'https://news.ycombinator.com/item?id=99000000';
    expect(leadKey(thread, 'Harbor Grid')).not.toBe(leadKey(thread, 'Kestrel Works'));
  });

  it('gives different keys to one company with two source URLs', () => {
    expect(leadKey('https://news.ycombinator.com/item?id=99000001', 'Harbor Grid')).not.toBe(
      leadKey('https://news.ycombinator.com/item?id=99000002', 'Harbor Grid'),
    );
  });

  it('leaves its inputs unchanged', () => {
    const url = 'https://WWW.northpeak.example/Careers/?a=1#b';
    leadKey(url, 'Northpeak Labs');
    expect(url).toBe('https://WWW.northpeak.example/Careers/?a=1#b');
  });
});
