/**
 * Local-filesystem artifact discovery.
 * Scans a directory for dbt artifact files and returns candidate sets.
 * Shared by the web server and CLI so both use the same discovery contract.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
} from "./artifact-filenames";
import { validateSafePath } from "../validation/input-validator";

/**
 * A discovered artifact set at a local filesystem location.
 * Only candidates with both manifest.json and run_results.json are returned.
 */
export interface LocalArtifactRun {
  /** "current" for the root dir itself; subdirectory name otherwise. */
  runId: string;
  manifestPath: string;
  runResultsPath: string;
  catalogPath?: string;
  sourcesPath?: string;
  /**
   * Max mtime of the required artifact pair (manifest + run_results) in ms.
   * Used for sorting and version-awareness.
   */
  updatedAtMs: number;
}

function statMtimeMs(filePath: string): number {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function buildRunForDir(dir: string, runId: string): LocalArtifactRun | null {
  const manifestPath = path.join(dir, DBT_MANIFEST_JSON);
  const runResultsPath = path.join(dir, DBT_RUN_RESULTS_JSON);

  if (!fileExists(manifestPath) || !fileExists(runResultsPath)) return null;

  const catalogPath = path.join(dir, DBT_CATALOG_JSON);
  const sourcesPath = path.join(dir, DBT_SOURCES_JSON);

  const updatedAtMs = Math.max(
    statMtimeMs(manifestPath),
    statMtimeMs(runResultsPath),
  );

  return {
    runId,
    manifestPath,
    runResultsPath,
    ...(fileExists(catalogPath) ? { catalogPath } : {}),
    ...(fileExists(sourcesPath) ? { sourcesPath } : {}),
    updatedAtMs,
  };
}

/**
 * Discover dbt artifact candidate sets under a local directory.
 *
 * Checks the root directory itself first (runId "current"), then immediate
 * subdirectories (each becomes a candidate with runId = subdir name).
 * Only entries that have both manifest.json and run_results.json are included.
 * Results are sorted newest-first by required-artifact mtime.
 *
 * @throws {Error} when the path contains traversal sequences or is not a directory.
 */
export function discoverLocalArtifactRuns(dir: string): LocalArtifactRun[] {
  validateSafePath(dir);

  const resolvedDir = path.resolve(dir);

  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolvedDir);
  } catch {
    return [];
  }

  if (!stat.isDirectory()) return [];

  const candidates: LocalArtifactRun[] = [];

  // Root dir itself — treated as a "current" run (flat layout, no subdirectories).
  const rootRun = buildRunForDir(resolvedDir, "current");
  if (rootRun != null) candidates.push(rootRun);

  // Immediate subdirectories — each is a candidate run.
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
  } catch {
    return candidates;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const subDir = path.join(resolvedDir, entry.name);
    const run = buildRunForDir(subDir, entry.name);
    if (run != null) candidates.push(run);
  }

  // Sort newest-first by required artifact pair mtime.
  return candidates.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

/**
 * Validate that an artifact location has the required pair.
 * Returns which required artifacts are missing and which optional artifacts are missing.
 */
export interface ArtifactLocationValidation {
  valid: boolean;
  missingRequired: string[];
  missingOptional: string[];
}

export function validateArtifactLocationLocal(
  location: string,
): ArtifactLocationValidation {
  validateSafePath(location);
  const resolvedDir = path.resolve(location);

  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  if (!fileExists(path.join(resolvedDir, DBT_MANIFEST_JSON))) {
    missingRequired.push(DBT_MANIFEST_JSON);
  }
  if (!fileExists(path.join(resolvedDir, DBT_RUN_RESULTS_JSON))) {
    missingRequired.push(DBT_RUN_RESULTS_JSON);
  }
  if (!fileExists(path.join(resolvedDir, DBT_CATALOG_JSON))) {
    missingOptional.push(DBT_CATALOG_JSON);
  }
  if (!fileExists(path.join(resolvedDir, DBT_SOURCES_JSON))) {
    missingOptional.push(DBT_SOURCES_JSON);
  }

  return {
    valid: missingRequired.length === 0,
    missingRequired,
    missingOptional,
  };
}
