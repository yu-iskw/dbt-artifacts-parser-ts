#!/usr/bin/env node
/**
 * Compare checked-in artifact JSON schemas with the published copies on
 * schemas.getdbt.com (via the dbt-labs/schemas.getdbt.com GitHub mirror).
 *
 * This is a schema-contract canary, not a live dbt artifact generator.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const SCHEMA_REPO =
  "https://raw.githubusercontent.com/dbt-labs/schemas.getdbt.com/main";

const CHECKS = [
  {
    name: "freshness v0 status enum",
    local:
      "packages/dbt-artifacts-parser/resources/json-schema/freshness/freshness_v0.json",
    remote: `${SCHEMA_REPO}/dbt/freshness/v0.json`,
    path: ["properties", "results", "items", "properties", "status", "enum"],
    expected: ["Pass", "Warn", "Error"],
  },
  {
    name: "sources v3 output status enum",
    local:
      "packages/dbt-artifacts-parser/resources/json-schema/sources/sources_v3.json",
    remote: `${SCHEMA_REPO}/dbt/sources/v3.json`,
    path: [
      "properties",
      "results",
      "items",
      "anyOf",
      1,
      "properties",
      "status",
      "enum",
    ],
    expected: ["pass", "warn", "error", "runtime error"],
  },
];

function getPath(value, path) {
  let current = value;
  for (const key of path) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function readLocalJson(relPath) {
  return JSON.parse(readFileSync(join(projectRoot, relPath), "utf-8"));
}

async function readRemoteJson(url) {
  const headers = { "User-Agent": "dbt-artifacts-parser-ts-schema-canary" };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

function formatValue(value) {
  return JSON.stringify(value);
}

async function run() {
  const failures = [];

  for (const check of CHECKS) {
    const localSchema = readLocalJson(check.local);
    const remoteSchema = await readRemoteJson(check.remote);
    const localValue = getPath(localSchema, check.path);
    const remoteValue = getPath(remoteSchema, check.path);

    if (formatValue(localValue) !== formatValue(check.expected)) {
      failures.push(
        `${check.name}: local ${formatValue(localValue)} != expected ${formatValue(check.expected)}`,
      );
    }
    if (formatValue(remoteValue) !== formatValue(check.expected)) {
      failures.push(
        `${check.name}: upstream ${formatValue(remoteValue)} != expected ${formatValue(check.expected)}`,
      );
    }
    if (formatValue(localValue) !== formatValue(remoteValue)) {
      failures.push(
        `${check.name}: local ${formatValue(localValue)} != upstream ${formatValue(remoteValue)}`,
      );
    }
  }

  if (failures.length > 0) {
    console.error("Artifact schema canary failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Artifact schema canary passed.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
