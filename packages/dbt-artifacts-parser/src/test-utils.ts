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
 * Root resources directory: packages/dbt-artifacts-parser/resources/
 * Single source of truth for test fixtures.
 */
const resourcesDir = path.resolve(baseDir, "..", "resources");

/** Validate path component to prevent traversal; throws if invalid */
function validatePathComponent(name: string): void {
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new Error("Path component must be a non-empty string");
  }
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    throw new Error(
      `Path component must not contain traversal or separators: ${name}`,
    );
  }
}

/**
 * Get the path to a test resource file
 *
 * @param type - Type of artifact (manifest, run_results, etc.)
 * @param version - Schema version (e.g., "v12", "10")
 * @param location - Where to look: "tests" or "resources" (both point to root resources/)
 * @param project - Project name (e.g., "jaffle_shop"), required for structured paths
 * @param filename - Filename (e.g., "manifest_1.10.json"), required for structured paths
 * @returns Absolute path to the resource file
 */
export function getTestResourcePath(
  type: ArtifactType,
  version: string,
  location: ResourceLocation = "resources",
  project?: string,
  filename?: string,
): string {
  // Normalize version (remove 'v' prefix if present, add it back consistently)
  const normalizedVersion = version.startsWith("v") ? version : `v${version}`;

  if (location === "tests" || location === "resources") {
    if (!project || !filename) {
      throw new Error(
        `Project and filename are required when location is "${location}"`,
      );
    }
    validatePathComponent(normalizedVersion);
    validatePathComponent(project);
    validatePathComponent(filename);
    return path.join(resourcesDir, type, normalizedVersion, project, filename);
  }

  throw new Error(`Unknown location: ${location}`);
}

/** Sanitize path component to prevent traversal */
function sanitizePathComponent(name: string): string {
  return name.replace(/\.\./g, "").replace(/[\/\\]/g, "");
}

/** Recursively find JSON files matching a name pattern under a directory */
function findArtifactFiles(
  dir: string,
  baseDir: string,
  nameIncludes: string,
): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const sanitizedName = sanitizePathComponent(entry.name);
    const fullPath = path.resolve(dir, sanitizedName);
    if (!fullPath.startsWith(path.resolve(baseDir))) continue;
    if (entry.isDirectory()) {
      files.push(...findArtifactFiles(fullPath, baseDir, nameIncludes));
    } else if (
      entry.isFile() &&
      entry.name.includes(nameIncludes) &&
      entry.name.endsWith(".json")
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Discover all manifest fixture files in resources/
 * Returns absolute paths (same logic as manifest/index.test.ts)
 */
export function discoverManifestFiles(): string[] {
  const manifestDir = path.join(resourcesDir, "manifest");
  return findArtifactFiles(manifestDir, resourcesDir, "manifest");
}

/**
 * Discover all run_results fixture files in resources/
 */
export function discoverRunResultsFiles(): string[] {
  const runResultsDir = path.join(resourcesDir, "run_results");
  return findArtifactFiles(runResultsDir, resourcesDir, "run_results");
}

/**
 * Discover all catalog fixture files in resources/
 */
export function discoverCatalogFiles(): string[] {
  const catalogDir = path.join(resourcesDir, "catalog");
  return findArtifactFiles(catalogDir, resourcesDir, "catalog");
}

/**
 * Discover all sources fixture files in resources/
 */
export function discoverSourcesFiles(): string[] {
  const sourcesDir = path.join(resourcesDir, "sources");
  return findArtifactFiles(sourcesDir, resourcesDir, "sources");
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
