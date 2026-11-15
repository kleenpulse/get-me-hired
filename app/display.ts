// Theme and text size (FR-10.5). The saved settings in IndexedDB are the source
// of truth, but they load after the first paint. So a copy of these two values,
// and nothing else, is also kept in localStorage, read before the app draws,
// to avoid a flash of the wrong theme or size. Never put anything else here,
// least of all a key.

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export const TEXT_SIZES = ['normal', 'large', 'larger'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export interface Display {
  theme: Theme;
  textSize: TextSize;
}

export const DEFAULT_DISPLAY: Display = { theme: 'system', textSize: 'normal' };

/** DESIGN.md: the root is 100%, 112.5% or 125%. Sizes are in rem, so everything grows. */
const SCALE: Record<TextSize, string> = { normal: '100%', large: '112.5%', larger: '125%' };

const COPY_KEY = 'get-me-hired:display';

function isDisplay(value: unknown): value is Display {
  if (typeof value !== 'object' || value === null) return false;
  const { theme, textSize } = value as Record<string, unknown>;
  return (THEMES as readonly unknown[]).includes(theme) && (TEXT_SIZES as readonly unknown[]).includes(textSize);
}

/** The copy, or the defaults when there is none or it can't be read (private windows can refuse storage). */
export function readDisplayCopy(): Display {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(COPY_KEY) ?? 'null');
    return isDisplay(parsed) ? parsed : DEFAULT_DISPLAY;
  } catch {
    return DEFAULT_DISPLAY;
  }
}

export function writeDisplayCopy(display: Display): void {
  try {
    localStorage.setItem(COPY_KEY, JSON.stringify({ theme: display.theme, textSize: display.textSize }));
  } catch {
    // Storage refused: the app still works, and the next load may briefly use the defaults.
  }
}

export function clearDisplayCopy(): void {
  try {
    localStorage.removeItem(COPY_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * Applies the theme and text size to the page. `data-theme` is absent for
 * "system" (tokens.css follows the system then). The size is a CSS custom
 * property set through the CSSOM, which the CSP allows (no inline style text).
 */
export function applyDisplay(display: Display): void {
  const root = document.documentElement;
  if (display.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = display.theme;
  root.style.setProperty('--text-scale', SCALE[display.textSize]);
}

export { isDisplay };
