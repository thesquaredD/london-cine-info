import type { DataMeta, FacetKey } from "@readograph/core/data";
import { DATE_SHORTCUTS, filterLabel } from "@readograph/core/filters";

/**
 * The Filters sheet's option lists and summaries, as pure functions of the catalogue's facets,
 * following the website's FilterPicker (filter-picker.tsx).
 */

export type FacetOption = {
  id: string;
  label: string;
  /** "Westminster" for a cinema, "Inner London" for a borough, "" otherwise. */
  group: string;
  /** Day shortcuts ("Today", "This weekend") have no count of their own on the website. */
  quick?: boolean;
};

/** The options of one facet in the website's order and grouping. */
export function facetOptions(facet: FacetKey, meta: DataMeta): FacetOption[] {
  if (facet === "day")
    return [
      ...DATE_SHORTCUTS.map((id) => ({
        id,
        label: filterLabel("day", id, meta),
        group: "",
        quick: true,
      })),
      ...meta.facets.day.map((option) => ({
        id: option.id,
        label: filterLabel("day", option.id, meta),
        group: "Dates",
      })),
    ];
  const venues = new Map(meta.venues.map((venue) => [venue.id, venue]));
  const boroughs = new Map(meta.boroughs.map((borough) => [borough.id, borough]));
  const options = meta.facets[facet].map((option) => {
    let group = "";
    if (facet === "venue")
      group = boroughs.get(venues.get(option.id)?.borough ?? "")?.name ?? "Other cinemas";
    if (facet === "borough") {
      const region = boroughs.get(option.id)?.region;
      group =
        region === "inner" ? "Inner London" : region === "outer" ? "Outer London" : "Other places";
    }
    return { id: option.id, label: option.label, group };
  });
  // The website sorts its groups by name and keeps the data's order inside each group.
  return facet === "venue" || facet === "borough"
    ? options
        .map((option, index) => ({ option, index }))
        .sort((a, b) => a.option.group.localeCompare(b.option.group) || a.index - b.index)
        .map(({ option }) => option)
    : options;
}

/** The website's summary beside a facet's name: "Any cinema", "Today", "2 selected". */
export function facetSummary(
  facet: FacetKey,
  label: string,
  selected: string[],
  excluded: string[],
  meta: DataMeta,
  summaryValue?: string,
): string {
  if (excluded.length) return `${selected.length} included · ${excluded.length} excluded`;
  if (summaryValue) return summaryValue;
  if (selected.length === 1) return filterLabel(facet, selected[0]!, meta);
  if (selected.length) return `${selected.length} selected`;
  return `Any ${facet === "venue" ? "cinema" : facet === "language" ? "language" : label.toLowerCase()}`;
}

/** The website's option tap: clear a chosen option, otherwise include it (or exclude it). */
export function toggleOption(
  selected: string[],
  excluded: string[],
  id: string,
  excludeMode: boolean,
): { selected: string[]; excluded: string[] } {
  const included = selected.filter((value) => value !== id);
  const rejected = excluded.filter((value) => value !== id);
  if (selected.includes(id) || excluded.includes(id))
    return { selected: included, excluded: rejected };
  return excludeMode
    ? { selected: included, excluded: [...rejected, id] }
    : { selected: [...included, id], excluded: rejected };
}
