import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { DEFAULT_DISPLAY, supportsPosters, type FilmView } from "@readograph/core/display";
import type { Film } from "@readograph/core/data";
import { useCatalogue, useCatalogueStore } from "@/catalogue/provider";
import { CatalogueStatus } from "@/catalogue/status";
import { CollectionSwitcher } from "@/films/collection-switcher";
import { detailHref } from "@/films/detail-link";
import { ResultsBar, ViewSwitch } from "@/films/discovery-bar";
import { FilmRow } from "@/films/film-row";
import { saveFilmView, useFilmView } from "@/films/film-view";
import { releaseGridRowHeights } from "@/films/grid-heights";
import { gridPoster } from "@/films/morph";
import { MorphOverlay } from "@/films/morph-overlay";
import { PosterCell } from "@/films/poster-cell";
import { directorLine, nextScreening, rowRating } from "@/films/present";
import { filmCount, gridColumns, listItems, type ListItem } from "@/films/rows";
import { SortMenu } from "@/films/sort-menu";
import { useMorph } from "@/films/use-morph";
import { useNow } from "@/films/use-now";
import { useView, useViewStore } from "@/films/view-context";
import { filmResults, resultLabel } from "@/filters/results";
import { SearchAndFilters } from "@/filters/search-and-filters";
import { Banner, Notice } from "@/ui/notice";
import { Text } from "@/ui/text";
import { colors, space } from "@/ui/tokens";

/**
 * The Films list (mock-up 1): the collection switcher, the search field with the icon-only
 * Filters button, the active-filter chips, and the results bar with the count, the sort control
 * and the List | Posters switch, over the website's pipeline in a FlashList. The Release
 * calendar and Retrospectives keep the website's group headings.
 */
export default function FilmsScreen() {
  const { catalogue, error, updateRequired, refreshing } = useCatalogue();
  const catalogueStore = useCatalogueStore();
  const view = useViewStore();
  const state = useView();
  const now = useNow();
  const { width } = useWindowDimensions();
  const display = DEFAULT_DISPLAY;
  const listRef = useRef<FlashListRef<ListItem>>(null);

  const films = useMemo(
    () => (catalogue ? filmResults(catalogue, state, now) : []),
    [catalogue, state, now],
  );
  const items = useMemo(() => listItems(films, state), [films, state]);
  const columns = useMemo(() => gridColumns(items), [items]);

  // The stored choice applies only where the website offers posters.
  const stored = useFilmView();
  const allowed = supportsPosters(state.path);
  const wanted: FilmView = allowed ? stored : "list";
  const [layout, setLayoutState] = useState<FilmView>(wanted);
  const itemCount = items.length;
  const setLayout = useCallback(
    (next: FilmView) => {
      if (next === "list") releaseGridRowHeights(listRef.current, itemCount);
      setLayoutState(next);
    },
    [itemCount],
  );
  const morph = useMorph({
    listRef,
    items,
    width,
    onLayoutChange: setLayout,
    onSettled: saveFilmView,
  });
  // Outside a morph (a collection without posters, the stored choice loading) follow `wanted`.
  useEffect(() => {
    if (!morph.busy()) setLayout(wanted);
  }, [wanted, morph, setLayout]);

  const posterWidth = gridPoster(width).width;
  const renderText = useCallback(
    (film: Film) =>
      catalogue ? (
        <FilmRow
          film={film}
          titleMode={display.titleMode}
          director={directorLine(film)}
          next={nextScreening(film, catalogue.meta, state, now)}
          rating={rowRating(film, state)}
          href={detailHref("films", film)}
          posterHidden
        />
      ) : null,
    [catalogue, display.titleMode, state, now],
  );

  if (!catalogue)
    return (
      <View style={styles.screen}>
        <CatalogueStatus />
      </View>
    );

  // While a morph runs the controls above the list wait, so the items cannot change mid-flight.
  const header = (
    <View pointerEvents={morph.plan ? "none" : "auto"}>
      <CollectionSwitcher path={state.path} onChange={view.setCollection} />
      <SearchAndFilters scope="films" />
      {updateRequired ? (
        <Banner>New listings need the latest version of the app. Update it to see them.</Banner>
      ) : null}
      {error ? (
        <Banner>Showing saved listings. They will update when you are back online.</Banner>
      ) : null}
      <ResultsBar label={resultLabel("films", films.length)}>
        <SortMenu state={state} onSort={view.sortBy} />
        {allowed ? (
          <ViewSwitch view={layout} onChange={(next) => void morph.toggle(layout, next)} />
        ) : null}
      </ResultsBar>
      {state.path === "/calendar" ? (
        <Text size={2} tone="muted" style={styles.note}>
          Films stay grouped by release date. Sorting applies within each date.
        </Text>
      ) : null}
    </View>
  );

  const grid = layout === "posters";
  return (
    <View style={styles.screen}>
      <FlashList
        ref={listRef}
        data={items}
        // FlashList 2 swaps its layout manager when numColumns changes, so the list keeps its
        // ref and scroll position through the morph (no remount).
        numColumns={grid ? 3 : 1}
        keyExtractor={(item) => item.key}
        getItemType={(item) => (item.type === "group" ? "group" : grid ? "poster" : "row")}
        overrideItemLayout={(layout, item) => {
          if (item.type === "group") layout.span = 3;
        }}
        contentInsetAdjustmentBehavior="automatic"
        onScroll={morph.onScroll}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListFooterComponent={<View style={styles.footer} />}
        ListEmptyComponent={
          <Notice
            title="No films match"
            body="Try another collection, fewer filters or a shorter search."
          />
        }
        refreshing={refreshing}
        onRefresh={() => void catalogueStore.refresh()}
        extraData={state}
        renderItem={({ item }) => (
          <Hideable opacity={morph.cellsOpacity}>
            {item.type === "group" ? (
              <GroupHeading name={item.name} count={item.count} />
            ) : grid ? (
              <PosterCell
                film={item.film}
                column={columns.get(item.key) ?? 0}
                posterWidth={posterWidth}
                titleMode={display.titleMode}
                href={detailHref("films", item.film)}
                canOpen={() => !morph.busy()}
              />
            ) : (
              <FilmRow
                film={item.film}
                titleMode={display.titleMode}
                director={directorLine(item.film)}
                next={nextScreening(item.film, catalogue.meta, state, now)}
                rating={rowRating(item.film, state)}
                href={detailHref("films", item.film)}
                canOpen={() => !morph.busy()}
              />
            )}
          </Hideable>
        )}
      />
      <MorphOverlay
        plan={morph.plan}
        films={
          new Map(items.flatMap((item) => (item.type === "film" ? [[item.key, item.film]] : [])))
        }
        texts={morph.texts}
        progress={morph.progress}
        opacity={morph.overlayOpacity}
        renderText={renderText}
      />
    </View>
  );
}

/** A list cell the morph can hide while its overlay flies (one shared opacity for all cells). */
function Hideable({
  opacity,
  children,
}: {
  opacity: SharedValue<number>;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** "Released on 4 December 2026 · 3 films", "Agnès Varda · 5 films". */
export function GroupHeading({ name, count }: { name: string; count: number }) {
  return (
    <View style={styles.group} accessible accessibilityRole="header">
      <Text weight="medium" tone="brass">
        {name}
      </Text>
      <Text size={2} tone="muted">
        {filmCount(count)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  note: { paddingHorizontal: space.l, paddingTop: space.s },
  group: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.m,
    paddingHorizontal: space.l,
    paddingTop: space.xl,
    paddingBottom: space.s,
    borderBottomWidth: 1,
    borderBottomColor: colors.brassRuleSoft,
  },
  footer: { height: space.xxxl },
});
