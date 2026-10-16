import { useSyncExternalStore } from "react";
import { readView, type ViewState } from "@lci/core/catalogue";
import { createStore } from "./store";
const views = new Map<string, ReturnType<typeof createStore<ViewState>>>();
export function useView(key: string, path: string) {
  let store = views.get(key);
  if (!store) {
    store = createStore(readView(new URL(`https://london-cine.info${path}`)));
    views.set(key, store);
  }
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const target = store;
  return [
    state,
    (change: Partial<ViewState>) => target.set({ ...target.getSnapshot(), ...change }),
  ] as const;
}
