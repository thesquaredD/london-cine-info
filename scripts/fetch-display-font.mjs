/* global fetch, AbortSignal */
import { URL } from "node:url";
import { Buffer } from "node:buffer";
// Fontshare permits own-site self-hosting, but not distributing font files in this public repo.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const target = new URL("../public/fonts/fontshare/clash-display-500.woff2", import.meta.url);
const expected = "6de911fc824613ef7325c617b359262bedba2dd6499e7e93794fc9414ca24960";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
let cached;
try {
  cached = await readFile(target);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (!cached || hash(cached) !== expected) {
  const response = await fetch(
    "https://cdn.fontshare.com/wf/2GQIT54GKQY3JRFTSHS4ARTRNRQISSAA/3CIP5EBHRRHE5FVQU3VFROPUERNDSTDF/JTSL5QESUXATU47LCPUNHZQBDDIWDOSW.woff2",
    { signal: AbortSignal.timeout(30000) },
  );
  if (!response.ok) throw new Error(`Display font download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (hash(bytes) !== expected) throw new Error("Display font differs from the reviewed version");
  await mkdir(new URL(".", target), { recursive: true });
  await writeFile(target, bytes);
}
