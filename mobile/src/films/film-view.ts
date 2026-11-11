import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FILM_VIEW_STORAGE, type FilmView } from "@readograph/core/display";

/**
 * The List | Posters choice, stored in AsyncStorage under the website's key name
 * (`london-cine.film-view.v1`) with the website's values ("list" or "posters"). It defaults to
 * the list and is read once at launch; until the read finishes the list shows.
 */
let view: FilmView = "list";
let loaded = false;
const listeners = new Set<() => void>();

function set(next: FilmView) {
  view = next;
  for (const listener of listeners) listener();
}

/** Anything other than "posters" (missing, old or damaged) means the list, as on the website. */
export function parseFilmView(value: string | null): FilmView {
  return value === "posters" ? "posters" : "list";
}

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(FILM_VIEW_STORAGE)
    .then((value) => set(parseFilmView(value)))
    .catch(() => undefined);
}

export function saveFilmView(next: FilmView) {
  set(next);
  AsyncStorage.setItem(FILM_VIEW_STORAGE, next).catch(() => undefined);
}

export function useFilmView(): FilmView {
  load();
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => view,
  );
}
