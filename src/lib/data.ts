import { validateCatalogue, validateShowtimes } from "@lci/core/catalogue-loader";
import manifest from "../generated/manifest.json";
import { type DataMeta, type Film, type FilmShowtimes, type EventOccurrence } from "@lci/core/data";

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`The data request returned HTTP ${response.status}.`);
  return (await response.json()) as T;
}
export async function loadCatalogue(
  signal: AbortSignal,
): Promise<{ films: Film[]; meta: DataMeta; events: EventOccurrence[] }> {
  const [films, meta, events] = await Promise.all([
    fetchJson<Film[]>(manifest.films, signal),
    fetchJson<DataMeta>(manifest.meta, signal),
    fetchJson<EventOccurrence[]>(manifest.events, signal),
  ]);
  return validateCatalogue(manifest, films, meta, events);
}
const showtimeCache = new Map<string, Promise<FilmShowtimes>>();
export function loadShowtimes(id: string): Promise<FilmShowtimes> {
  const cached = showtimeCache.get(id);
  if (cached) return cached;
  const pending = fetchJson<FilmShowtimes>(`${manifest.showtimes}${encodeURIComponent(id)}.json`)
    .then((result) => {
      return validateShowtimes(id, result);
    })
    .catch((error: unknown) => {
      showtimeCache.delete(id);
      throw error;
    });
  showtimeCache.set(id, pending);
  return pending;
}
