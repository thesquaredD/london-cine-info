import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { sortFilms, selectFilms } from "@readograph/core/catalogue";
import { filterFilms } from "@readograph/core/filters";
import { DEFAULT_DISPLAY } from "@readograph/core/display";
import type { Film } from "@readograph/core/data";
import { useCatalogue, useCatalogueStore } from "@/catalogue/provider";
import { CatalogueStatus } from "@/catalogue/status";
import { CollectionSwitcher } from "@/films/collection-switcher";
import { FilmRow } from "@/films/film-row";
import { directorLine, nextScreening, rowRating } from "@/films/present";
import { SearchField } from "@/films/search-field";
import { SortMenu } from "@/films/sort-menu";
import { useFilmsView, useFilmsViewStore } from "@/films/view-context";
import { useNow } from "@/films/use-now";
import { Banner, Notice } from "@/ui/notice";
import { Text } from "@/ui/text";
import { colors, space } from "@/ui/tokens";

/**
 * The Films list: the collection switcher, search and sort over
 * `sortFilms(filterFilms(selectFilms(films, state)))`, the website's pipeline, in a FlashList.
 */
export default function FilmsScreen() {
  const { catalogue, error, updateRequired, refreshing } = useCatalogue();
  const catalogueStore = useCatalogueStore();
  const view = useFilmsViewStore();
  const state = useFilmsView();
  const now = useNow();
  const display = DEFAULT_DISPLAY;

  const films = useMemo(() => {
    if (!catalogue) return [];
    const selected = filterFilms(selectFilms(catalogue.films, state), catalogue.meta, state, now);
    return sortFilms(selected, state.sort, state.direction, undefined, display.titleMode);
  }, [catalogue, state, now, display.titleMode]);

  const open = useCallback((film: Film) => {
    router.push({ pathname: "/films/[id]", params: { id: film.id } });
  }, []);
  const setSearch = useCallback((search: string) => view.setSearch(search), [view]);

  const header = (
    <View>
      <CollectionSwitcher path={state.path} onChange={view.setCollection} />
      <View style={styles.searchRow}>
        <SearchField value={state.search} onChange={setSearch} />
      </View>
      {updateRequired ? (
        <Banner>New listings need the latest version of the app. Update it to see them.</Banner>
      ) : null}
      {catalogue && error ? (
        <Banner>Showing saved listings. They will update when you are back online.</Banner>
      ) : null}
      <View style={styles.results}>
        <Text tone="muted" style={styles.count} accessibilityLiveRegion="polite">
          {catalogue ? `${films.length} ${films.length === 1 ? "film" : "films"}` : ""}
        </Text>
        <SortMenu state={state} onSort={view.sortBy} />
      </View>
    </View>
  );

  if (!catalogue)
    return (
      <View style={styles.screen}>
        <CatalogueStatus />
      </View>
    );

  return (
    <View style={styles.screen}>
      <FlashList
        data={films}
        keyExtractor={(film) => film.id}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Notice title="No films match" body="Try another collection or a shorter search." />
        }
        refreshing={refreshing}
        onRefresh={() => void catalogueStore.refresh()}
        extraData={state}
        renderItem={({ item }) => (
          <FilmRow
            film={item}
            titleMode={display.titleMode}
            director={directorLine(item)}
            next={nextScreening(item, catalogue.meta, state, now)}
            rating={rowRating(item, state)}
            onOpen={open}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  searchRow: {
    flexDirection: "row",
    gap: space.s,
    paddingHorizontal: space.l,
    paddingTop: space.m,
  },
  results: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.m,
    marginTop: space.s,
    minHeight: 48,
    paddingHorizontal: space.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  count: { flex: 1 },
});
