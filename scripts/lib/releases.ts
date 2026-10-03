import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { SourceRelease } from "../../src/shared/data";
import { httpUrl } from "./schemas";

const assetSchema = z.object({
  id: z.number(),
  name: z.string(),
  size: z.number().int().positive(),
  updated_at: z.string(),
  browser_download_url: httpUrl,
});
const releaseSchema = z.object({
  tag_name: z.string().min(1),
  published_at: z.iso.datetime({ offset: true }),
  assets: z.array(assetSchema),
});
type Release = z.infer<typeof releaseSchema>;
type Asset = z.infer<typeof assetSchema>;
export type Fetch = typeof fetch;
const MAX_ASSET_BYTES = 30 * 1024 * 1024;

async function getResponse(
  url: string,
  fetcher: Fetch,
  headers: Record<string, string> = {},
): Promise<Response> {
  const response = await fetcher(url, { headers, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status} for ${url}`);
  return response;
}
async function latest(repository: string, fetcher: Fetch): Promise<Release> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "london-cine-info-data-build",
  };
  // Send credentials only to the GitHub API. Release assets use public URLs.
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  const response = await getResponse(
    `https://api.github.com/repos/${repository}/releases/latest`,
    fetcher,
    headers,
  );
  return releaseSchema.parse(await response.json());
}
async function downloadAsset(
  repository: string,
  release: Release,
  name: string,
  cacheDir: string,
  fetcher: Fetch,
): Promise<unknown> {
  const asset: Asset | undefined = release.assets.find((entry) => entry.name === name);
  if (!asset)
    throw new Error(`${repository}@${release.tag_name} is missing required asset ${name}`);
  if (asset.size > MAX_ASSET_BYTES)
    throw new Error(`${name} exceeds the ${MAX_ASSET_BYTES}-byte download limit`);
  const url = new URL(asset.browser_download_url);
  if (
    url.origin !== "https://github.com" ||
    !url.pathname.startsWith(`/${repository}/releases/download/`)
  )
    throw new Error(`Unexpected release asset host/path for ${name}`);
  const cacheKey = createHash("sha256")
    .update(`${release.tag_name}:${asset.id}:${asset.updated_at}`)
    .digest("hex")
    .slice(0, 16);
  const directory = join(cacheDir, repository.replace("/", "-"));
  const file = join(directory, `${cacheKey}-${name}`);
  let content: Buffer | undefined;
  try {
    const cached = await readFile(file);
    if (cached.length === asset.size) content = cached;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (!content) {
    const response = await getResponse(asset.browser_download_url, fetcher);
    content = Buffer.from(await response.arrayBuffer());
    if (content.length !== asset.size)
      throw new Error(`${name}: expected ${asset.size} bytes, received ${content.length}`);
    await mkdir(directory, { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await writeFile(temporary, content);
    await rename(temporary, file);
  }
  try {
    return JSON.parse(content.toString("utf8")) as unknown;
  } catch {
    throw new Error(`${repository}@${release.tag_name}/${name} is not valid JSON`);
  }
}
export async function loadLiveData(
  cacheDir: string,
  fetcher: Fetch = fetch,
): Promise<{
  combined: unknown;
  matched: unknown;
  sources: { combined: SourceRelease; matched: SourceRelease };
}> {
  const combinedRepository = "clusterflick/data-combined",
    matchedRepository = "clusterflick/data-matched";
  const [combinedRelease, matchedRelease] = await Promise.all([
    latest(combinedRepository, fetcher),
    latest(matchedRepository, fetcher),
  ]);
  const files = ["letterboxd", "imdb", "metacritic", "rottentomatoes"] as const;
  const [combined, ...ratings] = await Promise.all([
    downloadAsset(combinedRepository, combinedRelease, "combined-data.json", cacheDir, fetcher),
    ...files.map((name) =>
      downloadAsset(matchedRepository, matchedRelease, `${name}.json`, cacheDir, fetcher),
    ),
  ]);
  const matched = Object.fromEntries(files.map((name, index) => [name, ratings[index]]));
  const source = (repository: string, release: Release): SourceRelease => ({
    repository,
    tag: release.tag_name,
    publishedAt: release.published_at,
  });
  return {
    combined,
    matched,
    sources: {
      combined: source(combinedRepository, combinedRelease),
      matched: source(matchedRepository, matchedRelease),
    },
  };
}
