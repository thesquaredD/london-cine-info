import {
  defaultSort,
  nextSort,
  readView,
  type SortKey,
  type ViewState,
} from "@readograph/core/catalogue";
import { SITE_ORIGIN } from "@readograph/core/site";

/**
 * One `ViewState` per list screen, held in memory (no URL state in the app). The Filters sheet
 * of PR 5 writes to the same store, so the list behind it updates while the sheet is open.
 */

/** The collections the Films screen switches between, in the website's order. */
export const COLLECTIONS = [
  { path: "/", name: "All movies" },
  { path: "/new", name: "New releases" },
  { path: "/classics", name: "Classics" },
  { path: "/retrospectives", name: "Retrospectives" },
  { path: "/calendar", name: "Release calendar" },
] as const;

/** The sort choices offered on the Films screen, as the website's phone sort menu offers them. */
export const SORT_KEYS: SortKey[] = [
  "lb",
  "im",
  "mc",
  "rt",
  "title",
  "director",
  "year",
  "runtime",
];

/** The state of a fresh visit to `path` on the website. */
export function initialView(path = "/"): ViewState {
  return readView(new URL(path, SITE_ORIGIN));
}

const same = (a: string[] | undefined, b: string[] | undefined) =>
  (a ?? []).join("\n") === (b ?? []).join("\n");

/** What a change implies on top of itself, by the website's rules. */
export function impliedChanges(state: ViewState, changes: Partial<ViewState>): Partial<ViewState> {
  const touched = (key: "venue" | "day" | "time") =>
    (changes.filters && !same(changes.filters[key], state.filters[key])) ||
    (changes.excluded && !same(changes.excluded[key], state.excluded[key]));
  return {
    ...(state.myCinemas && !("myCinemas" in changes) && touched("venue")
      ? { myCinemas: false }
      : {}),
    ...(state.tonight && !("tonight" in changes) && (touched("day") || touched("time"))
      ? { tonight: false, from: "", to: "" }
      : {}),
  };
}

export type ViewStore = ReturnType<typeof createViewStore>;

export function createViewStore(initial: ViewState = initialView()) {
  let state = initial;
  const listeners = new Set<() => void>();
  const set = (next: ViewState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /**
     * Applies changes with the website's two rules (app.tsx `change`): a new cinema choice turns
     * My cinemas off, and a new day or time choice turns Tonight off, unless the change itself
     * sets them.
     */
    update(changes: Partial<ViewState>) {
      set({ ...state, ...impliedChanges(state, changes), ...changes });
    },
    /** A new collection keeps the search and filters and takes that collection's default sort. */
    setCollection(path: string) {
      if (path === state.path) return;
      set({ ...state, path, ...defaultSort(path), sortExplicit: undefined, page: 1 });
    },
    setSearch(search: string) {
      set({ ...state, search, page: 1 });
    },
    /** Choosing the current key flips its direction, then returns to the default, as on the web. */
    sortBy(key: SortKey) {
      set({ ...state, ...nextSort(state, key), page: 1 });
    },
  };
}
