import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "public/data",
      "src/generated",
      ".cache",
      "node_modules",
      ".wrangler",
      "test-results",
      "playwright-report",
      "mobile/.expo",
      "mobile/dist",
      "mobile/ios",
      "mobile/android",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Core runs in the browser and in the app; it must not reach for browser-only globals.
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...["window", "document", "localStorage", "navigator", "location", "fetch"].map((name) => ({
          name,
          message: "Core is shared with the app; pass this in instead.",
        })),
      ],
    },
  },
);
