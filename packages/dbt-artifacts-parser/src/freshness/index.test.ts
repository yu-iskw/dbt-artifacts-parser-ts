import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import type { FreshnessArtifact, ParsedFreshness } from "./index";
import { parseFreshness, parseFreshnessV0 } from "./index";

// @ts-expect-error - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);

/**
 * Sanitize a path component to prevent path traversal attacks
 * @param name - File or directory name to sanitize
 * @returns Sanitized name with path traversal sequences removed
 */
function sanitizePathComponent(name: string): string {
  return name.replace(/\.\./g, "").replace(/[\/\\]/g, "");
}

/**
 * Discover all freshness files in the test resources directory
 * Returns a map of version number to array of file paths
 */
function discoverFreshnessFiles(): Map<number, string[]> {
  const resourcesDir = path.join(__dirname, "../../resources/freshness");
  const versionMap = new Map<number, string[]>();

  if (!fs.existsSync(resourcesDir)) {
    return versionMap;
  }

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

    function findFreshnessFiles(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const sanitizedName = sanitizePathComponent(entry.name);
        // nosem
        const fullPath = path.resolve(dir, sanitizedName);
        if (!fullPath.startsWith(path.resolve(resourcesDir))) {
          continue;
        }
        if (entry.isDirectory()) {
          findFreshnessFiles(fullPath);
        } else if (
          entry.isFile() &&
          entry.name.includes("freshness") &&
          entry.name.endsWith(".json")
        ) {
          files.push(fullPath);
        }
      }
    }

    findFreshnessFiles(versionPath);
    if (files.length > 0) {
      versionMap.set(versionNum, files);
    }
  }

  return versionMap;
}

const mockFreshnessV0 = {
  metadata: {
    dbt_schema_version: "https://schemas.getdbt.com/dbt/freshness/v0.json",
    dbt_version: "2.0.0",
    generated_at: "2026-09-19T00:00:00.000000Z",
    invocation_id: "00000000-0000-0000-0000-000000000001",
  },
  results: [
    {
      unique_id: "source.jaffle_shop.raw.orders",
      resource_type: "source",
      max_loaded_at: "2026-09-18T12:00:00.000000Z",
      snapshotted_at: "2026-09-19T00:00:00.000000Z",
      max_loaded_at_time_ago_in_s: 43200,
      status: "Pass",
      criteria: {
        error_after: { count: 24, period: "hour" },
        warn_after: { count: 12, period: "hour" },
      },
      adapter_response: {},
      timing: [{ name: "execute" }],
      thread_id: "Thread-1",
      execution_time: 0.12,
    },
  ],
  elapsed_time: 0.25,
};

describe("freshness parser", () => {
  describe("parseFreshness", () => {
    it("should parse freshness v0 correctly", () => {
      const freshness = parseFreshness(mockFreshnessV0);

      expect(freshness).toBeDefined();
      expect(freshness.metadata).toBeDefined();
      expect(freshness.metadata.dbt_schema_version).toBe(
        "https://schemas.getdbt.com/dbt/freshness/v0.json",
      );
      expect(freshness.metadata.dbt_version).toBe("2.0.0");
      expect(freshness.results).toBeDefined();
      expect(Array.isArray(freshness.results)).toBe(true);
    });

    it("should throw error for invalid freshness", () => {
      expect(() => parseFreshness({})).toThrow("Not a freshness.json");
      expect(() => parseFreshness({ metadata: {} })).toThrow(
        "Not a freshness.json",
      );
    });

    it("should throw error for sources.json schema URL", () => {
      const sourcesArtifact = {
        metadata: {
          dbt_schema_version: "https://schemas.getdbt.com/dbt/sources/v3.json",
        },
      };
      expect(() => parseFreshness(sourcesArtifact)).toThrow(
        "Not a freshness.json",
      );
    });

    it("should throw error for unsupported version", () => {
      const invalidFreshness = {
        metadata: {
          dbt_schema_version:
            "https://schemas.getdbt.com/dbt/freshness/v1.json",
        },
      };
      expect(() => parseFreshness(invalidFreshness)).toThrow(
        "Unsupported freshness version: 1",
      );
    });

    it("should fall back to latest when fallbackToLatest is true", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const newerFreshness = {
        ...mockFreshnessV0,
        metadata: {
          ...mockFreshnessV0.metadata,
          dbt_schema_version:
            "https://schemas.getdbt.com/dbt/freshness/v99.json",
        },
      };

      const freshness = parseFreshness(newerFreshness, {
        fallbackToLatest: true,
      });

      expect(freshness).toBeDefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("falling back to latest supported schema 'v0'"),
      );
      warnSpy.mockRestore();
    });

    it("should not fall back for wrong artifact type even with fallbackToLatest", () => {
      const invalidFreshness = {
        metadata: {
          dbt_schema_version: "https://schemas.getdbt.com/dbt/sources/v99.json",
        },
      };
      expect(() =>
        parseFreshness(invalidFreshness, { fallbackToLatest: true }),
      ).toThrow("Not a freshness.json");
    });
  });

  describe("version-specific parsers", () => {
    it("should parse freshness v0 with parseFreshnessV0", () => {
      const freshness = parseFreshnessV0(mockFreshnessV0);

      expect(freshness).toBeDefined();
      expect(freshness.metadata.dbt_schema_version).toBe(
        "https://schemas.getdbt.com/dbt/freshness/v0.json",
      );
    });

    it("should throw error when version does not match", () => {
      expect(() =>
        parseFreshnessV0({
          metadata: {
            dbt_schema_version:
              "https://schemas.getdbt.com/dbt/freshness/v1.json",
          },
        }),
      ).toThrow("Not a freshness.json v0");
    });
  });

  describe("ParsedFreshness union type", () => {
    it("should accept freshness v0", () => {
      const freshness: ParsedFreshness = parseFreshness(mockFreshnessV0);
      const aliased: FreshnessArtifact = freshness;

      expect(freshness).toBeDefined();
      expect(aliased.results).toBeDefined();
    });
  });

  describe("all freshness versions", () => {
    const freshnessFiles = discoverFreshnessFiles();
    const versionParsers: Record<number, typeof parseFreshnessV0> = {
      0: parseFreshnessV0,
    };

    it("should discover freshness fixtures", () => {
      expect(freshnessFiles.size).toBeGreaterThan(0);
    });

    for (const [version, files] of freshnessFiles.entries()) {
      describe(`version ${version}`, () => {
        for (const filePath of files) {
          const fileName = path.basename(filePath);
          it(`should parse ${fileName} with parseFreshness()`, () => {
            const jsonContent = fs.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
            const freshness = parseFreshness(parsed);

            expect(freshness).toBeDefined();
            expect(freshness.metadata).toBeDefined();
            expect(freshness.metadata.dbt_schema_version).toContain(
              `/freshness/v${version}.json`,
            );
            expect(freshness.metadata.dbt_version.startsWith("2.")).toBe(true);
            expect(freshness.results).toBeDefined();
            expect(Array.isArray(freshness.results)).toBe(true);
            expect(freshness.results.length).toBeGreaterThan(0);
            for (const result of freshness.results) {
              expect(result.resource_type).toBeDefined();
            }
          });

          it(`should parse ${fileName} with version-specific parser`, () => {
            const jsonContent = fs.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
            const parser = versionParsers[version];

            expect(parser).toBeDefined();
            const freshness = parser(parsed);
            expect(freshness).toBeDefined();
            expect(freshness.metadata.dbt_schema_version).toContain(
              `/freshness/v${version}.json`,
            );
          });

          it(`should accept ${fileName} as ParsedFreshness union type`, () => {
            const jsonContent = fs.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
            const freshness: ParsedFreshness = parseFreshness(parsed);

            expect(freshness).toBeDefined();
            expect(freshness.metadata).toBeDefined();
          });
        }
      });
    }
  });

  describe("invalid data", () => {
    it("should throw when metadata is null", () => {
      expect(() => parseFreshness({ metadata: null })).toThrow(
        "Not a freshness.json",
      );
    });

    it("should throw when dbt_schema_version is missing from metadata", () => {
      expect(() => parseFreshness({ metadata: { foo: "bar" } })).toThrow(
        "Not a freshness.json",
      );
    });
  });
});
