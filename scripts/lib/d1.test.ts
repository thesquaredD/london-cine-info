import { it, expect, vi, afterEach } from "vitest";
import { d1 } from "./d1";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("uses the Cloudflare batch envelope with bound parameters and fails on partial errors", async () => {
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "synthetic-account");
  vi.stubEnv("CLOUDFLARE_API_TOKEN", "synthetic-test-token");
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, result: [{ success: true, results: [{ count: 1 }] }] }),
        { status: 200 },
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  const queries = [{ sql: "SELECT ? AS count", params: [1] }];
  expect(await d1(queries)).toEqual([[{ count: 1 }]]);
  expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({ batch: queries });
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify({ success: true, result: [{ success: false, results: [] }] }), {
      status: 200,
    }),
  );
  await expect(d1(queries)).rejects.toThrow("D1 query failed");
});
