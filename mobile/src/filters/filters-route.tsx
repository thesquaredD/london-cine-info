import { useEffect } from "react";
import { Platform } from "react-native";
import { router, type Href } from "expo-router";
import { useAndroidFilters } from "./android-filters";
import { FiltersSheet } from "./filters-sheet";
import type { ScopeKind } from "./results";

/** iOS keeps its native route; Android deep links open the same modal as the toolbar. */
export function FiltersRoute({ kind }: { kind: ScopeKind }) {
  const android = useAndroidFilters();
  useEffect(() => {
    if (!android) return;
    router.replace(`/${kind}` as Href);
    android.open(kind);
  }, [android, kind]);
  return Platform.OS === "ios" ? <FiltersSheet kind={kind} /> : null;
}
