import fs from "fs";
import path from "path";

// Get __dirname - in CommonJS, this is available at runtime
// We need to handle both build-time (dist/) and source-time (src/) contexts
let baseDir: string;
try {
  if (typeof __dirname !== "undefined") {
    baseDir = path.resolve(__dirname, "..", "src");
  } else {
    throw new Error("__dirname not available");
  }
} catch {
  // Fallback: calculate from current working directory
  // This assumes we're running from the workspace root or package root
  baseDir = path.resolve(process.cwd(), "packages/dbt-artifacts-parser/src");
}

/**
 * Artifact types supported by test utilities
 */
export type ArtifactType = "manifest" | "run_results" | "sources" | "catalog";

/**
 * Resource location types
 */
export type ResourceLocation = "tests" | "resources";

/**
 * Get the path to a test resource file
 *
 * @param type - Type of artifact (manifest, run_results, etc.)
 * @param version - Schema version (e.g., "v12", "10")
 * @param location - Where to look: "tests" (src/tests/resources) or "resources" (root resources/)
 * @param project - Project name (e.g., "jaffle_shop"), required for "tests" location
 * @param filename - Filename (e.g., "manifest_1.10.json"), required for "tests" location
 * @returns Absolute path to the resource file
 */
export function getTestResourcePath(
  type: ArtifactType,
  version: string,
  location: ResourceLocation = "tests",
  project?: string,
  filename?: string,
): string {
  // Normalize version (remove 'v' prefix if present, add it back consistently)
  const normalizedVersion = version.startsWith("v") ? version : `v${version}`;

  if (location === "tests") {
    if (!project || !filename) {
      throw new Error(
        `Project and filename are required when location is "tests"`,
      );
    }
    // Path: packages/dbt-artifacts-parser/src/tests/resources/{type}/{version}/{project}/{filename}
    return path.join(
      baseDir,
      "tests",
      "resources",
      type,
      normalizedVersion,
      project,
      filename,
    );
  } else {
    // Path: packages/dbt-artifacts-parser/resources/{type}/{type}_v{version}.json
    // Note: version should be numeric (e.g., "10", "11", "12") for resources location
    const numericVersion = normalizedVersion.replace(/^v/, "");
    return path.join(
      baseDir,
      "..",
      "resources",
      type,
      `${type}_v${numericVersion}.json`,
    );
  }
}

/**
 * Load a test manifest file
 *
 * @param version - Schema version (e.g., "v12", "12")
 * @param filename - Filename (e.g., "manifest_1.10.json")
 * @param project - Project name (default: "jaffle_shop")
 * @returns Parsed JSON content
 */
export function loadTestManifest(
  version: string,
  filename: string,
  project: string = "jaffle_shop",
): unknown {
  const manifestPath = getTestResourcePath(
    "manifest",
    version,
    "tests",
    project,
    filename,
  );
  const content = fs.readFileSync(manifestPath, "utf-8");
  return JSON.parse(content);
}

/**
 * Load a test run_results file
 *
 * @param version - Schema version (e.g., "v6", "6")
 * @param filename - Filename (e.g., "run_results.json")
 * @param project - Project name (default: "jaffle_shop")
 * @returns Parsed JSON content
 */
export function loadTestRunResults(
  version: string,
  filename: string,
  project: string = "jaffle_shop",
): unknown {
  const runResultsPath = getTestResourcePath(
    "run_results",
    version,
    "tests",
    project,
    filename,
  );
  const content = fs.readFileSync(runResultsPath, "utf-8");
  return JSON.parse(content);
}

/**
 * Load a test sources file
 *
 * @param version - Schema version (e.g., "v3", "3")
 * @param filename - Filename (e.g., "sources.json")
 * @param project - Project name (default: "jaffle_shop")
 * @returns Parsed JSON content
 */
export function loadTestSources(
  version: string,
  filename: string,
  project: string = "jaffle_shop",
): unknown {
  const sourcesPath = getTestResourcePath(
    "sources",
    version,
    "tests",
    project,
    filename,
  );
  const content = fs.readFileSync(sourcesPath, "utf-8");
  return JSON.parse(content);
}

/**
 * Load a test catalog file
 *
 * @param version - Schema version (e.g., "v1", "1")
 * @param filename - Filename (e.g., "catalog.json")
 * @param project - Project name (default: "jaffle_shop")
 * @returns Parsed JSON content
 */
export function loadTestCatalog(
  version: string,
  filename: string,
  project: string = "jaffle_shop",
): unknown {
  const catalogPath = getTestResourcePath(
    "catalog",
    version,
    "tests",
    project,
    filename,
  );
  const content = fs.readFileSync(catalogPath, "utf-8");
  return JSON.parse(content);
}
