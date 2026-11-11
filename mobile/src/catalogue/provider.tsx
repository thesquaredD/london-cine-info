import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { SITE_ORIGIN } from "@readograph/core/site";
import { createCatalogueCache } from "./cache";
import { expoCacheFiles } from "./files";
import type { Fetcher } from "./loader";
import { createCatalogueStore, type CatalogueStore } from "./store";

/** React Native's `fetch`, typed to what the loader reads. */
const fetcher: Fetcher = (url, init) => fetch(url, init);

const CatalogueContext = createContext<CatalogueStore | null>(null);

/**
 * Creates the catalogue store once, shows the cached catalogue, checks for newer listings at
 * launch and again when the app returns to the foreground (after 30 minutes away).
 */
export function CatalogueProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() =>
    createCatalogueStore({
      fetcher,
      origin: SITE_ORIGIN,
      cache: createCatalogueCache(expoCacheFiles()),
    }),
  );
  useEffect(() => {
    void store.start();
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") void store.foreground();
    });
    return () => subscription.remove();
  }, [store]);
  return <CatalogueContext.Provider value={store}>{children}</CatalogueContext.Provider>;
}

export function useCatalogueStore(): CatalogueStore {
  const store = useContext(CatalogueContext);
  if (!store) throw new Error("useCatalogue must be used inside CatalogueProvider.");
  return store;
}

export function useCatalogue() {
  const store = useCatalogueStore();
  return useSyncExternalStore(store.subscribe, store.getState);
}
