import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dbtTargetPlugin } from "./src/dbt-target-plugin";

export default defineConfig({
  plugins: [dbtTargetPlugin(), react()],
  server: {
    port: 5173,
  },
  resolve: {
    // Resolve @dbt-tools/core from its TypeScript source in dev so that Vite
    // always sees the latest code without needing a `pnpm build` or a cache
    // clear. The compiled dist/ is still used for the production build (the
    // alias only applies when "vite dev" processes imports).
    alias: {
      "@web": path.resolve(__dirname, "src"),
      "@dbt-tools/core/browser": path.resolve(
        __dirname,
        "../core/src/browser.ts",
      ),
      "@dbt-tools/core": path.resolve(__dirname, "../core/src/index.ts"),
      "dbt-artifacts-parser/manifest": path.resolve(
        __dirname,
        "../../dbt-artifacts-parser/src/manifest/index.ts",
      ),
      "dbt-artifacts-parser/run_results": path.resolve(
        __dirname,
        "../../dbt-artifacts-parser/src/run_results/index.ts",
      ),
      "dbt-artifacts-parser/catalog": path.resolve(
        __dirname,
        "../../dbt-artifacts-parser/src/catalog/index.ts",
      ),
    },
  },
  optimizeDeps: {
    // dbt-artifacts-parser sub-entry-points use CJS internally, so they still
    // need Vite's dep-optimisation step. @dbt-tools/core is now aliased to its
    // TypeScript source and processed natively — no pre-bundling needed.
    include: [
      "dbt-artifacts-parser/manifest",
      "dbt-artifacts-parser/run_results",
    ],
  },
});
