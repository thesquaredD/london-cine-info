import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "mobile/dist",
      "mobile/.expo",
      "mobile/ios",
      "mobile/android",
      "public/data",
      "src/generated",
      ".cache",
      "node_modules",
      ".wrangler",
      "test-results",
      "playwright-report",
    ],
  },
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "localStorage",
        "navigator",
        "location",
        "fetch",
      ],
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);
