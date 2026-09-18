import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseManifest } = require("../packages/dbt-artifacts-parser/dist/manifest/index.js");
const { parseRunResults } = require("../packages/dbt-artifacts-parser/dist/run_results/index.js");
const { parseSources } = require("../packages/dbt-artifacts-parser/dist/sources/index.js");
const { parseCatalog } = require("../packages/dbt-artifacts-parser/dist/catalog/index.js");

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const artifactDir = process.argv[2];
if (!artifactDir) {
  throw new Error("usage: check-dbt-v2-canary.mjs <artifact-dir>");
}

const rawManifest = loadJson(path.join(artifactDir, "manifest.json"));
const manifest = parseManifest(rawManifest);

const operationIds = Object.keys(rawManifest.nodes).filter((id) =>
  id.startsWith("operation."),
);
assert(operationIds.length > 0, "expected on-run-start operation node");
for (const id of operationIds) {
  assert(manifest.nodes[id], `${id} is missing after parsing`);
  const missingLegacyFields = ["config", "tags"].filter(
    (fieldName) => !(fieldName in rawManifest.nodes[id]),
  );
  if (missingLegacyFields.length > 0) {
    console.log(
      `dbt v2 operation node omits legacy fields: ${missingLegacyFields.join(", ")}`,
    );
  }
}

const unitTestId =
  "unit_test.dbt_v2_canary.unit_target.unit_target_returns_one";
assert(rawManifest.unit_tests?.[unitTestId], "unit test missing from manifest");
assert(
  rawManifest.unit_tests[unitTestId].overrides?.vars?.compatibility_mode === "'v2'",
  "unit-test overrides were not preserved",
);
assert(
  manifest.unit_tests?.[unitTestId]?.overrides?.vars?.compatibility_mode === "'v2'",
  "parsed unit-test overrides were not preserved",
);

const macroId = "macro.dbt_v2_canary.compat_macro";
assert(rawManifest.macros?.[macroId]?.arguments?.length, "macro arguments missing");
assert(manifest.macros?.[macroId]?.arguments?.length, "parsed macro arguments missing");

const rawRunResults = loadJson(path.join(artifactDir, "run_results.json"));
const runResults = parseRunResults(rawRunResults);
assert(runResults.results.length > 0, "run_results.json is empty");
assert(
  runResults.results.some((result) => result.static_analysis_off_reason != null),
  "expected a dbt v2 static_analysis_off_reason result field",
);

const rawSources = loadJson(path.join(artifactDir, "sources.json"));
const rawStatuses = new Set(rawSources.results.map((result) => result.status));
for (const status of rawStatuses) {
  assert(
    ["Pass", "Warn", "Error", "runtime error"].includes(status),
    `unexpected dbt v2 wire freshness status: ${status}`,
  );
}
const sources = parseSources(rawSources);
for (const result of sources.results) {
  assert(
    ["pass", "warn", "error", "runtime error"].includes(result.status),
    `freshness status was not normalized: ${result.status}`,
  );
}

const catalog = parseCatalog(loadJson(path.join(artifactDir, "catalog.json")));
assert(
  catalog.metadata.dbt_schema_version.endsWith("/catalog/v1.json"),
  "unexpected catalog schema version",
);
