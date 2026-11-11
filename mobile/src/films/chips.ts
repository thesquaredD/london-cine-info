import { clearFilters, activeFacetChoices } from "@readograph/core/filters";
import { hasYears, normalizeYears } from "@readograph/core/years";
import type { ViewState } from "@readograph/core/catalogue";
import type { DataMeta, FacetKey } from "@readograph/core/data";

/**
 * The active-filter chips under the search field (mock-up 1: "Today ×" per filter, then
 * "Clear all") and the Filters button's count badge, as pure functions of the `ViewState`.
 */

export type FilterChip = {
  /** Stable React key. */
  key: string;
  /** "Today", "Not IMAX", "Under 2 hours". */
  label: string;
  /** Applying these removes this one filter and nothing else. */
  changes: Partial<ViewState>;
};

const FACETS: FacetKey[] = [
  "day",
  "time",
  "venue",
  "genre",
  "language",
  "borough",
  "format",
  "accessibility",
  "membership",
];

/**
 * The number on the Filters button: the website's `moreCount` (filter-bar.tsx), so the app's
 * badge and the website's agree for the same state.
 */
export function activeFilterCount(state: ViewState): number {
  const picks = FACETS.reduce(
    (n, key) => n + (state.filters[key]?.length ?? 0) + (state.excluded[key]?.length ?? 0),
    0,
  );
  return (
    picks +
    (state.years?.length ?? 0) +
    (state.decades?.length ?? 0) +
    Number(!!(state.from || state.to)) +
    Number(!!state.independent) +
    Number(!!state.short) +
    Number(!!state.available) +
    Number(!!state.watchlist)
  );
}

const without = (values: string[] | undefined, id: string) =>
  (values ?? []).filter((value) => value !== id);

/**
 * One chip per active choice, in the Filters sheet's order. My cinemas stands for its venue
 * choices as one chip, as on the website. The search text is not a chip: it is in the field.
 */
export function filterChips(state: ViewState, meta: DataMeta, directorName?: string): FilterChip[] {
  const chips: FilterChip[] = [];
  if (state.tonight)
    chips.push({
      key: "tonight",
      label: "Tonight",
      changes: {
        tonight: false,
        from: "",
        to: "",
        filters: { ...state.filters, day: [], time: [] },
        excluded: { ...state.excluded, day: [], time: [] },
      },
    });
  if (state.myCinemas)
    chips.push({
      key: "my-cinemas",
      label: "My cinemas",
      changes: {
        myCinemas: false,
        filters: { ...state.filters, venue: [] },
        excluded: { ...state.excluded, venue: [] },
      },
    });
  for (const choice of activeFacetChoices(state, meta)) {
    // Tonight already stands for its day and time; My cinemas for its venues.
    if (state.tonight && (choice.key === "day" || choice.key === "time")) continue;
    if (state.myCinemas && choice.key === "venue" && !choice.excluded) continue;
    const list = choice.excluded ? "excluded" : "filters";
    chips.push({
      key: `${choice.key}:${choice.excluded ? "not:" : ""}${choice.id}`,
      label: choice.excluded ? `Not ${choice.label}` : choice.label,
      changes: {
        [list]: { ...state[list], [choice.key]: without(state[list][choice.key], choice.id) },
      },
    });
  }
  if ((state.from || state.to) && !state.tonight)
    chips.push({
      key: "time-range",
      label: `Starts ${state.from || "00:00"}–${state.to || "23:59"}`,
      changes: { from: "", to: "" },
    });
  if (state.independent)
    chips.push({ key: "independent", label: "Independent", changes: { independent: false } });
  if (hasYears(state)) {
    const years = normalizeYears(state);
    for (const decade of years.decades)
      chips.push({
        key: `decade:${decade}`,
        label: `${decade}s`,
        changes: { decades: years.decades.filter((value) => value !== decade) },
      });
    for (const year of years.years)
      chips.push({
        key: `year:${year}`,
        label: String(year),
        changes: { years: years.years.filter((value) => value !== year) },
      });
  }
  if (state.director)
    chips.push({
      key: "director",
      label: `Director: ${directorName ?? state.director}`,
      changes: { director: "" },
    });
  if (state.watchlist)
    chips.push({ key: "watchlist", label: "My watchlist", changes: { watchlist: false } });
  if (state.available)
    chips.push({ key: "available", label: "No sold out", changes: { available: false } });
  if (state.short) chips.push({ key: "short", label: "Under 2 hours", changes: { short: false } });
  return chips.map((chip) => ({ ...chip, changes: { ...chip.changes, page: 1 } }));
}

/**
 * "Clear all" under the search field: every filter goes, as the website's Reset all does, but
 * the search text and the chosen sort stay, because neither is shown as a chip.
 */
export function clearAllChanges(state: ViewState): Partial<ViewState> {
  return {
    ...clearFilters(state.path),
    search: state.search,
    sort: state.sort,
    direction: state.direction,
    sortExplicit: state.sortExplicit,
    eventType: state.eventType,
    filmGauge: state.filmGauge,
  };
}
