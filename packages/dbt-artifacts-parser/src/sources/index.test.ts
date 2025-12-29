import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  parseSources,
  parseSourcesV1,
  parseSourcesV2,
  parseSourcesV3,
  ParsedSources,
} from "./index";

// @ts-ignore - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);

/**
 * Sanitize a path component to prevent path traversal attacks
 * @param name - File or directory name to sanitize
 * @returns Sanitized name with path traversal sequences removed
 */
function sanitizePathComponent(name: string): string {
  // Remove any path traversal sequences and path separators
  return name.replace(/\.\./g, "").replace(/[\/\\]/g, "");
}

/**
 * Discover all sources files in the test resources directory
 * Returns a map of version number to array of file paths
 * Note: Currently no sources test resources exist, so this returns empty map
 */
function discoverSourcesFiles(): Map<number, string[]> {
  const resourcesDir = path.join(__dirname, "../tests/resources/sources");
  const versionMap = new Map<number, string[]>();

  if (!fs.existsSync(resourcesDir)) {
    return versionMap;
  }

  // Read all version directories (v1, v2, etc.)
  const versionDirs = fs
    .readdirSync(resourcesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && dirent.name.startsWith("v"))
    .map((dirent) => dirent.name)
    .sort((a, b) => {
      const numA = parseInt(a.substring(1), 10);
      const numB = parseInt(b.substring(1), 10);
      return numA - numB;
    });

  for (const versionDir of versionDirs) {
    const versionNum = parseInt(versionDir.substring(1), 10);
    const versionPath = path.join(resourcesDir, versionDir);
    const files: string[] = [];

    // Recursively find all sources.json files
    function findSourcesFiles(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const sanitizedName = sanitizePathComponent(entry.name);
        // Use path.resolve and validate it stays within base directory
        // This is a test file reading from controlled test resources. The path is sanitized
        // and validated to ensure it stays within the base directory.
        // nosem
        const fullPath = path.resolve(dir, sanitizedName);
        // Ensure the resolved path is still within the base directory
        if (!fullPath.startsWith(path.resolve(resourcesDir))) {
          continue; // Skip paths that escape the base directory
        }
        if (entry.isDirectory()) {
          findSourcesFiles(fullPath);
        } else if (
          entry.isFile() &&
          entry.name.includes("sources") &&
          entry.name.endsWith(".json")
        ) {
          files.push(fullPath);
        }
      }
    }

    findSourcesFiles(versionPath);
    if (files.length > 0) {
      versionMap.set(versionNum, files);
    }
  }

  return versionMap;
}

describe("sources parser", () => {
  // Mock sources data for testing
  const mockSourcesV1 = {
    metadata: {
      dbt_schema_version: "https://schemas.getdbt.com/dbt/sources/v1.json",
      dbt_version: "0.19.1",
      generated_at: "2021-06-16T08:34:18.410075Z",
    },
    results: [],
  };

  const mockSourcesV2 = {
    metadata: {
      dbt_schema_version: "https://schemas.getdbt.com/dbt/sources/v2.json",
      dbt_version: "0.20.2",
      generated_at: "2021-10-12T02:04:52.706766Z",
    },
    results: [],
  };

  const mockSourcesV3 = {
    metadata: {
      dbt_schema_version: "https://schemas.getdbt.com/dbt/sources/v3.json",
      dbt_version: "1.9.0",
      generated_at: "2024-12-16T07:45:32.505887Z",
    },
    results: [],
  };

  describe("parseSources", () => {
    it("should parse sources v3 correctly", () => {
      const sources = parseSources(mockSourcesV3);

      expect(sources).toBeDefined();
      expect(sources.metadata).toBeDefined();
      expect(sources.metadata.dbt_schema_version).toBe(
        "https://schemas.getdbt.com/dbt/sources/v3.json",
      );
      expect(sources.results).toBeDefined();
      expect(Array.isArray(sources.results)).toBe(true);
    });

    it("should throw error for invalid sources", () => {
      expect(() => parseSources({})).toThrow("Not a sources.json");
      expect(() => parseSources({ metadata: {} })).toThrow(
        "Not a sources.json",
      );
    });

    it("should throw error for unsupported version", () => {
      const invalidSources = {
        metadata: {
          dbt_schema_version: "https://schemas.getdbt.com/dbt/sources/v4.json",
        },
      };
      expect(() => parseSources(invalidSources)).toThrow(
        "Unsupported sources version: 4",
      );
    });
  });

  describe("version-specific parsers", () => {
    it("should parse sources v1 with parseSourcesV1", () => {
      const sources = parseSourcesV1(mockSourcesV1);

      expect(sources).toBeDefined();
      expect(sources.metadata.dbt_schema_version).toBe(
        "https://schemas.getdbt.com/dbt/sources/v1.json",
      );
    });

    it("should parse sources v2 with parseSourcesV2", () => {
      const sources = parseSourcesV2(mockSourcesV2);

      expect(sources).toBeDefined();
      expect(sources.metadata.dbt_schema_version).toBe(
        "https://schemas.getdbt.com/dbt/sources/v2.json",
      );
    });

    it("should parse sources v3 with parseSourcesV3", () => {
      const sources = parseSourcesV3(mockSourcesV3);

      expect(sources).toBeDefined();
      expect(sources.metadata.dbt_schema_version).toBe(
        "https://schemas.getdbt.com/dbt/sources/v3.json",
      );
    });

    it("should throw error when version doesn't match", () => {
      expect(() => parseSourcesV1(mockSourcesV2)).toThrow(
        "Not a sources.json v1",
      );
      expect(() => parseSourcesV2(mockSourcesV1)).toThrow(
        "Not a sources.json v2",
      );
      expect(() => parseSourcesV3(mockSourcesV1)).toThrow(
        "Not a sources.json v3",
      );
    });
  });

  describe("ParsedSources union type", () => {
    it("should accept different sources versions", () => {
      const sourcesV1: ParsedSources = parseSourcesV1(mockSourcesV1);
      const sourcesV2: ParsedSources = parseSourcesV2(mockSourcesV2);
      const sourcesV3: ParsedSources = parseSourcesV3(mockSourcesV3);

      expect(sourcesV1).toBeDefined();
      expect(sourcesV2).toBeDefined();
      expect(sourcesV3).toBeDefined();
    });
  });

  describe("all sources versions", () => {
    const sourcesFiles = discoverSourcesFiles();
    const versionParsers = [parseSourcesV1, parseSourcesV2, parseSourcesV3];

    // Test parseSources() with all versions from test resources (if available)
    if (sourcesFiles.size > 0) {
      for (const [version, files] of sourcesFiles.entries()) {
        describe(`version ${version}`, () => {
          for (const filePath of files) {
            const fileName = path.basename(filePath);
            it(`should parse ${fileName} with parseSources()`, () => {
              const jsonContent = fs.readFileSync(filePath, "utf-8");
              const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
              const sources = parseSources(parsed);

              expect(sources).toBeDefined();
              expect(sources.metadata).toBeDefined();
              expect(sources.metadata.dbt_schema_version).toContain(
                `/sources/v${version}.json`,
              );
              expect(sources.results).toBeDefined();
              expect(Array.isArray(sources.results)).toBe(true);
            });

            it(`should parse ${fileName} with version-specific parser`, () => {
              const jsonContent = fs.readFileSync(filePath, "utf-8");
              const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
              const parser = versionParsers[version - 1];

              if (parser) {
                const sources = parser(parsed);
                expect(sources).toBeDefined();
                expect(sources.metadata.dbt_schema_version).toContain(
                  `/sources/v${version}.json`,
                );
              }
            });

            it(`should accept ${fileName} as ParsedSources union type`, () => {
              const jsonContent = fs.readFileSync(filePath, "utf-8");
              const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
              const sources: ParsedSources = parseSources(parsed);

              expect(sources).toBeDefined();
              expect(sources.metadata).toBeDefined();
            });
          }
        });
      }
    } else {
      // Note: No test resources available for sources, using mock data above
      it("should note that no test resources are available", () => {
        expect(sourcesFiles.size).toBe(0);
      });
    }
  });
});
