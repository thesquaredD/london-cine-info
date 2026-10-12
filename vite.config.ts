import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Feedback reports which build someone was using.
let revision = process.env.GITHUB_SHA ?? "";
try {
  revision ||= execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
} catch {
  /* Not a git checkout. */
}

export default defineConfig({
  plugins: [preact()],
  define: { "import.meta.env.VITE_APP_REVISION": JSON.stringify(revision) },
  server: {
    proxy: process.env.ACCOUNTS_API_URL
      ? { "/api": { target: process.env.ACCOUNTS_API_URL, changeOrigin: false } }
      : undefined,
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { target: "es2022", sourcemap: false },
});
