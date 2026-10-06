import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [preact()],
  server: {
    proxy: process.env.ACCOUNTS_API_URL
      ? { "/api": { target: process.env.ACCOUNTS_API_URL, changeOrigin: false } }
      : undefined,
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { target: "es2022", sourcemap: false },
});
