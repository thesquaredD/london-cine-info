import { Buffer } from "node:buffer";
import { MEMBERSHIPS, membershipsForVenue } from "../../src/data/memberships";
import {
  CLASSIC_YEARS,
  NEW_RELEASE_DAYS,
  RETROSPECTIVE_MIN_FILMS,
  isEventScreening,
} from "../../src/data/event-rules";
import {
  DATA_SCHEMA_VERSION,
  type DataMeta,
  type FacetKey,
  type FacetOption,
  type Film,
  type FilmShowtimes,
  type Rating,
  type Showtime,
  type SourceRelease,
  type Venue,
} from "../../src/shared/data";
import type { BoroughIndex } from "./boroughs";
import {
  combinedSchema,
  matchedSchema,
  httpUrl,
  validate,
  type Combined,
  type Matched,
  type RawMovie,
} from "./schemas";
import { londonTime } from "./time";

export type BuildOptions = {
  now: Date;
  sources: { combined: SourceRelease; matched: SourceRelease };
  boroughs: BoroughIndex;
};
export type Dataset = { films: Film[]; meta: DataMeta; showtimes: FilmShowtimes[] };
const keys: FacetKey[] = [
  "day",
  "time",
  "venue",
  "borough",
  "format",
  "accessibility",
  "membership",
  "genre",
  "language",
];
const accessLabels: Record<string, string> = {
  audioDescription: "Audio description",
  subtitled: "Subtitled",
  hardOfHearing: "Captions / hard of hearing",
  relaxed: "Relaxed",
  babyFriendly: "Baby friendly",
};
const formatLabels: Record<string, string> = {
  standard: "Standard / unspecified",
  "2d": "2D",
  "3d": "3D",
  imax: "IMAX",
  "imax-70mm": "IMAX 70mm",
  "4dx": "4DX",
  screenx: "ScreenX",
  "dolby-cinema": "Dolby Cinema",
  vhs: "VHS",
};
const sorted = (values: Iterable<string>) => [...new Set(values)].sort();
const options = (entries: [string, string][]): FacetOption[] =>
  entries.map(([id, label]) => ({ id, label, count: 0 }));

export function encodeBitset(indices: number[], length: number): string {
  const bytes = Buffer.alloc(Math.ceil(length / 8));
  for (const index of indices) {
    if (!Number.isInteger(index) || index < 0 || index >= length)
      throw new Error(`Invalid facet index ${index}/${length}`);
    bytes[index >> 3] = bytes[index >> 3]! | (1 << (index & 7));
  }
  return bytes.toString("base64");
}

function validateReferences(data: Combined): void {
  for (const [id, venue] of Object.entries(data.venues)) {
    if (id !== venue.id) throw new Error(`venues.${id}: record key differs from id ${venue.id}`);
  }
  for (const [id, movie] of Object.entries(data.movies)) {
    if (id !== movie.id) throw new Error(`movies.${id}: record key differs from id ${movie.id}`);
    for (const person of [...movie.directors, ...movie.actors])
      if (!data.people[person]) throw new Error(`movies.${id}: unknown person ${person}`);
    for (const genre of movie.genres)
      if (!data.genres[genre]) throw new Error(`movies.${id}: unknown genre ${genre}`);
    for (const [showingId, showing] of Object.entries(movie.showings))
      if (!data.venues[showing.venueId])
        throw new Error(`movies.${id}.showings.${showingId}: unknown venue ${showing.venueId}`);
    for (const performance of movie.performances)
      if (!movie.showings[performance.showingId])
        throw new Error(`movies.${id}: unknown showing ${performance.showingId}`);
  }
}

function rating(
  entry: { url: string } | undefined,
  value: number | null | undefined,
): Rating | null {
  return entry ? { value: value ?? null, url: entry.url } : null;
}
function ratings(id: string, matched: Matched): Film["ra"] {
  const lb = matched.letterboxd[id],
    im = matched.imdb[id],
    mc = matched.metacritic[id],
    rt = matched.rottentomatoes[id];
  return {
    lb: rating(lb, lb?.rating),
    im: rating(im, im?.rating),
    mc: rating(mc, mc?.critics?.rating),
    rt: rating(rt, rt?.critics?.all?.score),
  };
}

export function buildDataset(
  rawCombined: unknown,
  rawMatched: unknown,
  config: BuildOptions,
): Dataset {
  if (!Number.isFinite(config.now.getTime())) throw new Error("Invalid build time");
  const data = validate(combinedSchema, rawCombined, "combined");
  const matched = validate(matchedSchema, rawMatched, "matched");
  validateReferences(data);
  const today = londonTime(config.now.getTime()).date;
  const calendarNow = Date.parse(`${today}T00:00:00Z`);
  const classicDate = new Date(calendarNow);
  classicDate.setUTCFullYear(classicDate.getUTCFullYear() - CLASSIC_YEARS);
  const venues: Venue[] = Object.values(data.venues)
    .sort((a, b) => a.id.localeCompare(b.id, "en"))
    .map((venue) => ({
      id: venue.id,
      name: venue.name,
      address: venue.address,
      url: venue.url,
      lat: venue.geo.lat,
      lon: venue.geo.lon,
      group: venue.groupName ?? null,
      borough: config.boroughs.locate(venue.geo.lon, venue.geo.lat),
      memberships: membershipsForVenue(venue.id, venue.groupName),
    }));
  const venueMap = new Map(venues.map((venue) => [venue.id, venue]));
  const boroughs = [
    ...config.boroughs.boroughs,
    { id: "outside-london", name: "Outside London", region: "outside" as const },
  ];
  let expiredScreenings = 0,
    duplicateScreenings = 0;
  const invalidBookingUrls: DataMeta["diagnostics"]["invalidBookingUrls"] = [];
  const screenings = new Map<string, Showtime[]>();
  const retained: RawMovie[] = [];
  for (const movie of Object.values(data.movies).sort((a, b) => a.id.localeCompare(b.id, "en"))) {
    const rows: Showtime[] = [];
    const seen = new Set<string>();
    for (const performance of movie.performances) {
      if (performance.time < config.now.getTime()) {
        expiredScreenings++;
        continue;
      }
      const showing = movie.showings[performance.showingId]!;
      const formats = sorted(Object.values(performance.format ?? {}));
      const booking = httpUrl.safeParse(performance.bookingUrl);
      if (!booking.success)
        invalidBookingUrls.push({ movieId: movie.id, showingId: performance.showingId });
      const row: Showtime = {
        venue: showing.venueId,
        time: performance.time,
        localTime: londonTime(performance.time).time,
        bookingUrl: booking.success ? booking.data : showing.url,
        bookingFallback: !booking.success,
        screen: performance.screen || null,
        notes: performance.notes || null,
        category: showing.category,
        formats: formats.length ? formats : ["standard"],
        accessibility: Object.entries(performance.accessibility ?? {})
          .filter(([, enabled]) => enabled)
          .map(([key]) => key)
          .sort(),
        soldOut: performance.status?.soldOut ?? false,
      };
      const signature = JSON.stringify(row);
      if (seen.has(signature)) {
        duplicateScreenings++;
        continue;
      }
      seen.add(signature);
      rows.push(row);
    }
    rows.sort(
      (a, b) =>
        a.time - b.time ||
        a.venue.localeCompare(b.venue, "en") ||
        a.bookingUrl.localeCompare(b.bookingUrl, "en"),
    );
    if (rows.length || (movie.releaseDate && movie.releaseDate > today)) {
      retained.push(movie);
      screenings.set(movie.id, rows);
    }
  }
  if (!retained.length)
    throw new Error(
      "No current films remain after removing expired screenings; refusing to publish an empty dataset",
    );
  const allRows = [...screenings.values()].flat();
  const languages = sorted(
    retained.map((movie) => movie.originalLanguage || (movie.isUnmatched ? "unknown" : "en")),
  );
  const languageNames = new Intl.DisplayNames(["en"], { type: "language" });
  const facets: DataMeta["facets"] = {
    day: options(
      sorted(allRows.map((row) => londonTime(row.time).date)).map((date) => [date, date]),
    ),
    time: options([
      ["morning", "Morning"],
      ["afternoon", "Afternoon"],
      ["evening", "Evening"],
    ]),
    venue: options(venues.map((venue) => [venue.id, venue.name])),
    borough: options(boroughs.map((borough) => [borough.id, borough.name])),
    format: options(
      sorted(allRows.flatMap((row) => row.formats)).map((id) => [id, formatLabels[id] ?? id]),
    ),
    accessibility: options(Object.entries(accessLabels)),
    membership: options(MEMBERSHIPS.map((membership) => [membership.id, membership.label])),
    genre: options(
      Object.values(data.genres)
        .sort((a, b) => a.id.localeCompare(b.id, "en"))
        .map((genre) => [genre.id, genre.name]),
    ),
    language: options(
      languages.map((id) => [
        id,
        id === "unknown" ? "Unknown language" : (languageNames.of(id) ?? id),
      ]),
    ),
  };
  if (facets.format.length > 31)
    throw new Error(
      "More than 31 format options; increase the screening mask capacity before publishing",
    );
  const indexes = Object.fromEntries(
    keys.map((key) => [key, new Map(facets[key].map((option, index) => [option.id, index]))]),
  ) as Record<FacetKey, Map<string, number>>;
  const indexOf = (key: FacetKey, id: string): number => {
    const index = indexes[key].get(id);
    if (index === undefined) throw new Error(`Unknown ${key} facet ${id}`);
    return index;
  };
  const mask = (key: "format" | "accessibility", ids: string[]) =>
    ids.reduce((value, id) => value + 2 ** indexOf(key, id), 0);
  const films: Film[] = retained.map((movie) => {
    const rows = screenings.get(movie.id)!;
    const language = movie.originalLanguage || (movie.isUnmatched ? "unknown" : "en");
    const releaseDate = movie.releaseDate || null;
    const releaseTime = releaseDate ? Date.parse(`${releaseDate}T00:00:00Z`) : null;
    const year = movie.year ? Number(movie.year) : null;
    const filmVenues = sorted(rows.map((row) => row.venue));
    const selections: Record<FacetKey, string[]> = {
      day: sorted(rows.map((row) => londonTime(row.time).date)),
      time: sorted(rows.map((row) => londonTime(row.time).band)),
      venue: filmVenues,
      borough: sorted(filmVenues.map((id) => venueMap.get(id)!.borough)),
      format: sorted(rows.flatMap((row) => row.formats)),
      accessibility: sorted(rows.flatMap((row) => row.accessibility)),
      membership: sorted(filmVenues.flatMap((id) => venueMap.get(id)!.memberships)),
      genre: sorted(movie.genres),
      language: [language],
    };
    const fa = Object.fromEntries(
      keys.map((key) => {
        const indices = selections[key].map((id) => indexOf(key, id));
        for (const index of indices) facets[key][index]!.count++;
        return [key, encodeBitset(indices, facets[key].length)];
      }),
    ) as Film["fa"];
    return {
      id: movie.id,
      ti: movie.title,
      o_ti: movie.originalTitle && movie.originalTitle !== movie.title ? movie.originalTitle : null,
      di: movie.directors.map((id) => ({ id, name: data.people[id]!.name })),
      ye: year,
      rd: releaseDate,
      ru: movie.duration ? Math.round(movie.duration / 60_000) : null,
      cl: movie.classification || null,
      po: movie.posterPath ? `https://image.tmdb.org/t/p/w342${movie.posterPath}` : null,
      tr: movie.youtubeTrailer ? `https://www.youtube.com/watch?v=${movie.youtubeTrailer}` : null,
      la: language,
      ge: movie.genres,
      ra: ratings(movie.id, matched),
      fa,
      sc: rows.map((row) => {
        const local = londonTime(row.time);
        return [
          indexOf("day", local.date),
          local.minute,
          indexOf("venue", row.venue),
          mask("format", row.formats),
          mask("accessibility", row.accessibility),
          row.soldOut ? 1 : 0,
        ];
      }),
      new:
        releaseTime !== null &&
        releaseTime <= calendarNow &&
        releaseTime >= calendarNow - NEW_RELEASE_DAYS * 86_400_000,
      classic:
        releaseTime !== null
          ? releaseTime < classicDate.getTime()
          : year !== null && year < Number(today.slice(0, 4)) - CLASSIC_YEARS,
      upcoming: releaseDate !== null && releaseDate > today,
      event: rows.some((row) => isEventScreening(row.category, row.notes)),
      retro: [],
      unmatched: movie.isUnmatched,
    };
  });
  const directorFilms = new Map<string, Set<string>>();
  for (const film of films.filter((film) => film.sc.length))
    for (const director of film.di) {
      if (!directorFilms.has(director.id)) directorFilms.set(director.id, new Set());
      directorFilms.get(director.id)!.add(film.id);
    }
  for (const film of films)
    film.retro = film.di
      .filter((director) => (directorFilms.get(director.id)?.size ?? 0) >= RETROSPECTIVE_MIN_FILMS)
      .map((director) => director.id);
  const showtimes: FilmShowtimes[] = films.map((film) => {
    const days: FilmShowtimes["days"] = {};
    for (const row of screenings.get(film.id)!) {
      const day = londonTime(row.time).date;
      (days[day] ??= []).push(row);
    }
    const movie = data.movies[film.id]!;
    return {
      id: film.id,
      details: {
        actors: movie.actors.slice(0, 3).map((id) => ({ id, name: data.people[id]!.name })),
        overview: movie.overview || null,
      },
      days,
    };
  });
  const meta: DataMeta = {
    schemaVersion: DATA_SCHEMA_VERSION,
    generatedAt: config.now.toISOString(),
    upstreamGeneratedAt: data.generatedAt,
    sources: config.sources,
    releaseDateSource: "tmdb-original",
    venues,
    boroughs,
    memberships: [...MEMBERSHIPS],
    facets,
    counts: {
      films: films.length,
      screenings: allRows.length,
      venues: facets.venue.filter((option) => option.count > 0).length,
    },
    diagnostics: {
      expiredScreenings,
      duplicateScreenings,
      invalidBookingUrls,
      outsideLondonVenues: venues
        .filter((venue) => venue.borough === "outside-london")
        .map((venue) => venue.id),
    },
  };
  return { films, meta, showtimes };
}
