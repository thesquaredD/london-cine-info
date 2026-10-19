import type { ComponentChildren } from "preact";
import { openFeedback } from "../lib/feedback";
import { clearFilters, activeFacetChoices } from "../lib/filters";
import type { DataMeta } from "../shared/data";
import type { ViewState } from "../lib/catalogue";
import { hasYears, yearSummary } from "../lib/years";
import { EVENT_TYPES } from "../data/event-rules";
import { isIndependentCinema } from "../data/independent-cinemas";

/** Uses the same facet labels as the active-filter chips; each action clears one group. */
export function EmptyState({
  state,
  meta,
  onChange,
  events = false,
  suggestions,
  directorName,
}: {
  state: ViewState;
  meta: DataMeta;
  onChange: (changes: Partial<ViewState>) => void;
  events?: boolean;
  suggestions?: ComponentChildren;
  directorName?: string;
}) {
  const choices = activeFacetChoices(state, meta);
  const groups: { key: string; label: string; action: string; changes: Partial<ViewState> }[] = [];
  const add = (key: string, label: string, action: string, changes: Partial<ViewState>) =>
    groups.push({ key, label, action, changes: { ...changes, page: 1 } });
  for (const choice of choices) {
    if (groups.some((group) => group.key === choice.key)) continue;
    const values = choices
      .filter((item) => item.key === choice.key)
      .map((item) => `${item.excluded ? "NOT " : ""}${item.label}`);
    add(choice.key, values.join(", "), `Any ${choice.groupLabel.toLowerCase()}`, {
      filters: { ...state.filters, [choice.key]: [] },
      excluded: { ...state.excluded, [choice.key]: [] },
      ...(choice.key === "venue" ? { myCinemas: false } : {}),
      ...(choice.key === "time" ? { from: "", to: "", tonight: false } : {}),
      ...(choice.key === "day" && state.tonight
        ? {
            tonight: false,
            from: "",
            to: "",
            filters: { ...state.filters, day: [], time: [] },
            excluded: { ...state.excluded, day: [], time: [] },
          }
        : {}),
    });
  }
  if (state.search) add("search", `Search: ${state.search}`, "Any title", { search: "" });
  if (hasYears(state))
    add("year", `Year: ${yearSummary(state)}`, "Any year", { decades: [], years: [] });
  if (state.director)
    add("director", `Director: ${directorName ?? state.director}`, "Any director", {
      director: "",
    });
  if (state.from || state.to) {
    const label = `Starts ${state.from || "00:00"}–${state.to || "23:59"}`;
    const time = groups.find((group) => group.key === "time");
    if (time) time.label += `, ${label}`;
    else add("range", label, "Any start time", { from: "", to: "", tonight: false });
  }
  if (state.independent)
    add("independent", "Independent cinemas", "All cinema types", { independent: false });
  if (state.short) add("short", "Under 2 hours", "Any runtime", { short: false });
  if (state.available)
    add("available", "Not sold out", "Include sold-out screenings", { available: false });
  if (state.watchlist) add("watchlist", "My watchlist", "All films", { watchlist: false });
  if (state.eventType)
    add(
      "eventType",
      `Event type: ${state.eventType === "highlights" ? "Q&As, scores & talks" : (EVENT_TYPES.find((type) => type.id === state.eventType)?.label ?? state.eventType)}`,
      "Any event type",
      { eventType: "" },
    );
  if (state.filmGauge)
    add("filmGauge", `On film: ${state.filmGauge}`, "Any film gauge", { filmGauge: undefined });
  const day =
    state.filters.day?.length === 1 && !state.excluded.day?.length
      ? choices.find((choice) => choice.key === "day" && !choice.excluded)?.label
      : undefined;
  // "Nothing on Today at X" would blame the day when Independent excludes X itself.
  const cinema =
    state.filters.venue?.length === 1 &&
    !state.excluded.venue?.length &&
    (!state.independent || isIndependentCinema({ id: state.filters.venue[0]! }))
      ? choices.find((choice) => choice.key === "venue" && !choice.excluded)?.label
      : undefined;
  const title =
    day && cinema
      ? `Nothing on ${day} at ${cinema}`
      : events
        ? "No events match these filters"
        : "No films match these filters";
  const labels = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" }).format(
    groups.map((group) => group.label),
  );
  return (
    <div class="empty-state">
      <h2>{title}</h2>
      <p>
        {events
          ? "Try another date, cinema or event type."
          : labels
            ? `The filters you have on are ${labels}. Loosen one to see more.`
            : "Try choosing another day or cinema."}
      </p>
      {suggestions}
      <div class="empty-actions">
        {groups.slice(0, 3).map((group) => (
          <button key={group.key} onClick={() => onChange(group.changes)}>
            {group.action}
          </button>
        ))}
        <button onClick={() => onChange(clearFilters(state.path))}>Clear filters</button>
        <button class="feedback-link" onClick={() => openFeedback({ context: { resultCount: 0 } })}>
          Missing something? Tell us
        </button>
      </div>
    </div>
  );
}
