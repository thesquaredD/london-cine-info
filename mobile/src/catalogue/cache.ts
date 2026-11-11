import { parseManifest, validateCatalogue } from "@readograph/core/catalogue-loader";
import { ACCEPTED_SCHEMAS, type CatalogueCache, type CatalogueEntry } from "./loader";

/**
 * The catalogue cache: one JSON file per generation in the app's cache directory.
 *
 * A write goes to a new file named after the manifest's `generatedAt`, and only once that file
 * is complete are the older generations deleted. A read takes the newest file that parses and
 * passes the same checks as a download. So an interrupted write (the app killed mid-write, a
 * full disk) leaves a file that fails to parse, and the previous generation is used: the swap
 * is atomic from the reader's point of view without relying on an atomic rename.
 *
 * The directory itself is abstracted as `CacheFiles` so these rules run under Vitest; the app
 * passes `expoCacheFiles()` from `files.ts`.
 */

export interface CacheFiles {
  /** File names in the cache directory (not paths). */
  list(): Promise<string[]>;
  read(name: string): Promise<string>;
  write(name: string, text: string): Promise<void>;
  remove(name: string): Promise<void>;
}

const PREFIX = "catalogue-";
const SUFFIX = ".json";

/** A file name that sorts in generation order: `catalogue-2026-11-10T06-45-00-000Z.json`. */
export function entryFileName(generatedAt: string): string {
  return `${PREFIX}${new Date(generatedAt).toISOString().replace(/[:.]/g, "-")}${SUFFIX}`;
}

const isEntryFile = (name: string) => name.startsWith(PREFIX) && name.endsWith(SUFFIX);

/** Re-checks a stored entry; returns null for anything this build cannot read. */
export function decodeEntry(text: string): CatalogueEntry | null {
  try {
    const value = JSON.parse(text) as { manifest?: unknown; catalogue?: Record<string, unknown> };
    const manifest = parseManifest(value.manifest, ACCEPTED_SCHEMAS);
    const { films, meta, events } = value.catalogue ?? {};
    return {
      manifest,
      catalogue: validateCatalogue(manifest, films, meta, events, ACCEPTED_SCHEMAS),
    };
  } catch {
    return null;
  }
}

export function createCatalogueCache(files: CacheFiles): CatalogueCache {
  return {
    async read() {
      let names: string[];
      try {
        names = (await files.list()).filter(isEntryFile).sort().reverse();
      } catch {
        return null;
      }
      for (const name of names) {
        try {
          const entry = decodeEntry(await files.read(name));
          if (entry) return entry;
        } catch {
          // Unreadable: try the previous generation.
        }
      }
      return null;
    },
    async write(entry) {
      const name = entryFileName(entry.manifest.generatedAt);
      await files.write(name, JSON.stringify(entry));
      // The new generation is complete; older ones (and any partial write) can go.
      for (const other of await files.list())
        if (other !== name && isEntryFile(other)) await files.remove(other).catch(() => undefined);
    },
  };
}
