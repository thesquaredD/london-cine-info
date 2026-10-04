import type { DataMeta, Film } from "../shared/data";
import { selectFilms, type ViewState } from "./catalogue";
import { addDays, dayMatches, filterFilms, londonDate } from "./filters";
export type Suggestion = { label: string; count: number; changes: Partial<ViewState> };
export function recoverySuggestions(
  films: Film[],
  meta: DataMeta,
  state: ViewState,
  now = new Date(),
  evaluate?: (state: ViewState) => Film[],
): Suggestion[] {
  const candidates: { label: string; changes: Partial<ViewState> }[] = [];
  if (state.short)
    candidates.push({ label: "Remove the runtime limit", changes: { short: false, page: 1 } });
  if (state.available)
    candidates.push({
      label: "Include sold-out screenings",
      changes: { available: false, page: 1 },
    });
  if (state.filters.day?.length || state.excluded.day?.length || state.tonight) {
    const tomorrow = addDays(londonDate(now), 1);
    candidates.push({
      label: state.tonight ? "Try tomorrow instead of Tonight" : "Include tomorrow",
      changes: {
        filters: {
          ...state.filters,
          day: [...new Set([...(state.filters.day ?? []), "tomorrow"])],
        },
        excluded: {
          ...state.excluded,
          day: (state.excluded.day ?? []).filter(
            (id) => !dayMatches(tomorrow, [id], londonDate(now)),
          ),
        },
        ...(state.tonight
          ? {
              tonight: false,
              from: "",
              to: "",
              filters: { ...state.filters, day: ["tomorrow"], time: [] },
              excluded: { ...state.excluded, day: [], time: [] },
            }
          : {}),
        page: 1,
      },
    });
  }
  for (const [key, label] of [
    ["venue", "cinema"],
    ["format", "format"],
    ["accessibility", "accessibility"],
  ] as const)
    if (state.filters[key]?.length || state.excluded[key]?.length)
      candidates.push({
        label: `Remove ${label} choices`,
        changes: {
          filters: { ...state.filters, [key]: [] },
          excluded: { ...state.excluded, [key]: [] },
          page: 1,
        },
      });
  return candidates
    .map(({ label, changes }) => {
      const next = { ...state, ...changes };
      const matches = evaluate
        ? evaluate(next)
        : filterFilms(selectFilms(films, next), meta, next, now);
      return { label, changes, count: new Set(matches.map((film) => film.id)).size };
    })
    .filter((suggestion) => suggestion.count > 0)
    .slice(0, 3);
}
