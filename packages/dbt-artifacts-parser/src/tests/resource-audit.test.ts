import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  discoverManifestFiles,
  discoverRunResultsFiles,
  discoverCatalogFiles,
  discoverSourcesFiles,
} from "../test-utils";

// @ts-expect-error - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);

const resourcesDir = path.join(__dirname, "../../resources");

/**
 * Recursively list all .json files under a directory, returning absolute paths.
 */
function listAllJsonFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listAllJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(path.resolve(fullPath));
    }
  }
  return files;
}

describe("resource audit", () => {
  it("every JSON file in resources/ must be covered by parser test discovery", () => {
    const manifestDir = path.join(resourcesDir, "manifest");
    const runResultsDir = path.join(resourcesDir, "run_results");
    const catalogDir = path.join(resourcesDir, "catalog");
    const sourcesDir = path.join(resourcesDir, "sources");

    const manifestFiles = listAllJsonFiles(manifestDir);
    const runResultsFiles = listAllJsonFiles(runResultsDir);
    const catalogFiles = listAllJsonFiles(catalogDir);
    const sourcesFiles = listAllJsonFiles(sourcesDir);

    const discoveredManifest = new Set(discoverManifestFiles());
    const discoveredRunResults = new Set(discoverRunResultsFiles());
    const discoveredCatalog = new Set(discoverCatalogFiles());
    const discoveredSources = new Set(discoverSourcesFiles());

    const uncovered: string[] = [];

    for (const f of manifestFiles) {
      if (!discoveredManifest.has(f))
        uncovered.push(path.relative(resourcesDir, f));
    }
    for (const f of runResultsFiles) {
      if (!discoveredRunResults.has(f))
        uncovered.push(path.relative(resourcesDir, f));
    }
    for (const f of catalogFiles) {
      if (!discoveredCatalog.has(f))
        uncovered.push(path.relative(resourcesDir, f));
    }
    for (const f of sourcesFiles) {
      if (!discoveredSources.has(f))
        uncovered.push(path.relative(resourcesDir, f));
    }

    expect(
      uncovered,
      `These fixture files are not covered by parser test discovery: ${uncovered.join(", ")}`,
    ).toHaveLength(0);
  });
});
