import type { TitleMode } from "./display";
import type { DataMeta, Film } from "../shared/data";
import {
  addDays,
  londonDate,
  upcomingScreenings,
  filterFilms,
  isSpecialFormat,
  isFilmFormat,
  isImaxFormat,
  type ScreeningView,
} from "./filters";
import { selectFilms, sortFilms, hasCustomSort, type ViewState } from "./catalogue";
export type RadarEntry = { film: Film; screenings: ScreeningView[]; special: ScreeningView[] };
export function radarEntries(films: Film[], meta: DataMeta, now = new Date()): RadarEntry[] {
  return films.map((film) => {
    const screenings = upcomingScreenings(film, meta, now);
    return { film, screenings, special: screenings.filter((row) => isSpecialFormat(row.formats)) };
  });
}
export function radarFilms(
  entries: RadarEntry[],
  meta: DataMeta,
  state: ViewState,
  section: "limited" | "film" | "imax",
  now = new Date(),
  watched?: ReadonlySet<string>,
  titleMode: TitleMode = "both",
): Film[] {
  const qualifying = entries.filter((entry) =>
    section === "limited"
      ? entry.screenings.length >= 1 &&
        entry.screenings.length <= 3 &&
        entry.screenings.some((row) => row.date <= addDays(londonDate(now), 6) && !row.soldOut)
      : entry.special.some((row) =>
          section === "film"
            ? isFilmFormat(row.formats, state.filmGauge)
            : isImaxFormat(row.formats),
        ),
  );
  const films = filterFilms(
    selectFilms(
      qualifying.map((entry) => entry.film),
      state,
    ),
    meta,
    { ...state, radarSection: section },
    now,
  );
  if (hasCustomSort(state))
    return sortFilms(films, state.sort, state.direction, watched, titleMode);
  const byId = new Map(qualifying.map((entry) => [entry.film.id, entry]));
  return films.sort((a, b) => {
    const av = byId.get(a.id)!,
      bv = byId.get(b.id)!;
    return (
      (section === "limited" ? av.screenings.length - bv.screenings.length : 0) ||
      (section === "limited"
        ? av.screenings[0]!.epoch! - bv.screenings[0]!.epoch!
        : av.special.find((row) =>
            section === "film"
              ? isFilmFormat(row.formats, state.filmGauge)
              : isImaxFormat(row.formats),
          )!.epoch! -
          bv.special.find((row) =>
            section === "film"
              ? isFilmFormat(row.formats, state.filmGauge)
              : isImaxFormat(row.formats),
          )!.epoch!) ||
      a.ti.localeCompare(b.ti) ||
      a.id.localeCompare(b.id)
    );
  });
}
