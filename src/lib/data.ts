import manifest from "../generated/manifest.json";
import { DATA_SCHEMA_VERSION, type DataMeta, type Film, type FilmShowtimes } from "../shared/data";

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`The data request returned HTTP ${response.status}.`);
  return (await response.json()) as T;
}
export async function loadCatalogue(
  signal: AbortSignal,
): Promise<{ films: Film[]; meta: DataMeta }> {
  const [films, meta] = await Promise.all([
    fetchJson<Film[]>(manifest.films, signal),
    fetchJson<DataMeta>(manifest.meta, signal),
  ]);
  if (
    manifest.schemaVersion !== DATA_SCHEMA_VERSION ||
    meta.schemaVersion !== DATA_SCHEMA_VERSION ||
    !Array.isArray(films) ||
    films.length !== meta.counts.films
  )
    throw new Error("The screening data is incompatible. Please reload the page.");
  return { films, meta };
}
const showtimeCache = new Map<string, Promise<FilmShowtimes>>();
export function loadShowtimes(id: string): Promise<FilmShowtimes> {
  const cached = showtimeCache.get(id);
  if (cached) return cached;
  const pending = fetchJson<FilmShowtimes>(`${manifest.showtimes}${encodeURIComponent(id)}.json`)
    .then((result) => {
      if (result.id !== id || !result.days || !result.details)
        throw new Error("The screening details are incompatible. Please reload the page.");
      return result;
    })
    .catch((error: unknown) => {
      showtimeCache.delete(id);
      throw error;
    });
  showtimeCache.set(id, pending);
  return pending;
}
