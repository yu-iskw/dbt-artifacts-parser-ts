import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { artifactDiscoverers, type ArtifactType } from "../test-utils";

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
    const uncovered: string[] = [];

    for (const type of Object.keys(artifactDiscoverers) as ArtifactType[]) {
      const discovered = new Set(artifactDiscoverers[type]());
      for (const filePath of listAllJsonFiles(path.join(resourcesDir, type))) {
        if (!discovered.has(filePath)) {
          uncovered.push(path.relative(resourcesDir, filePath));
        }
      }
    }

    expect(
      uncovered,
      `These fixture files are not covered by parser test discovery: ${uncovered.join(", ")}`,
    ).toHaveLength(0);
  });
});
