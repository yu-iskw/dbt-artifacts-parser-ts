import * as fs from "fs";
import * as path from "path";
import { parseManifest } from "dbt-artifacts-parser/manifest";
import { resolveSafePath } from "../validation/input-validator";
import { parseRunResults } from "dbt-artifacts-parser/run_results";
import { parseCatalog } from "dbt-artifacts-parser/catalog";
import type { ParsedManifest } from "dbt-artifacts-parser/manifest";
import type { ParsedRunResults } from "dbt-artifacts-parser/run_results";
import type { ParsedCatalog } from "dbt-artifacts-parser/catalog";
import { getDbtToolsTargetDirFromEnv } from "../config/dbt-tools-env";

/**
 * Resolved artifact file paths
 */
export interface ArtifactPaths {
  manifest: string;
  runResults: string;
  catalog?: string;
}

const DEFAULT_TARGET_DIR = "./target";
const MANIFEST_FILE = "manifest.json";
const RUN_RESULTS_FILE = "run_results.json";
const CATALOG_FILE = "catalog.json";

function resolveManifestPath(
  manifestPath?: string,
  targetDir?: string,
): string {
  if (manifestPath) {
    if (manifestPath.endsWith(".json")) {
      return resolveSafePath(manifestPath);
    }
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal — resolveSafePath validates manifestPath before join.
    return path.join(resolveSafePath(manifestPath), MANIFEST_FILE);
  }

  const effectiveTargetDir =
    targetDir || getDbtToolsTargetDirFromEnv() || DEFAULT_TARGET_DIR;
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal — resolveSafePath validates effectiveTargetDir before join.
  return path.join(resolveSafePath(effectiveTargetDir), MANIFEST_FILE);
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
    return path.join(resolveSafePath(runResultsPath), RUN_RESULTS_FILE);
  }

  const effectiveTargetDir =
    targetDir || getDbtToolsTargetDirFromEnv() || DEFAULT_TARGET_DIR;
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal — resolveSafePath validates effectiveTargetDir before join.
  return path.join(resolveSafePath(effectiveTargetDir), RUN_RESULTS_FILE);
}

function resolveCatalogPath(catalogPath?: string, targetDir?: string): string {
  if (catalogPath) {
    if (catalogPath.endsWith(".json")) {
      return resolveSafePath(catalogPath);
    }
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal — resolveSafePath validates catalogPath before join.
    return path.join(resolveSafePath(catalogPath), CATALOG_FILE);
  }

  const effectiveTargetDir =
    targetDir || getDbtToolsTargetDirFromEnv() || DEFAULT_TARGET_DIR;
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal — resolveSafePath validates effectiveTargetDir before join.
  return path.join(resolveSafePath(effectiveTargetDir), CATALOG_FILE);
}

/**
 * Resolve artifact paths, defaulting to ./target directory
 */
export function resolveArtifactPaths(
  manifestPath?: string,
  runResultsPath?: string,
  targetDir?: string,
  catalogPath?: string,
): ArtifactPaths {
  const effectiveTargetDir =
    targetDir || getDbtToolsTargetDirFromEnv() || DEFAULT_TARGET_DIR;

  const resolved: ArtifactPaths = {
    manifest: resolveManifestPath(manifestPath, effectiveTargetDir),
    runResults: resolveRunResultsPath(runResultsPath, effectiveTargetDir),
    catalog: resolveCatalogPath(catalogPath, effectiveTargetDir),
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
