import {
  DATA_SCHEMA_VERSION,
  type DataManifest,
  type DataMeta,
  type EventOccurrence,
  type Film,
  type FilmShowtimes,
} from "./data";

/**
 * Checks for the screening data files, shared by the website and the app. Neither side's
 * network code lives here: the caller fetches the manifest and the files it names and passes
 * the parsed JSON in. The website reads its manifest from the build; the app reads
 * `/catalogue.json` (the same object) from `SITE_ORIGIN`.
 */

export type Catalogue = { films: Film[]; meta: DataMeta; events: EventOccurrence[] };

/**
 * Thrown when downloaded data does not match what this build understands. `newerSchema` is
 * true when the data was published with a schema version above every accepted one, which on
 * the app means "update the app", not "try again".
 */
export class IncompatibleDataError extends Error {
  readonly newerSchema: boolean;
  constructor(message: string, newerSchema = false) {
    super(message);
    this.name = "IncompatibleDataError";
    this.newerSchema = newerSchema;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// A root-relative path such as `/data/films.0123.json`. Rejecting `//host` and absolute URLs
// keeps every data request on the origin the manifest came from.
const isDataPath = (value: unknown): value is string =>
  typeof value === "string" && /^\/(?![/\\])[^\s\\]*$/.test(value);

function checkSchema(version: unknown, accepted: readonly number[], what: string) {
  if (typeof version === "number" && accepted.includes(version)) return;
  const newer = typeof version === "number" && accepted.every((known) => version > known);
  throw new IncompatibleDataError(
    `The ${what} uses schema version ${String(version)}; this build reads ${accepted.join(", ")}.`,
    newer,
  );
}

/**
 * Parses a manifest read from `/catalogue.json`. The website does not need this (its
 * manifest is compiled in); the app does, because the response is untrusted JSON.
 */
export function parseManifest(
  value: unknown,
  accepted: readonly number[] = [DATA_SCHEMA_VERSION],
): DataManifest {
  if (!isRecord(value)) throw new IncompatibleDataError("The catalogue manifest is not an object.");
  checkSchema(value.schemaVersion, accepted, "catalogue manifest");
  const { schemaVersion, generatedAt, films, meta, showtimes, events } = value;
  if (typeof generatedAt !== "string" || Number.isNaN(Date.parse(generatedAt)))
    throw new IncompatibleDataError("The catalogue manifest has no valid generatedAt.");
  if (![films, meta, events, showtimes].every(isDataPath) || !String(showtimes).endsWith("/"))
    throw new IncompatibleDataError("The catalogue manifest names an unexpected file path.");
  return {
    schemaVersion: schemaVersion as number,
    generatedAt,
    films: films as string,
    meta: meta as string,
    showtimes: showtimes as string,
    events: events as string,
  };
}

/** Checks the three catalogue files named by `manifest` and returns them typed. */
export function validateCatalogue(
  manifest: Pick<DataManifest, "schemaVersion">,
  films: unknown,
  meta: unknown,
  events: unknown,
  accepted: readonly number[] = [DATA_SCHEMA_VERSION],
): Catalogue {
  checkSchema(manifest.schemaVersion, accepted, "catalogue manifest");
  if (!isRecord(meta)) throw new IncompatibleDataError("The catalogue metadata is not an object.");
  checkSchema(meta.schemaVersion, accepted, "catalogue metadata");
  const counts = meta.counts;
  if (!Array.isArray(films) || !Array.isArray(events) || !isRecord(counts))
    throw new IncompatibleDataError("The catalogue files have an unexpected shape.");
  if (films.length !== counts.films)
    throw new IncompatibleDataError(
      `The catalogue lists ${films.length} films but its metadata counts ${String(counts.films)}.`,
    );
  return {
    films: films as Film[],
    meta: meta as DataMeta,
    events: events as EventOccurrence[],
  };
}

/** Checks one film's showtime file, fetched from `showtimesPath(manifest, id)`. */
export function validateShowtimes(id: string, result: unknown): FilmShowtimes {
  if (!isRecord(result) || result.id !== id || !result.days || !result.details)
    throw new IncompatibleDataError(`The showtime file for ${id} has an unexpected shape.`);
  return result as FilmShowtimes;
}

/** The root-relative path of one film's showtime file. */
export const showtimesPath = (manifest: Pick<DataManifest, "showtimes">, id: string) =>
  `${manifest.showtimes}${encodeURIComponent(id)}.json`;

/**
 * Resolves a manifest path against an origin, for callers that are not served from that
 * origin (the app passes `SITE_ORIGIN`). Throws for anything but a root-relative path, so a
 * manifest can never send requests to another host.
 */
export function resolveDataUrl(base: string, path: string): string {
  if (!isDataPath(path)) throw new IncompatibleDataError(`Not a data path: ${path}`);
  return new URL(path, base).href;
}
