export type Query = { sql: string; params?: (string | number | null)[] };
export async function d1<T = Record<string, unknown>>(batch: Query[]): Promise<T[][]> {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID,
    key = process.env.CLOUDFLARE_API_TOKEN;
  const database = process.env.D1_DATABASE_ID ?? "6e60fb1a-f987-4ae4-aede-f2b418f2c970";
  if (!account || !key) throw new Error("Cloudflare account and D1 API token are required");
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ batch }),
      signal: AbortSignal.timeout(60000),
    },
  );
  const data = (await response.json()) as {
    success: boolean;
    result: { success: boolean; results: T[] }[];
  };
  if (
    !response.ok ||
    !data.success ||
    !Array.isArray(data.result) ||
    data.result.some((row) => !row.success)
  )
    throw new Error(`D1 query failed (${response.status})`);
  return data.result.map((row) => row.results);
}
