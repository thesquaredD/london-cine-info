// Generates a local sample from catalogue data, never reads accounts or sends email.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { digestFilms, digestHtml, digestSubject, digestText } from "./lib/digest";
import { letterboxdSlug } from "../src/shared/account";
import type { DataManifest, DataMeta, Film, FilmShowtimes } from "../src/shared/data";
const output = resolve(process.argv[2] ?? ".cache/digest-sample.html");
const now = Date.parse(process.argv[3] ?? new Date().toISOString()) / 1000;
if (!Number.isFinite(now)) throw new Error("Supply an ISO date as the second argument");
const manifest = JSON.parse(await readFile("src/generated/manifest.json", "utf8")) as DataManifest;
const films = JSON.parse(await readFile(`public${manifest.films}`, "utf8")) as Film[];
const meta = JSON.parse(await readFile(`public${manifest.meta}`, "utf8")) as DataMeta;
const loadShowtimes = async (id: string) =>
  JSON.parse(await readFile(`public${manifest.showtimes}${id}.json`, "utf8")) as FilmShowtimes;
const all = await digestFilms(
  films,
  new Set(films.map((film) => letterboxdSlug(film.ra.lb?.url) ?? "")),
  [],
  now,
  loadShowtimes,
);
const sample = new Set(
  [...all.cards, ...all.also.slice(0, 4), ...all.later.slice(0, 6)].map((entry) => entry.slug),
);
const digest = await digestFilms(films, sample, [], now, loadShowtimes);
const base = "https://london-cine.info";
const unsubscribe = `${base}/unsubscribe?token=sample-not-valid`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, digestHtml(digest, meta.venues, base, unsubscribe));
await writeFile(
  output.replace(/\.html$/, "") + ".txt",
  digestText(digest, meta.venues, base, unsubscribe),
);
console.log(`${digestSubject(digest)}\nSample: ${output}\nNo email sent.`);
