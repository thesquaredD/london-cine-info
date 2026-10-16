import { useEffect, useMemo, useState } from "react";
import { Stack, router } from "expo-router";
import { View, ScrollView, Pressable, Linking, StyleSheet, AppState } from "react-native";
import { FlashList } from "@shopify/flash-list";
import * as Location from "expo-location";
import {
  sortFilms,
  selectFilms,
  tableRows,
  nextSort,
  sortLabel,
  defaultSort,
  RATINGS,
  formatDate,
  type ViewState,
  type SortKey,
} from "@lci/core/catalogue";
import {
  filterFilms,
  facetCounts,
  FILTERS,
  DATE_SHORTCUTS,
  filterLabel,
  clearFilters,
  upcomingScreenings,
  screeningMatcher,
  activeFacetChoices,
} from "@lci/core/filters";
import { matchingEvents, eventFacetCounts } from "@lci/core/events";
import { radarEntries, radarFilms } from "@lci/core/radar";
import { recoverySuggestions } from "@lci/core/recovery";
import { distanceMiles, withinRadius, type Coordinates } from "@lci/core/distance";
import { shortcutItems } from "@lci/core/shortcuts";
import { letterboxdSlug } from "@lci/core/account";
import { displayTitle, watchlistDisplay } from "@lci/core/display";
import type { Film, FacetKey, EventOccurrence } from "@lci/core/data";
import { useApp, catalogue } from "./providers";
import { useView } from "./views";
import { capture } from "./analytics";
import { Button, Chip, Text, Notice, Input, Row, useTokens } from "./ui";
import { Sheet } from "./ui/Sheet";
import { ScreeningActions } from "./screenings";
type Item = {
  key: string;
  film?: Film;
  heading?: string;
  summary?: string;
  event?: EventOccurrence;
  section?: ViewState["radarSection"];
};
const collections = [
  ["/", "All movies"],
  ["/new", "New releases"],
  ["/classics", "Classics"],
  ["/retrospectives", "Retrospectives"],
  ["/calendar", "Release calendar"],
] as const;
export function Discovery({ mode }: { mode: "films" | "events" | "radar" | "watchlist" }) {
  const app = useApp(),
    c = useTokens();
  const [view, change] = useView(mode, mode === "films" ? "/" : `/${mode}`);
  const [sheet, setSheet] = useState<"filters" | "sort" | "nearby" | null>(null),
    [category, setCategory] = useState<FacetKey>("day"),
    [exclude, setExclude] = useState(false),
    [search, setSearch] = useState("");
  const [point, setPoint] = useState<Coordinates | null>(null),
    [radius, setRadius] = useState(3),
    [locationError, setLocationError] = useState(""),
    [locating, setLocating] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState === "active") setNow(new Date());
    }, 15_000);
    return () => clearInterval(timer);
  }, []);
  const data = app.data.data;
  const viewState = useMemo(
    () => (view.myCinemas ? { ...view, filters: { ...view.filters, venue: app.cinemas } } : view),
    [view, app.cinemas],
  );
  const watched = useMemo(() => new Set(app.watchlist?.slugs ?? []), [app.watchlist]);
  const display = watchlistDisplay(app.display, viewState);
  const state = useMemo(
    () =>
      !display.ratingOrder.length && ["lb", "im", "mc", "rt"].includes(viewState.sort)
        ? {
            ...viewState,
            sort: "title" as const,
            direction: "asc" as const,
            sortExplicit: undefined,
          }
        : viewState,
    [viewState, display.ratingOrder.length],
  );
  const candidates = useMemo(() => {
    if (!data || (state.myCinemas && !app.cinemas.length)) return [];
    return state.watchlist || mode === "watchlist"
      ? data.films.filter((film) => watched.has(letterboxdSlug(film.ra.lb?.url) ?? ""))
      : data.films;
  }, [data, state.watchlist, state.myCinemas, app.cinemas.length, mode, watched]);
  const filtered = useMemo(
    () => (data ? filterFilms(selectFilms(candidates, state), data.meta, state, now) : []),
    [data, candidates, state, now],
  );
  const counts = useMemo(
    () =>
      data && sheet === "filters"
        ? mode === "events"
          ? eventFacetCounts(data.events, candidates, data.meta, state, now)
          : facetCounts(selectFilms(candidates, { ...state, filters: {} }), data.meta, state, now)
        : null,
    [data, candidates, state, now, mode, sheet],
  );
  const items = useMemo<Item[]>(() => {
    if (!data || (state.myCinemas && !app.cinemas.length)) return [];
    if (mode === "events") {
      let last = "";
      return matchingEvents(data.events, candidates, data.meta, state, now).flatMap((event) => {
        const heading = event.date !== last ? formatDate(event.date) : undefined;
        last = event.date;
        return [
          {
            key: event.id,
            event,
            film: data.films.find((film) => film.id === event.filmId),
            heading,
          },
        ];
      });
    }
    if (mode === "radar") {
      const entries = radarEntries(candidates, data.meta, now);
      return (["limited", "film", "imax"] as const).flatMap((section) => {
        const films = radarFilms(
          entries,
          data.meta,
          state,
          section,
          now,
          watched,
          display.titleMode,
        );
        return [
          {
            key: `heading-${section}`,
            heading: `${section === "limited" ? "Limited opportunity" : section === "film" ? "On film · 35mm / 70mm" : "IMAX"} · ${films.length}`,
          },
          ...films.map((film) => ({
            key: `${section}-${film.id}`,
            film,
            section,
            summary:
              section === "limited"
                ? `${entries.find((entry) => entry.film.id === film.id)!.screenings.length} screenings listed`
                : undefined,
          })),
        ];
      });
    }
    const rows = tableRows(
      sortFilms(filtered, state.sort, state.direction, watched, display.titleMode),
      state,
    );
    return rows.map((row, index) => ({
      key: row.key,
      film: row.film,
      heading:
        row.group && row.group.id !== rows[index - 1]?.group?.id ? row.group.name : undefined,
    }));
  }, [data, candidates, filtered, state, mode, now, watched, display.titleMode]);
  const count = items.filter((item) => item.film || item.event).length;
  const update = (changes: Partial<ViewState>) => {
    change(changes);
    capture("filters_changed", { path: state.path });
  };
  const toggle = (key: FacetKey, id: string) => {
    const values = (exclude ? state.excluded : state.filters)[key] ?? [];
    update({
      [exclude ? "excluded" : "filters"]: {
        ...(exclude ? state.excluded : state.filters),
        [key]: values.includes(id) ? values.filter((value) => value !== id) : [...values, id],
      },
      [exclude ? "filters" : "excluded"]: {
        ...(exclude ? state.filters : state.excluded),
        [key]: ((exclude ? state.filters : state.excluded)[key] ?? []).filter(
          (value) => value !== id,
        ),
      },
      ...(key === "venue" ? { myCinemas: false } : {}),
      tonight: false,
      page: 1,
    });
  };
  async function locate() {
    setLocating(true);
    setLocationError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationError(
          "Location access is off. Allow it in Settings, or choose cinemas in Filters.",
        );
        return;
      }
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setPoint({ lat: result.coords.latitude, lon: result.coords.longitude });
    } catch {
      setLocationError("Your location could not be found. Retry or choose cinemas in Filters.");
    } finally {
      setLocating(false);
    }
  }
  const openFilm = (film: Film, section?: ViewState["radarSection"]) => {
    capture("film_opened", { film_id: film.id, path: state.path });
    router.push({
      pathname: "/film/[id]",
      params: { id: film.id, source: mode, ...(section ? { section } : {}) },
    });
  };
  const header = (
    <View style={s.header}>
      {mode === "films" ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.strip}
        >
          {collections.map(([path, label]) => (
            <Chip
              key={path}
              label={label}
              selected={state.path === path}
              onPress={() => update({ path, ...defaultSort(path), sortExplicit: undefined })}
            />
          ))}
        </ScrollView>
      ) : null}
      <Row>
        <Button label="Filters" onPress={() => setSheet("filters")} />
        <Button
          label={`Sort: ${sortLabel(state.sort)} ${state.direction === "asc" ? "↑" : "↓"}`}
          onPress={() => setSheet("sort")}
        />
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>
        {shortcutItems({
          account: { user: app.user, watchlist: app.watchlist },
          cinemas: { venues: app.cinemas, loading: app.busy },
          state,
          counts,
        }).map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            selected={item.active}
            disabled={item.disabled}
            onPress={() => {
              if (item.id === "nearby") setSheet("nearby");
              else if (item.changes) update(item.changes);
            }}
          />
        ))}
      </ScrollView>
      {state.myCinemas ? (
        <Button label="Edit cinemas" onPress={() => router.push("/account/cinemas")} />
      ) : null}
      {data ? (
        <Row>
          {activeFacetChoices(state, data.meta).map((choice) => (
            <Chip
              key={`${choice.key}-${choice.id}`}
              label={`${choice.excluded ? "Exclude " : ""}${choice.label} ×`}
              onPress={() =>
                update({
                  [choice.excluded ? "excluded" : "filters"]: {
                    ...(choice.excluded ? state.excluded : state.filters),
                    [choice.key]: (
                      (choice.excluded ? state.excluded : state.filters)[choice.key] ?? []
                    ).filter((id) => id !== choice.id),
                  },
                  ...(choice.key === "venue" ? { myCinemas: false } : {}),
                })
              }
            />
          ))}
          {state.search ||
          state.short ||
          state.available ||
          state.watchlist ||
          state.myCinemas ||
          state.director ||
          state.years?.length ||
          state.decades?.length ||
          state.from ||
          state.to ||
          state.eventType ||
          state.filmGauge ||
          activeFacetChoices(state, data.meta).length ? (
            <Button label="Clear all" onPress={() => update(clearFilters(state.path))} />
          ) : null}
        </Row>
      ) : null}
      {app.error ? (
        <Notice
          title="Could not finish"
          actions={<Button label="Dismiss" onPress={app.dismissError} />}
        >
          {app.error}
        </Notice>
      ) : null}
      {data ? (
        <Text tone="small" muted>
          Listings updated{" "}
          {new Date(data.meta.generatedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}
        </Text>
      ) : null}
      {app.data.notice ? (
        <Notice
          title={app.data.updateRequired ? "App update needed" : "Listings"}
          actions={<Button label="Retry" onPress={() => void catalogue.refresh()} />}
        >
          {app.data.notice}
        </Notice>
      ) : null}
      {state.path === "/calendar" ? (
        <Text muted>Original release dates from TMDB; these may differ from UK cinema dates.</Text>
      ) : null}
      {mode === "radar" ? (
        <Text muted>
          Counts cover the current listings, including sold-out screenings. More dates may be added.
        </Text>
      ) : null}
      <Text>
        {app.data.loading && !data
          ? "Loading listings…"
          : `${count} ${mode === "events" ? "events" : "films"}`}
      </Text>
    </View>
  );
  if (mode === "watchlist" && (!app.user || !app.watchlist?.fetchedAt))
    return (
      <View style={[s.header, { backgroundColor: c.bg, flex: 1 }]}>
        <Notice
          title={app.signedIn ? "Connect your watchlist" : "Sign in for your watchlist"}
          actions={
            <Button
              label={app.signedIn ? "Open Account" : "Sign in"}
              onPress={() => router.push(app.signedIn ? "/(tabs)/account" : "/account/sign-in")}
            />
          }
        >
          Import your public Letterboxd watchlist from Account to see films showing in London.
        </Notice>
      </View>
    );
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={{
          title:
            mode === "films"
              ? "London Ciné Info"
              : mode === "watchlist"
                ? "My films"
                : mode === "events"
                  ? "Events"
                  : "Radar",
          headerSearchBarOptions: {
            placeholder: "Title or director",
            hideWhenScrolling: false,
            onChangeText: (event) => change({ search: event.nativeEvent.text, page: 1 }),
          },
        }}
      />
      <FlashList
        contentInsetAdjustmentBehavior="automatic"
        data={items}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={header}
        refreshing={app.data.loading}
        onRefresh={() => void catalogue.refresh()}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={s.header}>
            <Notice
              title={data ? "No matching films" : "No listings yet"}
              actions={
                <>
                  <Button label="Clear all" onPress={() => update(clearFilters(state.path))} />
                  {state.myCinemas ? (
                    <Button
                      label="Set up My cinemas"
                      onPress={() => router.push("/account/cinemas")}
                    />
                  ) : (
                    <Button label="Retry" onPress={() => void catalogue.refresh()} />
                  )}
                </>
              }
            >
              {state.myCinemas && !app.cinemas.length
                ? "Choose your cinemas to see their screenings."
                : "Try changing a filter or refreshing the listings."}
            </Notice>
            {data && !(state.myCinemas && !app.cinemas.length)
              ? recoverySuggestions(candidates, data.meta, state, now).map((suggestion) => (
                  <Button
                    key={suggestion.label}
                    label={`${suggestion.label} · ${suggestion.count}`}
                    onPress={() => update(suggestion.changes)}
                  />
                ))
              : null}
          </View>
        }
        renderItem={({ item }) => (
          <View>
            {item.heading ? (
              <Text
                accessibilityRole="header"
                tone="heading"
                style={[s.heading, { color: c.brass }]}
              >
                {item.heading}
              </Text>
            ) : null}
            {item.film || item.event ? (
              <View style={[s.film, { borderBottomColor: c.line }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.film ? displayTitle(item.film, display.titleMode) : item.event!.title}`}
                  onPress={() => item.film && openFilm(item.film, item.section)}
                  disabled={!item.film}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, gap: 6 })}
                >
                  <Text tone="heading">
                    {item.film ? displayTitle(item.film, display.titleMode) : item.event!.title}
                    {item.film && watched.has(letterboxdSlug(item.film.ra.lb?.url) ?? "")
                      ? " · Saved"
                      : ""}
                  </Text>
                  {item.film ? (
                    <>
                      <Text muted>
                        {[item.film.di.map((person) => person.name).join(", "), item.film.ye]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                      {display.titleMode === "both" &&
                      item.film.o_ti &&
                      item.film.o_ti !== item.film.ti ? (
                        <Text muted>{item.film.o_ti}</Text>
                      ) : null}
                      <Text tone="small">
                        {item.summary ??
                          (() => {
                            const next = upcomingScreenings(item.film!, data!.meta, now).find(
                              (row) =>
                                screeningMatcher(
                                  data!.meta,
                                  { ...state, radarSection: item.section },
                                  now,
                                ).row(row, item.film!),
                            );
                            return next
                              ? `${formatDate(next.date)} · ${next.venue?.name ?? ""}`
                              : "No future screenings listed";
                          })()}
                      </Text>
                      <Text tone="small">
                        {display.ratingOrder
                          .flatMap((key) =>
                            item.film!.ra[key]?.value != null
                              ? [
                                  `${RATINGS.find((rating) => rating.key === key)!.short} ${item.film!.ra[key]!.value}`,
                                ]
                              : [],
                          )
                          .join(" · ")}
                      </Text>
                    </>
                  ) : null}
                </Pressable>
                {item.event && data ? (
                  <>
                    <Text>
                      {item.event.localTime} ·{" "}
                      {data.meta.venues.find((venue) => venue.id === item.event!.venue)?.name}
                    </Text>
                    <Text>{item.event.labels.join(" · ")}</Text>
                    <ScreeningActions film={item.film} showtime={item.event} />
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
        )}
      />
      <Sheet
        title="Filters"
        open={sheet === "filters"}
        onClose={() => setSheet(null)}
        result={`Show ${count} ${mode === "events" ? "events" : "films"}`}
      >
        <Row>
          {FILTERS.map((facet) => (
            <Chip
              key={facet.key}
              label={facet.label}
              selected={category === facet.key}
              onPress={() => {
                setCategory(facet.key);
                setSearch("");
              }}
            />
          ))}
        </Row>
        <Input
          accessibilityLabel="Search filter options"
          placeholder="Search options"
          value={search}
          onChangeText={setSearch}
        />
        <Row>
          <Chip label="Include" selected={!exclude} onPress={() => setExclude(false)} />
          <Chip label="Exclude" selected={exclude} onPress={() => setExclude(true)} />
        </Row>
        {data
          ? [
              ...(category === "day"
                ? DATE_SHORTCUTS.map((id) => ({ id, label: id, count: 0 }))
                : []),
              ...data.meta.facets[category],
            ]
              .filter((option) =>
                filterLabel(category, option.id, data.meta)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((option) => (
                <Chip
                  key={option.id}
                  label={`${filterLabel(category, option.id, data.meta)} · ${counts?.[category].get(option.id) ?? 0}`}
                  selected={(exclude ? state.excluded : state.filters)[category]?.includes(
                    option.id,
                  )}
                  onPress={() => toggle(category, option.id)}
                />
              ))
          : null}
        {category === "venue" ? (
          <>
            <Chip
              label="My cinemas"
              selected={!!state.myCinemas}
              onPress={() =>
                app.cinemas.length
                  ? update({
                      myCinemas: !state.myCinemas,
                      filters: { ...state.filters, venue: state.myCinemas ? [] : app.cinemas },
                      excluded: { ...state.excluded, venue: [] },
                    })
                  : (setSheet(null), router.push("/account/cinemas"))
              }
            />
            {state.myCinemas ? (
              <Button
                label="Edit cinemas"
                onPress={() => {
                  setSheet(null);
                  router.push("/account/cinemas");
                }}
              />
            ) : null}
          </>
        ) : null}
        {category === "time" ? (
          <>
            <Input
              accessibilityLabel="Start time from"
              placeholder="From HH:MM"
              value={state.from}
              onChangeText={(from) => update({ from })}
              keyboardType="numbers-and-punctuation"
            />
            <Input
              accessibilityLabel="Start time to"
              placeholder="To HH:MM"
              value={state.to}
              onChangeText={(to) => update({ to })}
              keyboardType="numbers-and-punctuation"
            />
          </>
        ) : null}
        <Text tone="heading">Year</Text>
        <Row>
          {[
            ...new Set(
              data?.films.flatMap((film) => (film.ye ? [Math.floor(film.ye / 10) * 10] : [])) ?? [],
            ),
          ]
            .sort((a, b) => b - a)
            .map((decade) => (
              <Chip
                key={decade}
                label={`${decade}s`}
                selected={state.decades?.includes(decade)}
                onPress={() =>
                  update({
                    decades: state.decades?.includes(decade)
                      ? state.decades.filter((value) => value !== decade)
                      : [...(state.decades ?? []), decade],
                  })
                }
              />
            ))}
        </Row>
        <Row>
          {[...new Set(data?.films.flatMap((film) => (film.ye ? [film.ye] : [])) ?? [])]
            .sort((a, b) => b - a)
            .map((year) => (
              <Chip
                key={year}
                label={String(year)}
                selected={state.years?.includes(year)}
                onPress={() =>
                  update({
                    years: state.years?.includes(year)
                      ? state.years.filter((value) => value !== year)
                      : [...(state.years ?? []), year],
                  })
                }
              />
            ))}
        </Row>
        <Text tone="heading">Director</Text>
        {data
          ? [
              ...new Map(
                data.films.flatMap((film) => film.di.map((person) => [person.id, person] as const)),
              ).values(),
            ]
              .filter(
                (person) => search && person.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((person) => (
                <Chip
                  key={person.id}
                  label={person.name}
                  selected={state.director === person.id}
                  onPress={() =>
                    update({ director: state.director === person.id ? "" : person.id })
                  }
                />
              ))
          : null}
        {mode === "events" ? (
          <Row>
            {["highlights", "qa", "score", "programme", "talk", "other"].map((eventType) => (
              <Chip
                key={eventType}
                label={eventType === "qa" ? "Q&A" : eventType}
                selected={state.eventType === eventType}
                onPress={() =>
                  update({ eventType: state.eventType === eventType ? "" : eventType })
                }
              />
            ))}
          </Row>
        ) : null}
        {mode === "radar" ? (
          <Row>
            {(["35mm", "70mm"] as const).map((filmGauge) => (
              <Chip
                key={filmGauge}
                label={filmGauge}
                selected={state.filmGauge === filmGauge}
                onPress={() =>
                  update({ filmGauge: state.filmGauge === filmGauge ? undefined : filmGauge })
                }
              />
            ))}
          </Row>
        ) : null}
        <Chip
          label="Hide sold-out screenings"
          selected={state.available}
          onPress={() => update({ available: !state.available })}
        />
        <Chip
          label="Under two hours"
          selected={state.short}
          onPress={() => update({ short: !state.short })}
        />
        <Button label="Clear all" onPress={() => update(clearFilters(state.path))} />
      </Sheet>
      <Sheet title="Sort" open={sheet === "sort"} onClose={() => setSheet(null)}>
        {(
          [
            "title",
            "director",
            "year",
            "runtime",
            "watchlist",
            ...(display.ratingOrder.length ? RATINGS.map((rating) => rating.key) : []),
          ] as SortKey[]
        ).map((key) => (
          <Chip
            key={key}
            label={sortLabel(key)}
            selected={state.sort === key}
            onPress={() => change(nextSort(state, key))}
          />
        ))}
        <Button
          label={state.direction === "asc" ? "Ascending ↑" : "Descending ↓"}
          onPress={() =>
            change({ direction: state.direction === "asc" ? "desc" : "asc", sortExplicit: true })
          }
        />
      </Sheet>
      <Sheet title="Near me" open={sheet === "nearby"} onClose={() => setSheet(null)}>
        <Text>
          Choose cinemas within a straight-line distance of your current location. Your location
          stays on this phone and is not saved.
        </Text>
        <Button
          label={locating ? "Finding location…" : point ? "Update location" : "Use my location"}
          disabled={locating}
          onPress={() => void locate()}
        />
        {locationError ? (
          <Notice
            title="Location unavailable"
            actions={<Button label="Open Settings" onPress={() => void Linking.openSettings()} />}
          >
            {locationError}
          </Notice>
        ) : null}
        <Row>
          {[1, 3, 5, 10].map((value) => (
            <Chip
              key={value}
              label={`${value} miles`}
              selected={radius === value}
              onPress={() => setRadius(value)}
            />
          ))}
        </Row>
        {point && data ? (
          <>
            {data.meta.venues
              .filter((venue) => withinRadius(distanceMiles(point, venue), radius))
              .map((venue) => (
                <Text key={venue.id}>
                  {venue.name} · {distanceMiles(point, venue)!.toFixed(1)} mi
                </Text>
              ))}
            <Button
              label="Show these cinemas"
              selected
              onPress={() => {
                update({
                  myCinemas: false,
                  filters: {
                    ...state.filters,
                    venue: data.meta.venues
                      .filter((venue) => withinRadius(distanceMiles(point, venue), radius))
                      .map((venue) => venue.id),
                  },
                  excluded: { ...state.excluded, venue: [] },
                });
                setSheet(null);
              }}
              disabled={
                !data.meta.venues.some((venue) => withinRadius(distanceMiles(point, venue), radius))
              }
            />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}
const s = StyleSheet.create({
  header: { padding: 16, gap: 12 },
  strip: { gap: 6 },
  heading: { padding: 16, paddingTop: 28 },
  film: { padding: 16, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
