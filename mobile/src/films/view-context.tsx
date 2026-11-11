import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ViewState } from "@readograph/core/catalogue";
import { createViewStore, initialView, type ViewStore } from "./view-store";

/**
 * One `ViewState` store per list tab (Films, Events, Radar), held in memory for the session.
 *
 * PR 4 had a single Films store. PR 5 adds Events and Radar, whose detail screens and Filters
 * sheets need their own tab's state, so the root holds all three and each tab's stack layout
 * picks its store with `ViewScope`. Everything inside that stack (the list, the pushed film
 * detail and the Filters sheet route) then reads and writes the same store through `useView`.
 */
export type ViewScopeName = "films" | "events" | "radar";

const ViewStoresContext = createContext<Record<ViewScopeName, ViewStore> | null>(null);
const ViewScopeContext = createContext<ViewStore | null>(null);

export function ViewStoresProvider({ children }: { children: ReactNode }) {
  const [stores] = useState(() => ({
    films: createViewStore(initialView("/")),
    events: createViewStore(initialView("/events")),
    radar: createViewStore(initialView("/radar")),
  }));
  return <ViewStoresContext.Provider value={stores}>{children}</ViewStoresContext.Provider>;
}

/** Wraps a tab's stack so its screens read that tab's store. */
export function ViewScope({ name, children }: { name: ViewScopeName; children: ReactNode }) {
  const stores = useContext(ViewStoresContext);
  if (!stores) throw new Error("ViewScope must be used inside ViewStoresProvider.");
  return <ViewScopeContext.Provider value={stores[name]}>{children}</ViewScopeContext.Provider>;
}

export function useViewStore(): ViewStore {
  const store = useContext(ViewScopeContext);
  if (!store) throw new Error("useView must be used inside a ViewScope.");
  return store;
}

export function useView(): ViewState {
  const store = useViewStore();
  return useSyncExternalStore(store.subscribe, store.getState);
}
