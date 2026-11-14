// Read when a LinkedIn or X post was published from the ID in its URL (FR-4.4).
// Both platforms put a millisecond timestamp in the top bits of their 64-bit
// post IDs, so this needs no network and no login.
//
// Ported from scripts/post-age.mjs in the get-me-hired agent skill. Keep the
// two in step: a change to the ID rules belongs in both.

const X_EPOCH_MS = 1288834974657n;
const TIMESTAMP_SHIFT = 22n;
const HOUR_MS = 3_600_000;

/** A post older than this many hours is stale (AC-4.4). Exactly 24.0 still counts as fresh. */
export const FRESH_MAX_HOURS = 24;

// Guards against a wrong ID decoding to a nonsense date.
const EARLIEST_PLAUSIBLE_MS = Date.UTC(2010, 0, 1);
const CLOCK_SKEW_MS = 60_000;

// `.../posts/name_slug-activity-<id>-abcd`, `urn:li:activity:<id>`,
// `urn:li:ugcPost:<id>`, `urn:li:share:<id>`, and the same with `%3A` for `:`.
const LINKEDIN_POST = /(?:^|[/.])linkedin\.com\/.*?(?:activity|ugcPost|share)(?::|-|%3A)+(\d{18,20})/i;

// `x.com/<user>/status/<id>`, `twitter.com/<user>/statuses/<id>`, `x.com/i/web/status/<id>`.
const X_POST = /(?:^|[/.])(?:x|twitter)\.com\/(?:[^/]+|i\/web)\/status(?:es)?\/(\d{15,20})/i;

export type PostPlatform = 'linkedin' | 'x';

export interface DecodedPost {
  platform: PostPlatform;
  /** The post ID as written in the URL. Too large for a JavaScript number. */
  id: string;
  /** Publish time in milliseconds since the Unix epoch. */
  postedAtMs: number;
}

/** Returns the publish time held in a LinkedIn or X post URL, or `null` if the URL has no post ID. */
export function decodePostTime(url: string): DecodedPost | null {
  const text = url.trim();

  const linkedin = LINKEDIN_POST.exec(text);
  if (linkedin?.[1]) {
    const id = linkedin[1];
    return { platform: 'linkedin', id, postedAtMs: Number(BigInt(id) >> TIMESTAMP_SHIFT) };
  }

  const x = X_POST.exec(text);
  if (x?.[1]) {
    const id = x[1];
    return { platform: 'x', id, postedAtMs: Number((BigInt(id) >> TIMESTAMP_SHIFT) + X_EPOCH_MS) };
  }

  return null;
}

export type PostAge =
  /** The URL has no LinkedIn or X post ID. The age must come from a date on the page. */
  | { status: 'unknown' }
  /** An ID was found, but it decodes to before 2010 or to the future. Treat the age as unknown. */
  | { status: 'implausible'; platform: PostPlatform; id: string; postedAt: string }
  | {
      status: 'fresh' | 'stale';
      platform: PostPlatform;
      id: string;
      /** ISO 8601 UTC date-time. */
      postedAt: string;
      /** Not rounded. Round only for display, never before comparing with the limit. */
      ageHours: number;
    };

/**
 * Checks a post's age at `nowMs`. Only `fresh` may be shown as a fresh post:
 * `unknown` and `implausible` are not checked ages (FRD §4, principle 2).
 */
export function checkPostAge(url: string, nowMs: number): PostAge {
  const decoded = decodePostTime(url);
  if (!decoded) return { status: 'unknown' };

  const { platform, id, postedAtMs } = decoded;
  const plausible = postedAtMs > EARLIEST_PLAUSIBLE_MS && postedAtMs <= nowMs + CLOCK_SKEW_MS;
  if (!plausible) {
    return { status: 'implausible', platform, id, postedAt: new Date(postedAtMs).toISOString() };
  }

  const ageHours = (nowMs - postedAtMs) / HOUR_MS;
  return {
    status: ageHours <= FRESH_MAX_HOURS ? 'fresh' : 'stale',
    platform,
    id,
    postedAt: new Date(postedAtMs).toISOString(),
    ageHours,
  };
}
