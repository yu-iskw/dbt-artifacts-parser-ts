import * as fs from "fs";
import * as path from "path";
import { parseManifest } from "dbt-artifacts-parser/manifest";
import { resolveSafePath } from "../validation/input-validator";
import { parseRunResults } from "dbt-artifacts-parser/run_results";
import { parseCatalog } from "dbt-artifacts-parser/catalog";
import { parseSources } from "dbt-artifacts-parser/sources";
import type { ParsedManifest } from "dbt-artifacts-parser/manifest";
import type { ParsedRunResults } from "dbt-artifacts-parser/run_results";
import type { ParsedCatalog } from "dbt-artifacts-parser/catalog";
import type { ParsedSources } from "dbt-artifacts-parser/sources";
import { getDbtToolsTargetDirFromEnv } from "../config/dbt-tools-env";
import {
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
} from "./artifact-filenames";

/**
 * Resolved artifact file paths
 */
export interface ArtifactPaths {
  manifest: string;
  runResults: string;
  catalog?: string;
  sources?: string;
}

const DEFAULT_TARGET_DIR = "./target";

function resolveManifestPath(
  manifestPath?: string,
  targetDir?: string,
): string {
  if (manifestPath) {
    if (manifestPath.endsWith(".json")) {
      return resolveSafePath(manifestPath);
    }
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal — resolveSafePath validates manifestPath before join.
    return path.join(resolveSafePath(manifestPath), DBT_MANIFEST_JSON);
  }

  const effectiveTargetDir =
    targetDir || getDbtToolsTargetDirFromEnv() || DEFAULT_TARGET_DIR;
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal — resolveSafePath validates effectiveTargetDir before join.
  return path.join(resolveSafePath(effectiveTargetDir), DBT_MANIFEST_JSON);
}

function resolveRunResultsPath(
  runResultsPath?: string,
  targetDir?: string,
): string {
  if (runResultsPath) {
    if (runResultsPath.endsWith(".json")) {
      return resolveSafePath(runResultsPath);
    }
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal — resolveSafePath validates runResultsPath before join.
    return path.join(resolveSafePath(runResultsPath), DBT_RUN_RESULTS_JSON);
  }

  const effectiveTargetDir =
    targetDir || getDbtToolsTargetDirFromEnv() || DEFAULT_TARGET_DIR;
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal — resolveSafePath validates effectiveTargetDir before join.
  return path.join(resolveSafePath(effectiveTargetDir), DBT_RUN_RESULTS_JSON);
}

function resolveCatalogPath(catalogPath?: string, targetDir?: string): string {
  if (catalogPath) {
    if (catalogPath.endsWith(".json")) {
      return resolveSafePath(catalogPath);
    }
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal — resolveSafePath validates catalogPath before join.
    return path.join(resolveSafePath(catalogPath), DBT_CATALOG_JSON);
  }

  const effectiveTargetDir =
    targetDir || getDbtToolsTargetDirFromEnv() || DEFAULT_TARGET_DIR;
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal — resolveSafePath validates effectiveTargetDir before join.
  return path.join(resolveSafePath(effectiveTargetDir), DBT_CATALOG_JSON);
}

function resolveSourcesPath(sourcesPath?: string, targetDir?: string): string {
  if (sourcesPath) {
    if (sourcesPath.endsWith(".json")) {
      return resolveSafePath(sourcesPath);
    }
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal — resolveSafePath validates sourcesPath before join.
    return path.join(resolveSafePath(sourcesPath), DBT_SOURCES_JSON);
  }

  const effectiveTargetDir =
    targetDir || getDbtToolsTargetDirFromEnv() || DEFAULT_TARGET_DIR;
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal — resolveSafePath validates effectiveTargetDir before join.
  return path.join(resolveSafePath(effectiveTargetDir), DBT_SOURCES_JSON);
}

/**
 * Resolve artifact paths, defaulting to ./target directory
 */
export function resolveArtifactPaths(
  manifestPath?: string,
  runResultsPath?: string,
  targetDir?: string,
  catalogPath?: string,
  sourcesPath?: string,
): ArtifactPaths {
  const effectiveTargetDir =
    targetDir || getDbtToolsTargetDirFromEnv() || DEFAULT_TARGET_DIR;

  const resolved: ArtifactPaths = {
    manifest: resolveManifestPath(manifestPath, effectiveTargetDir),
    runResults: resolveRunResultsPath(runResultsPath, effectiveTargetDir),
    catalog: resolveCatalogPath(catalogPath, effectiveTargetDir),
    sources: resolveSourcesPath(sourcesPath, effectiveTargetDir),
  };

  return resolved;
}

/**
 * Load and parse manifest.json file
 */
export function loadManifest(manifestPath: string): ParsedManifest {
  const fullPath = resolveSafePath(manifestPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Manifest file not found: ${fullPath}`);
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  try {
    const manifestJson = JSON.parse(content) as Record<string, unknown>;
    return parseManifest(manifestJson);
  } catch (error) {
    throw new Error(
      `Failed to parse manifest file ${fullPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Load and parse run_results.json file
 */
export function loadRunResults(runResultsPath: string): ParsedRunResults {
  const fullPath = resolveSafePath(runResultsPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Run results file not found: ${fullPath}`);
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  try {
    const runResultsJson = JSON.parse(content) as Record<string, unknown>;
    return parseRunResults(runResultsJson);
  } catch (error) {
    throw new Error(
      `Failed to parse run results file ${fullPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Load and parse catalog.json file
 */
export function loadCatalog(catalogPath: string): ParsedCatalog {
  const fullPath = resolveSafePath(catalogPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Catalog file not found: ${fullPath}`);
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  try {
    const catalogJson = JSON.parse(content) as Record<string, unknown>;
    return parseCatalog(catalogJson);
  } catch (error) {
    throw new Error(
      `Failed to parse catalog file ${fullPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Load and parse sources.json file
 */
export function loadSources(sourcesPath: string): ParsedSources {
  const fullPath = resolveSafePath(sourcesPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Sources file not found: ${fullPath}`);
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  try {
    const sourcesJson = JSON.parse(content) as Record<string, unknown>;
    return parseSources(sourcesJson);
  } catch (error) {
    throw new Error(
      `Failed to parse sources file ${fullPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
