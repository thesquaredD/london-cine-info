import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { DATA_SCHEMA_VERSION, type DataManifest } from "../../src/shared/data";
import type { Dataset } from "./transform";

const hash = (content: string) => createHash("sha256").update(content).digest("hex").slice(0, 16);
const json = (value: unknown) => `${JSON.stringify(value)}\n`;
const exists = async (path: string) => {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
};

export async function writeDataset(dataset: Dataset, root: string): Promise<DataManifest> {
  // Leave space for Vite's entry points and static assets within Pages' 20k limit.
  if (dataset.showtimes.length > 19_900)
    throw new Error("Too many showtime files for Cloudflare Pages");
  const filmJson = json(dataset.films),
    metaJson = json(dataset.meta);
  const showtimes = dataset.showtimes.map((entry) => ({ id: entry.id, content: json(entry) }));
  for (const file of [
    { id: "films", content: filmJson },
    { id: "meta", content: metaJson },
    ...showtimes,
  ]) {
    if (Buffer.byteLength(file.content) > 25 * 1024 * 1024)
      throw new Error(`${file.id}: exceeds Cloudflare Pages' 25 MiB file limit`);
    if (!/^[A-Za-z0-9_-]+$/.test(file.id)) throw new Error(`Unsafe output filename: ${file.id}`);
  }
  const showtimeDigest = createHash("sha256");
  for (const file of showtimes) showtimeDigest.update(file.content);
  const showtimeDirectory = `showtimes.${showtimeDigest.digest("hex").slice(0, 16)}`;
  const filmFile = `films.${hash(filmJson)}.json`,
    metaFile = `meta.${hash(metaJson)}.json`;
  const manifest: DataManifest = {
    schemaVersion: DATA_SCHEMA_VERSION,
    generatedAt: dataset.meta.generatedAt,
    films: `/data/${filmFile}`,
    meta: `/data/${metaFile}`,
    showtimes: `/data/${showtimeDirectory}/`,
  };
  const buildId = randomUUID();
  const staging = join(root, ".cache", `output-${buildId}`);
  const destination = join(root, "public", "data");
  const backup = join(root, ".cache", `previous-output-${buildId}`);
  const manifestPath = join(root, "src", "generated", "manifest.json");
  const manifestTemp = `${manifestPath}.${buildId}.tmp`;
  let previousMoved = false,
    installed = false;
  try {
    await mkdir(join(staging, showtimeDirectory), { recursive: true });
    await writeFile(join(staging, filmFile), filmJson);
    await writeFile(join(staging, metaFile), metaJson);
    // Bound open file descriptors while writing thousands of small files.
    for (let i = 0; i < showtimes.length; i += 50)
      await Promise.all(
        showtimes
          .slice(i, i + 50)
          .map((file) =>
            writeFile(join(staging, showtimeDirectory, `${file.id}.json`), file.content),
          ),
      );
    await mkdir(join(root, "src", "generated"), { recursive: true });
    await mkdir(join(root, "public"), { recursive: true });
    await writeFile(manifestTemp, json(manifest));
    if (await exists(destination)) {
      await rename(destination, backup);
      previousMoved = true;
    }
    await rename(staging, destination);
    installed = true;
    await rename(manifestTemp, manifestPath);
  } catch (error) {
    if (installed) await rm(destination, { recursive: true, force: true });
    if (previousMoved) await rename(backup, destination);
    throw error;
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(manifestTemp, { force: true });
  }
  await rm(backup, { recursive: true, force: true });
  return manifest;
}
