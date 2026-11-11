import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import type { Href } from "expo-router";
import { directorLabel } from "@readograph/core/filters";
import { useCatalogue } from "@/catalogue/provider";
import { activeFilterCount, clearAllChanges, filterChips } from "@/films/chips";
import { FilterChips, FiltersButton } from "@/films/discovery-bar";
import { SearchField } from "@/films/search-field";
import { useView, useViewStore, type ViewScopeName } from "@/films/view-context";
import { space } from "@/ui/tokens";

/**
 * The search field with the icon-only Filters button beside it, and the active-filter chips
 * under them, for a list tab. The button opens that tab's Filters sheet route.
 */
export function SearchAndFilters({ scope }: { scope: ViewScopeName }) {
  const { catalogue } = useCatalogue();
  const store = useViewStore();
  const state = useView();
  const chips = useMemo(
    () =>
      catalogue ? filterChips(state, catalogue.meta, directorLabel(state, catalogue.films)) : [],
    [catalogue, state],
  );
  const setSearch = useCallback((search: string) => store.setSearch(search), [store]);
  return (
    <>
      <View style={styles.row}>
        <SearchField value={state.search} onChange={setSearch} />
        <FiltersButton count={activeFilterCount(state)} href={`/${scope}/filters` as Href} />
      </View>
      <FilterChips
        chips={chips}
        onApply={store.update}
        onClearAll={() => store.update(clearAllChanges(state))}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.s, paddingHorizontal: space.l, paddingTop: space.m },
});
