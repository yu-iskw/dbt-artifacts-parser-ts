import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@web": path.resolve(__dirname, "packages/dbt-tools/web/src"),
      "@dbt-tools/core/browser": path.resolve(
        __dirname,
        "packages/dbt-tools/core/src/browser.ts",
      ),
      "@dbt-tools/core": path.resolve(
        __dirname,
        "packages/dbt-tools/core/src/index.ts",
      ),
      "dbt-artifacts-parser/manifest": path.resolve(
        __dirname,
        "packages/dbt-artifacts-parser/src/manifest/index.ts",
      ),
      "dbt-artifacts-parser/run_results": path.resolve(
        __dirname,
        "packages/dbt-artifacts-parser/src/run_results/index.ts",
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
