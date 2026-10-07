import { useEffect, useRef } from "preact/hooks";
import type { ViewState } from "./catalogue";
import { capture } from "./analytics";
import { analyticsText, type AnalyticsProperties } from "../shared/analytics";

export function discoveryProperties(state: ViewState): AnalyticsProperties {
  const keys = Object.keys({ ...state.filters, ...state.excluded }).sort();
  const filterValues = keys.flatMap((key) =>
    (state.filters[key as keyof typeof state.filters] ?? []).map((value) => `${key}:${value}`),
  );
  filterValues.push(
    ...(state.decades ?? []).map((value) => `decade:${value}`),
    ...(state.years ?? []).map((value) => `year:${value}`),
  );
  const excludedValues = keys.flatMap((key) =>
    (state.excluded[key as keyof typeof state.excluded] ?? []).map((value) => `${key}:${value}`),
  );
  for (const [key, value] of Object.entries({
    from: state.from,
    to: state.to,
    director: state.director,
    event_type: state.eventType,
    film_gauge: state.filmGauge,
  }))
    if (value) filterValues.push(`${key}:${value}`);
  for (const [key, active] of Object.entries({
    available: state.available,
    watchlist: state.watchlist,
    tonight: state.tonight,
    short: state.short,
  }))
    if (active) filterValues.push(`${key}:true`);
  return {
    filter_values: filterValues.sort(),
    excluded_values: excludedValues.sort(),
    filter_keys: [
      ...new Set([...filterValues, ...excludedValues].map((value) => value.split(":")[0]!)),
    ].sort(),
    filter_count: filterValues.length + excludedValues.length,
    watchlist: !!state.watchlist || state.path === "/watchlist",
    tonight: !!state.tonight,
    short: !!state.short,
  };
}

export function useDiscoveryAnalytics(
  state: ViewState,
  resultCount: number,
  ready: boolean,
  watchlistReady: boolean,
  shared: AnalyticsProperties = {},
  selectionKey = "",
) {
  const settled = useRef<{ path: string; query: string; filters: string } | null>(null);
  const previousWatchlist = useRef(false);
  const previousShared = useRef("");
  const properties = { ...discoveryProperties(state), ...shared };
  const filters = JSON.stringify(properties);
  const filterIdentity = `${filters}:${selectionKey}`;
  const query = state.search.trim();
  const viewReady = ready && (!(state.watchlist || state.path === "/watchlist") || watchlistReady);
  useEffect(() => {
    capture("$pageview", { path: state.path });
  }, [state.path]);
  useEffect(() => {
    if (!viewReady) return;
    const timer = window.setTimeout(() => {
      const previous = settled.current;
      const context = {
        ...properties,
        path: state.path,
        query: analyticsText(query),
        result_count: resultCount,
        result_type: state.path === "/events" ? "events" : "films",
      };
      if (query && (!previous || previous.query !== query || previous.path !== state.path))
        capture("search_performed", context);
      if (
        (previous && previous.filters !== filterIdentity) ||
        (!previous && Number(properties.filter_count) > 0)
      )
        capture("filters_changed", context);
      if (
        shared.shared_watchlists &&
        previousShared.current !== `${state.path}:${filterIdentity}`
      ) {
        capture("shared_watchlists_used", context);
        previousShared.current = `${state.path}:${filterIdentity}`;
      } else if (!shared.shared_watchlists) previousShared.current = "";
      settled.current = { path: state.path, query, filters: filterIdentity };
    }, 600);
    return () => window.clearTimeout(timer);
  }, [state.path, query, filterIdentity, resultCount, viewReady]);
  useEffect(() => {
    const usingWatchlist =
      viewReady && watchlistReady && (state.path === "/watchlist" || !!state.watchlist);
    if (usingWatchlist && !previousWatchlist.current)
      capture("watchlist_used", { path: state.path, result_count: resultCount });
    previousWatchlist.current = usingWatchlist;
  }, [state.path, state.watchlist, viewReady, watchlistReady]);
}
