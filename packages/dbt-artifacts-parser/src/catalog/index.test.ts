import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseCatalog, parseCatalogV1, ParsedCatalog } from "./index";

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
 * Discover all catalog files in the test resources directory
 * Returns a map of version number to array of file paths
 */
function discoverCatalogFiles(): Map<number, string[]> {
  const resourcesDir = path.join(__dirname, "../tests/resources/catalog");
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

    // Recursively find all catalog.json files
    function findCatalogFiles(dir: string) {
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
          findCatalogFiles(fullPath);
        } else if (
          entry.isFile() &&
          entry.name.includes("catalog") &&
          entry.name.endsWith(".json")
        ) {
          files.push(fullPath);
        }
      }
    }

    findCatalogFiles(versionPath);
    if (files.length > 0) {
      versionMap.set(versionNum, files);
    }
  }

  return versionMap;
}

describe("catalog parser", () => {
  describe("parseCatalog", () => {
    it("should parse catalog v1 correctly", () => {
      const jsonPath = path.join(
        __dirname,
        "../tests/resources/catalog/v1/jaffle_shop/catalog.json",
      );
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
      const catalog = parseCatalog(parsed);

      expect(catalog).toBeDefined();
      expect(catalog.metadata).toBeDefined();
      expect(catalog.metadata.dbt_schema_version).toBe(
        "https://schemas.getdbt.com/dbt/catalog/v1.json",
      );
      expect(catalog.nodes).toBeDefined();
      expect(catalog.sources).toBeDefined();
    });

    it("should throw error for invalid catalog", () => {
      expect(() => parseCatalog({})).toThrow("Not a catalog.json");
      expect(() => parseCatalog({ metadata: {} })).toThrow(
        "Not a catalog.json",
      );
    });

    it("should throw error for unsupported version", () => {
      const invalidCatalog = {
        metadata: {
          dbt_schema_version: "https://schemas.getdbt.com/dbt/catalog/v2.json",
        },
      };
      expect(() => parseCatalog(invalidCatalog)).toThrow(
        "Unsupported catalog version: 2",
      );
    });
  });

  describe("version-specific parsers", () => {
    it("should parse catalog v1 with parseCatalogV1", () => {
      const jsonPath = path.join(
        __dirname,
        "../tests/resources/catalog/v1/jaffle_shop/catalog.json",
      );
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
      const catalog = parseCatalogV1(parsed);

      expect(catalog).toBeDefined();
      expect(catalog.metadata.dbt_schema_version).toBe(
        "https://schemas.getdbt.com/dbt/catalog/v1.json",
      );
    });

    it("should throw error when version doesn't match", () => {
      const jsonPath = path.join(
        __dirname,
        "../tests/resources/catalog/v1/jaffle_shop/catalog.json",
      );
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;

      // Modify version to v2 to test version mismatch
      (parsed.metadata as any).dbt_schema_version =
        "https://schemas.getdbt.com/dbt/catalog/v2.json";

      expect(() => parseCatalogV1(parsed)).toThrow("Not a catalog.json v1");
    });
  });

  describe("ParsedCatalog union type", () => {
    it("should accept catalog v1", () => {
      const jsonPath = path.join(
        __dirname,
        "../tests/resources/catalog/v1/jaffle_shop/catalog.json",
      );
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
      const catalog: ParsedCatalog = parseCatalog(parsed);

      expect(catalog).toBeDefined();
    });
  });

  describe("all catalog versions", () => {
    const catalogFiles = discoverCatalogFiles();
    const versionParsers = [parseCatalogV1];

    // Test parseCatalog() with all versions
    for (const [version, files] of catalogFiles.entries()) {
      describe(`version ${version}`, () => {
        for (const filePath of files) {
          const fileName = path.basename(filePath);
          it(`should parse ${fileName} with parseCatalog()`, () => {
            const jsonContent = fs.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
            const catalog = parseCatalog(parsed);

            expect(catalog).toBeDefined();
            expect(catalog.metadata).toBeDefined();
            expect(catalog.metadata.dbt_schema_version).toContain(
              `/catalog/v${version}.json`,
            );
            expect(catalog.nodes).toBeDefined();
            expect(typeof catalog.nodes).toBe("object");
            expect(catalog.sources).toBeDefined();
            expect(typeof catalog.sources).toBe("object");
          });

          it(`should parse ${fileName} with version-specific parser`, () => {
            const jsonContent = fs.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
            const parser = versionParsers[version - 1];

            if (parser) {
              const catalog = parser(parsed);
              expect(catalog).toBeDefined();
              expect(catalog.metadata.dbt_schema_version).toContain(
                `/catalog/v${version}.json`,
              );
            }
          });

          it(`should accept ${fileName} as ParsedCatalog union type`, () => {
            const jsonContent = fs.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
            const catalog: ParsedCatalog = parseCatalog(parsed);

            expect(catalog).toBeDefined();
            expect(catalog.metadata).toBeDefined();
          });
        }
      });
    }
  });
});
