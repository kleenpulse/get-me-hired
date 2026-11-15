// The Hacker News "Who is hiring?" thread (FR-4.7), read straight from HN's
// own search API at hn.algolia.com. No AI and no search provider are needed,
// and it is free (FRD §19, finding 3). `fetch` is passed in (NFR-12).

const API = 'https://hn.algolia.com/api/v1';

export interface HnComment {
  id: string;
  /** The comment as plain text, with link targets kept: job posts put addresses in them. */
  text: string;
  /** UTC date-time the comment was posted. */
  postedAt: string;
  /** The poster's Hacker News username. */
  author: string;
}

export interface HnThread {
  id: string;
  title: string;
  comments: HnComment[];
}

/** The page of one opening. FR-4.21 wants the exact comment, not the thread. */
export function commentUrl(id: string): string {
  return `https://news.ycombinator.com/item?id=${encodeURIComponent(id)}`;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name.startsWith('#x') || name.startsWith('#X')) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith('#')) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/**
 * HN comment HTML as plain text. HN allows only a few tags: <p>, <a>, <i>,
 * <pre> and <code>. Paragraphs become new lines, a link becomes its address,
 * and every other tag is dropped. The result is data for the model, never markup.
 */
export function htmlToText(html: string): string {
  const withLinks = html.replace(/<a\s[^>]*href="([^"]*)"[^>]*>[\s\S]*?<\/a>/gi, (_whole, href: string) => ` ${decodeEntities(href)} `);
  const withBreaks = withLinks.replace(/<p\b[^>]*>/gi, '\n').replace(/<br\s*\/?>/gi, '\n');
  const bare = withBreaks.replace(/<[^>]*>/g, '');
  return decodeEntities(bare)
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface SearchAnswer {
  hits: { objectID: string; title: string }[];
}

interface ItemAnswer {
  children?: { id: number; text: string | null; created_at: string; author: string | null }[];
}

async function getJson<T>(fetcher: typeof fetch, url: string, signal: AbortSignal): Promise<T> {
  const response = await fetcher(url, { signal });
  if (!response.ok) throw new Error(`Hacker News answered ${response.status}`);
  return (await response.json()) as T;
}

/** The newest "Ask HN: Who is hiring?" thread and its top-level comments, one per opening. */
export async function loadHiringThread(fetcher: typeof fetch, signal: AbortSignal): Promise<HnThread> {
  const search = await getJson<SearchAnswer>(
    fetcher,
    `${API}/search_by_date?tags=story,author_whoishiring&hitsPerPage=10`,
    signal,
  );
  const thread = search.hits.find((hit) => hit.title.startsWith('Ask HN: Who is hiring?'));
  if (!thread) throw new Error('No "Who is hiring?" thread was found');
  // The id goes into a URL, so it must be the number HN uses and nothing else.
  if (!/^\d+$/.test(thread.objectID)) throw new Error('The thread id was not a number');

  const item = await getJson<ItemAnswer>(fetcher, `${API}/items/${thread.objectID}`, signal);
  const comments = (item.children ?? [])
    .filter((child) => child.text && Number.isSafeInteger(child.id))
    .map((child) => ({
      id: String(child.id),
      text: htmlToText(child.text ?? ''),
      postedAt: child.created_at,
      author: child.author ?? '',
    }));
  return { id: thread.objectID, title: thread.title, comments };
}

/** Words longer than 2 letters from the profile's roles and skills, for a first pass with no AI. */
export function profileWords(items: readonly string[]): string[] {
  const words = items
    .flatMap((item) => item.toLowerCase().split(/[^a-z0-9+#.]+/))
    .map((word) => word.replace(/^\.+|\.+$/g, ''))
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  return [...new Set(words)];
}

// Words that appear in almost every job post, so they say nothing about fit.
const STOP_WORDS = new Set(['engineer', 'engineering', 'developer', 'senior', 'junior', 'lead', 'the', 'and', 'with', 'for']);

function escape(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The comments worth sending to the model, best first: each must name at least
 * one profile word, and must mention remote work when the user wants remote
 * only. This saves calls, and it is the same first pass the spike measured.
 */
export function shortlist(comments: readonly HnComment[], words: readonly string[], remoteOnly: boolean, limit: number): HnComment[] {
  if (words.length === 0) return [];
  const pattern = new RegExp(`(?<![a-z0-9])(?:${words.map(escape).join('|')})(?![a-z0-9])`, 'gi');
  return comments
    .filter((comment) => !remoteOnly || /\bremote\b/i.test(comment.text))
    .map((comment) => ({ comment, score: comment.text.match(pattern)?.length ?? 0 }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.comment);
}
