import path from "node:path";

export function createSharedSourceEntryAliases(projectRoot) {
  return {
    "@dbt-tools/core/browser": path.resolve(
      projectRoot,
      "packages/dbt-tools/core/src/browser.ts",
    ),
    "@dbt-tools/core": path.resolve(
      projectRoot,
      "packages/dbt-tools/core/src/index.ts",
    ),
    "dbt-artifacts-parser/manifest": path.resolve(
      projectRoot,
      "packages/dbt-artifacts-parser/src/manifest/index.ts",
    ),
    "dbt-artifacts-parser/run_results": path.resolve(
      projectRoot,
      "packages/dbt-artifacts-parser/src/run_results/index.ts",
    ),
    "dbt-artifacts-parser/catalog": path.resolve(
      projectRoot,
      "packages/dbt-artifacts-parser/src/catalog/index.ts",
    ),
    "dbt-artifacts-parser/sources": path.resolve(
      projectRoot,
      "packages/dbt-artifacts-parser/src/sources/index.ts",
    ),
  };
}
