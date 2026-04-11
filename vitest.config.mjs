import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";
import { createSharedSourceEntryAliases } from "./tooling/source-entry-aliases.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedAliases = createSharedSourceEntryAliases(__dirname);

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      "@web": path.resolve(__dirname, "packages/dbt-tools/web/src"),
      ...sharedAliases,
      "dbt-artifacts-parser/test-utils": path.resolve(
        __dirname,
        "packages/dbt-artifacts-parser/src/test-utils.ts",
      ),
    },
  },
  test: {
    include: ["packages/**/*.test.ts", "packages/**/*.test.tsx"],
    exclude: [".trunk/**", "node_modules/**"],
    pool: "threads",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "json"],
      include: ["packages/**/src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.generated.ts",
        "**/test-utils.ts",
      ],
      reportsDirectory: "coverage",
      thresholds: {
        lines: 60,
        branches: 50,
        functions: 60,
        statements: 60,
      },
    },
  },
});
