import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import { loadLiveData } from "./releases";

const roots: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

it("caches release assets by identity and update time, and never sends the API token to downloads", async () => {
  const root = await mkdtemp(join(tmpdir(), "london-cine-cache-"));
  roots.push(root);
  vi.stubEnv("GH_TOKEN", "fixture-token");
  let tag = "v1",
    updatedAt = "2026-10-03T08:00:00Z";
  const calls: { url: string; authorization: string | null }[] = [];
  const body = JSON.stringify({ fixture: true });
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, authorization: new Headers(init?.headers).get("Authorization") });
    if (url.includes("api.github.com")) {
      const repository = url.includes("data-combined")
        ? "clusterflick/data-combined"
        : "clusterflick/data-matched";
      const names = repository.endsWith("data-combined")
        ? ["combined-data.json"]
        : ["letterboxd.json", "imdb.json", "metacritic.json", "rottentomatoes.json"];
      return Response.json({
        tag_name: tag,
        published_at: "2026-10-03T08:00:00Z",
        assets: names.map((name, index) => ({
          id: index + 1,
          name,
          size: Buffer.byteLength(body),
          updated_at: updatedAt,
          browser_download_url: `https://github.com/${repository}/releases/download/${tag}/${name}`,
        })),
      });
    }
    return new Response(body);
  };
  const first = await loadLiveData(root, fetcher);
  expect(first.combined).toEqual({ fixture: true });
  expect(first.sources.combined.tag).toBe("v1");
  expect(calls).toHaveLength(7);
  expect(
    calls
      .filter((call) => call.url.includes("api.github.com"))
      .every((call) => call.authorization === "Bearer fixture-token"),
  ).toBe(true);
  expect(
    calls
      .filter((call) => !call.url.includes("api.github.com"))
      .every((call) => call.authorization === null),
  ).toBe(true);
  await loadLiveData(root, fetcher);
  expect(calls).toHaveLength(9); // only the two latest-release requests
  updatedAt = "2026-10-03T09:00:00Z";
  await loadLiveData(root, fetcher);
  expect(calls).toHaveLength(16); // assets edited under the same tag invalidate the cache
  tag = "v2";
  await loadLiveData(root, fetcher);
  expect(calls).toHaveLength(23);
});

it("fails on missing assets and HTTP errors rather than serving stale cached data", async () => {
  const root = await mkdtemp(join(tmpdir(), "london-cine-cache-"));
  roots.push(root);
  const noAssets: typeof fetch = async () =>
    Response.json({ tag_name: "v1", published_at: "2026-10-03T08:00:00Z", assets: [] });
  await expect(loadLiveData(root, noAssets)).rejects.toThrow(/missing required asset/);
  const unavailable: typeof fetch = async () => new Response("unavailable", { status: 503 });
  await expect(loadLiveData(root, unavailable)).rejects.toThrow(/HTTP 503/);
});
