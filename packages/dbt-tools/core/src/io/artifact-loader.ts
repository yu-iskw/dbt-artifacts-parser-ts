import * as fs from "fs";
import * as path from "path";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseManifest } from "dbt-artifacts-parser/manifest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseRunResults } from "dbt-artifacts-parser/run_results";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import type { ParsedManifest } from "dbt-artifacts-parser/manifest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import type { ParsedRunResults } from "dbt-artifacts-parser/run_results";

/**
 * Resolved artifact file paths
 */
export interface ArtifactPaths {
  manifest: string;
  runResults?: string;
}

/**
 * ArtifactLoader handles loading and resolving paths to dbt artifacts.
 * Defaults to ./target directory when paths are not provided.
 */
export class ArtifactLoader {
  private static readonly DEFAULT_TARGET_DIR = "./target";
  private static readonly MANIFEST_FILE = "manifest.json";
  private static readonly RUN_RESULTS_FILE = "run_results.json";

  /**
   * Resolve artifact paths, defaulting to ./target directory
   */
  static resolveArtifactPaths(
    manifestPath?: string,
    runResultsPath?: string,
    targetDir?: string,
  ): ArtifactPaths {
    const effectiveTargetDir =
      targetDir || process.env.DBT_TARGET_DIR || this.DEFAULT_TARGET_DIR;

    const resolved: ArtifactPaths = {
      manifest: this.resolveManifestPath(manifestPath, effectiveTargetDir),
    };

    if (runResultsPath !== undefined) {
      resolved.runResults = this.resolveRunResultsPath(
        runResultsPath,
        effectiveTargetDir,
      );
    }

    return resolved;
  }

  /**
   * Resolve manifest.json path
   */
  private static resolveManifestPath(
    manifestPath?: string,
    targetDir?: string,
  ): string {
    if (manifestPath) {
      // If it ends with .json, treat as file path
      if (manifestPath.endsWith(".json")) {
        return path.resolve(manifestPath);
      }
      // Otherwise, treat as directory and append manifest.json
      return path.resolve(manifestPath, this.MANIFEST_FILE);
    }

    // Default to target directory
    const effectiveTargetDir =
      targetDir || process.env.DBT_TARGET_DIR || this.DEFAULT_TARGET_DIR;
    return path.resolve(effectiveTargetDir, this.MANIFEST_FILE);
  }

  /**
   * Resolve run_results.json path
   */
  private static resolveRunResultsPath(
    runResultsPath?: string,
    targetDir?: string,
  ): string {
    if (runResultsPath) {
      // If it ends with .json, treat as file path
      if (runResultsPath.endsWith(".json")) {
        return path.resolve(runResultsPath);
      }
      // Otherwise, treat as directory and append run_results.json
      return path.resolve(runResultsPath, this.RUN_RESULTS_FILE);
    }

    // Default to target directory
    const effectiveTargetDir =
      targetDir || process.env.DBT_TARGET_DIR || this.DEFAULT_TARGET_DIR;
    return path.resolve(effectiveTargetDir, this.RUN_RESULTS_FILE);
  }

  /**
   * Load and parse manifest.json file
   */
  static loadManifest(manifestPath: string): ParsedManifest {
    const fullPath = path.resolve(manifestPath);
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
  static loadRunResults(runResultsPath: string): ParsedRunResults {
    const fullPath = path.resolve(runResultsPath);
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
}
