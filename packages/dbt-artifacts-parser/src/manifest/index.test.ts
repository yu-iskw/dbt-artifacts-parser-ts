import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  parseManifest,
  parseManifestV1,
  parseManifestV2,
  parseManifestV3,
  parseManifestV4,
  parseManifestV5,
  parseManifestV6,
  parseManifestV7,
  parseManifestV8,
  parseManifestV9,
  parseManifestV10,
  parseManifestV11,
  parseManifestV12,
  ParsedManifest,
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
 * Discover all manifest files in the test resources directory
 * Returns a map of version number to array of file paths
 */
function discoverManifestFiles(): Map<number, string[]> {
  const resourcesDir = path.join(__dirname, "../tests/resources/manifest");
  const versionMap = new Map<number, string[]>();

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

    // Recursively find all manifest.json files
    function findManifestFiles(dir: string) {
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
          findManifestFiles(fullPath);
        } else if (
          entry.isFile() &&
          entry.name.includes("manifest") &&
          entry.name.endsWith(".json")
        ) {
          files.push(fullPath);
        }
      }
    }

    findManifestFiles(versionPath);
    if (files.length > 0) {
      versionMap.set(versionNum, files);
    }
  }

  return versionMap;
}

describe("manifest parser", () => {
  describe("parseManifest", () => {
    it("should parse manifest v1 correctly", () => {
      const jsonPath = path.join(
        __dirname,
        "../tests/resources/manifest/v1/jaffle_shop/manifest.json",
      );
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
      const manifest = parseManifest(parsed);

      expect(manifest).toBeDefined();
      expect(manifest.metadata).toBeDefined();
      expect(manifest.metadata.dbt_schema_version).toBe(
        "https://schemas.getdbt.com/dbt/manifest/v1.json",
      );
      expect(manifest.nodes).toBeDefined();
      expect(manifest.sources).toBeDefined();
      expect(manifest.macros).toBeDefined();
    });

    it("should throw error for invalid manifest", () => {
      expect(() => parseManifest({})).toThrow("Not a manifest.json");
      expect(() => parseManifest({ metadata: {} })).toThrow(
        "Not a manifest.json",
      );
    });

    it("should throw error for unsupported version", () => {
      const invalidManifest = {
        metadata: {
          dbt_schema_version:
            "https://schemas.getdbt.com/dbt/manifest/v99.json",
        },
      };
      expect(() => parseManifest(invalidManifest)).toThrow(
        "Unsupported manifest version: 99",
      );
    });
  });

  describe("version-specific parsers", () => {
    it("should parse manifest v1 with parseManifestV1", () => {
      const jsonPath = path.join(
        __dirname,
        "../tests/resources/manifest/v1/jaffle_shop/manifest.json",
      );
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
      const manifest = parseManifestV1(parsed);

      expect(manifest).toBeDefined();
      expect(manifest.metadata.dbt_schema_version).toBe(
        "https://schemas.getdbt.com/dbt/manifest/v1.json",
      );
    });

    it("should throw error when version doesn't match", () => {
      const jsonPath = path.join(
        __dirname,
        "../tests/resources/manifest/v1/jaffle_shop/manifest.json",
      );
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;

      expect(() => parseManifestV2(parsed)).toThrow("Not a manifest.json v2");
    });
  });

  describe("ParsedManifest union type", () => {
    it("should accept different manifest versions", () => {
      const jsonPath = path.join(
        __dirname,
        "../tests/resources/manifest/v1/jaffle_shop/manifest.json",
      );
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
      const manifest: ParsedManifest = parseManifest(parsed);

      expect(manifest).toBeDefined();
    });
  });

  describe("all manifest versions", () => {
    const manifestFiles = discoverManifestFiles();
    const versionParsers = [
      parseManifestV1,
      parseManifestV2,
      parseManifestV3,
      parseManifestV4,
      parseManifestV5,
      parseManifestV6,
      parseManifestV7,
      parseManifestV8,
      parseManifestV9,
      parseManifestV10,
      parseManifestV11,
      parseManifestV12,
    ];

    // Test parseManifest() with all versions
    for (const [version, files] of manifestFiles.entries()) {
      describe(`version ${version}`, () => {
        for (const filePath of files) {
          const fileName = path.basename(filePath);
          it(`should parse ${fileName} with parseManifest()`, () => {
            const jsonContent = fs.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
            const manifest = parseManifest(parsed);

            expect(manifest).toBeDefined();
            expect(manifest.metadata).toBeDefined();
            expect(manifest.metadata.dbt_schema_version).toContain(
              `/manifest/v${version}.json`,
            );
            expect(manifest.nodes).toBeDefined();
            expect(typeof manifest.nodes).toBe("object");
            expect(manifest.sources).toBeDefined();
            expect(typeof manifest.sources).toBe("object");
            expect(manifest.macros).toBeDefined();
            expect(typeof manifest.macros).toBe("object");
          });

          it(`should parse ${fileName} with version-specific parser`, () => {
            const jsonContent = fs.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
            const parser = versionParsers[version - 1];

            if (parser) {
              const manifest = parser(parsed);
              expect(manifest).toBeDefined();
              expect(manifest.metadata.dbt_schema_version).toContain(
                `/manifest/v${version}.json`,
              );
            }
          });

          it(`should accept ${fileName} as ParsedManifest union type`, () => {
            const jsonContent = fs.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
            const manifest: ParsedManifest = parseManifest(parsed);

            expect(manifest).toBeDefined();
            expect(manifest.metadata).toBeDefined();
          });
        }
      });
    }
  });
});
