import {
  DATA_SCHEMA_VERSION,
  type DataManifest,
  type Film,
  type DataMeta,
  type EventOccurrence,
  type FilmShowtimes,
} from "./data";
export class CatalogueVersionError extends Error {}
export function validateManifest(value: unknown): asserts value is DataManifest {
  const manifest = value as DataManifest | null;
  if (
    !manifest ||
    !Number.isInteger(manifest.schemaVersion) ||
    manifest.schemaVersion < 1 ||
    !Number.isFinite(Date.parse(manifest.generatedAt)) ||
    ![manifest.films, manifest.meta, manifest.events, manifest.showtimes].every(
      (path) =>
        typeof path === "string" && /^\/data\/[A-Za-z0-9._/-]+$/.test(path) && !path.includes(".."),
    )
  )
    throw new Error("The screening data is incompatible. Please reload the page.");
  if (manifest.schemaVersion > DATA_SCHEMA_VERSION)
    throw new CatalogueVersionError(
      "Update the app to read the latest listings. Your saved catalogue is still available.",
    );
}
export function validateCatalogue(
  manifest: DataManifest,
  films: unknown,
  meta: unknown,
  events: unknown,
): { films: Film[]; meta: DataMeta; events: EventOccurrence[] } {
  validateManifest(manifest);
  const metadata = meta as DataMeta | null;
  if (
    !metadata ||
    metadata.schemaVersion !== manifest.schemaVersion ||
    metadata.generatedAt !== manifest.generatedAt ||
    !Array.isArray(films) ||
    !Array.isArray(events) ||
    films.length !== metadata.counts?.films ||
    !Array.isArray(metadata.venues) ||
    !metadata.facets ||
    !films.every(
      (film) =>
        film &&
        typeof film.id === "string" &&
        typeof film.ti === "string" &&
        Array.isArray(film.sc) &&
        Array.isArray(film.di) &&
        film.ra &&
        film.fa,
    ) ||
    !events.every(
      (event) =>
        event &&
        typeof event.id === "string" &&
        typeof event.filmId === "string" &&
        Number.isFinite(event.time),
    )
  )
    throw new Error("The screening data is incompatible. Please reload the page.");
  return { films: films as Film[], meta: metadata, events: events as EventOccurrence[] };
}
export function validateShowtimes(id: string, value: unknown): FilmShowtimes {
  const result = value as FilmShowtimes | null;
  if (
    !result ||
    result.id !== id ||
    !result.days ||
    !result.details ||
    !Object.values(result.days).every(
      (rows) =>
        Array.isArray(rows) &&
        rows.every((row) => typeof row.bookingUrl === "string" && Number.isFinite(row.time)),
    )
  )
    throw new Error("The screening details are incompatible. Please reload the page.");
  return result;
}
export function resolveDataUrl(base: string, path: string): string {
  const url = new URL(path, base);
  if (
    url.origin !== new URL(base).origin ||
    !/^https?:$/.test(url.protocol) ||
    !url.pathname.startsWith("/data/")
  )
    throw new Error("Invalid catalogue URL.");
  return url.href;
}
