import { expect, it } from "vitest";
import { FILM_VIEW_STORAGE, readFilmView, saveFilmView } from "./display";

it("remembers the List / Posters choice and falls back to the list", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };
  expect(readFilmView(storage)).toBe("list");
  expect(saveFilmView("posters", storage)).toBe(true);
  expect(store.get(FILM_VIEW_STORAGE)).toBe("posters");
  expect(readFilmView(storage)).toBe("posters");
  store.set(FILM_VIEW_STORAGE, "grid");
  expect(readFilmView(storage)).toBe("list");
  const blocked = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  expect(readFilmView(blocked)).toBe("list");
  expect(saveFilmView("posters", blocked)).toBe(false);
  expect(readFilmView(null)).toBe("list");
});
