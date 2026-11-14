// The lead key: how the app tells whether two leads are the same one (FRD §11.2).
// It is used only for comparing. The original URL is always stored unchanged.

/**
 * Query parameters that identify the item, by host. Every other query
 * parameter is tracking noise and is dropped.
 */
const IDENTIFYING_PARAMS: Readonly<Record<string, readonly string[]>> = {
  'news.ycombinator.com': ['id'],
};

/** Hosts that serve the same pages under another name. X posts still circulate as twitter.com links. */
const HOST_ALIASES: Readonly<Record<string, string>> = {
  'twitter.com': 'x.com',
  'mobile.twitter.com': 'x.com',
  'mobile.x.com': 'x.com',
};

/**
 * Normalises a URL for comparing: lowercases the scheme and host, drops
 * `www.`, the fragment, any trailing slash, and the query unless it names the
 * item (Hacker News `?id=`). `twitter.com` counts as `x.com`. Text that isn't an absolute web URL comes back trimmed.
 */
export function normaliseUrl(url: string): string {
  const trimmed = url.trim();
  if (!URL.canParse(trimmed)) return trimmed;

  const parsed = new URL(trimmed);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return trimmed;
  const bare = parsed.host.replace(/^www\./, '');
  const host = HOST_ALIASES[bare] ?? bare;
  const path = parsed.pathname.replace(/\/+$/, '');

  const kept = new URLSearchParams();
  for (const name of IDENTIFYING_PARAMS[host] ?? []) {
    const value = parsed.searchParams.get(name);
    if (value !== null) kept.set(name, value);
  }
  const query = kept.size > 0 ? `?${kept}` : '';

  return `${parsed.protocol}//${host}${path}${query}`;
}

/** Normalises a company name for comparing: trimmed, single spaces, lowercase. */
function normaliseCompany(company: string): string {
  return company.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * The lead key: the normalised source URL, `|`, and the lowercased company
 * name. Two openings in one community thread get different keys because the
 * company differs, which keeps files from older skill versions loadable.
 */
export function leadKey(sourceUrl: string, company: string): string {
  return `${normaliseUrl(sourceUrl)}|${normaliseCompany(company)}`;
}
