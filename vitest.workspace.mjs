import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/dbt-artifacts-parser",
  "packages/dbt-tools/core",
  "packages/dbt-tools/cli",
]);
