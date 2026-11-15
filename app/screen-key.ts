// When another tab's data is read in, each screen gets a new key, so its forms
// start over with the new data (state.tsx, `reloads`). A screen with unsaved
// changes keeps its key, and so its draft, until it has none.

/** The key a screen should have now. */
export function screenKey(unsaved: boolean, reloads: number, current: number): number {
  return unsaved ? current : reloads;
}
