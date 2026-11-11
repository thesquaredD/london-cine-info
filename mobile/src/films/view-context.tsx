import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ViewState } from "@readograph/core/catalogue";
import { createViewStore, type ViewStore } from "./view-store";

const FilmsViewContext = createContext<ViewStore | null>(null);

/** The Films tab's `ViewState`, shared by the list, the detail screen and (PR 5) the Filters sheet. */
export function FilmsViewProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createViewStore());
  return <FilmsViewContext.Provider value={store}>{children}</FilmsViewContext.Provider>;
}

export function useFilmsViewStore(): ViewStore {
  const store = useContext(FilmsViewContext);
  if (!store) throw new Error("useFilmsView must be used inside FilmsViewProvider.");
  return store;
}

export function useFilmsView(): ViewState {
  const store = useFilmsViewStore();
  return useSyncExternalStore(store.subscribe, store.getState);
}
