import manifest from "../generated/manifest.json";
import {
  IncompatibleDataError,
  showtimesPath,
  validateCatalogue,
  validateShowtimes,
  type Catalogue,
} from "@readograph/core/catalogue-loader";
import type { DataMeta, EventOccurrence, Film, FilmShowtimes } from "@readograph/core/data";

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`The data request returned HTTP ${response.status}.`);
  return (await response.json()) as T;
}
// The shared checks explain what is wrong; readers of the website are told what to do.
function withReloadMessage<T>(message: string, check: () => T): T {
  try {
    return check();
  } catch (error) {
    if (error instanceof IncompatibleDataError) throw new Error(message, { cause: error });
    throw error;
  }
}
export async function loadCatalogue(signal: AbortSignal): Promise<Catalogue> {
  const [films, meta, events] = await Promise.all([
    fetchJson<Film[]>(manifest.films, signal),
    fetchJson<DataMeta>(manifest.meta, signal),
    fetchJson<EventOccurrence[]>(manifest.events, signal),
  ]);
  return withReloadMessage("The screening data is incompatible. Please reload the page.", () =>
    validateCatalogue(manifest, films, meta, events),
  );
}
const showtimeCache = new Map<string, Promise<FilmShowtimes>>();
export function loadShowtimes(id: string): Promise<FilmShowtimes> {
  const cached = showtimeCache.get(id);
  if (cached) return cached;
  const pending = fetchJson<unknown>(showtimesPath(manifest, id))
    .then((result) =>
      withReloadMessage("The screening details are incompatible. Please reload the page.", () =>
        validateShowtimes(id, result),
      ),
    )
    .catch((error: unknown) => {
      showtimeCache.delete(id);
      throw error;
    });
  showtimeCache.set(id, pending);
  return pending;
}
