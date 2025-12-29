import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  parseRunResults,
  parseRunResultsV1,
  parseRunResultsV2,
  parseRunResultsV3,
  parseRunResultsV4,
  parseRunResultsV5,
  parseRunResultsV6,
  ParsedRunResults,
} from "./index";

// @ts-ignore - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);

/**
 * Discover all run_results files in the test resources directory
 * Returns a map of version number to array of file paths
 */
function discoverRunResultsFiles(): Map<number, string[]> {
  const resourcesDir = path.join(__dirname, "../tests/resources/run_results");
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

    // Recursively find all run_results.json files
    function findRunResultsFiles(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findRunResultsFiles(fullPath);
        } else if (
          entry.isFile() &&
          entry.name.includes("run_results") &&
          entry.name.endsWith(".json")
        ) {
          files.push(fullPath);
        }
      }
    }

    findRunResultsFiles(versionPath);
    if (files.length > 0) {
      versionMap.set(versionNum, files);
    }
  }

  return versionMap;
}

describe("run_results parser", () => {
  describe("parseRunResults", () => {
    it("should parse run results v6 correctly", () => {
      const jsonPath = path.join(
        __dirname,
        "../tests/resources/run_results/v6/jaffle_shop/run_results.json",
      );
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
      const runResults = parseRunResults(parsed);

      expect(runResults).toBeDefined();
      expect(runResults.metadata).toBeDefined();
      expect(runResults.metadata.dbt_schema_version).toBe(
        "https://schemas.getdbt.com/dbt/run-results/v6.json",
      );
      expect(runResults.results).toBeDefined();
      expect(Array.isArray(runResults.results)).toBe(true);
    });

    it("should throw error for invalid run results", () => {
      expect(() => parseRunResults({})).toThrow("Not a run-results.json");
      expect(() => parseRunResults({ metadata: {} })).toThrow(
        "Not a run-results.json",
      );
    });

    it("should throw error for unsupported version", () => {
      const invalidRunResults = {
        metadata: {
          dbt_schema_version:
            "https://schemas.getdbt.com/dbt/run-results/v99.json",
        },
      };
      expect(() => parseRunResults(invalidRunResults)).toThrow(
        "Unsupported run-results version: 99",
      );
    });
  });

  describe("version-specific parsers", () => {
    it("should parse run results v1 with parseRunResultsV1", () => {
      const jsonPath = path.join(
        __dirname,
        "../tests/resources/run_results/v1/jaffle_shop/run_results.json",
      );
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
      const runResults = parseRunResultsV1(parsed);

      expect(runResults).toBeDefined();
      expect(runResults.metadata.dbt_schema_version).toBe(
        "https://schemas.getdbt.com/dbt/run-results/v1.json",
      );
    });

    it("should parse run results v2 with parseRunResultsV2", () => {
      const jsonPath = path.join(
        __dirname,
        "../tests/resources/run_results/v2/jaffle_shop/run_results.json",
      );
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
      const runResults = parseRunResultsV2(parsed);

      expect(runResults).toBeDefined();
      expect(runResults.metadata.dbt_schema_version).toBe(
        "https://schemas.getdbt.com/dbt/run-results/v2.json",
      );
    });

    it("should parse run results v3 with parseRunResultsV3", () => {
      const jsonPath = path.join(
        __dirname,
        "../tests/resources/run_results/v3/jaffle_shop/run_results.json",
      );
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
      const runResults = parseRunResultsV3(parsed);

      expect(runResults).toBeDefined();
      expect(runResults.metadata.dbt_schema_version).toBe(
        "https://schemas.getdbt.com/dbt/run-results/v3.json",
      );
    });

    it("should parse run results v4 with parseRunResultsV4", () => {
      const jsonPath = path.join(
        __dirname,
        "../tests/resources/run_results/v4/jaffle_shop/run_results.json",
      );
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
      const runResults = parseRunResultsV4(parsed);

      expect(runResults).toBeDefined();
      expect(runResults.metadata.dbt_schema_version).toBe(
        "https://schemas.getdbt.com/dbt/run-results/v4.json",
      );
    });

    it("should parse run results v5 with parseRunResultsV5", () => {
      const jsonPath = path.join(
        __dirname,
        "../tests/resources/run_results/v5/jaffle_shop/run_results.json",
      );
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
      const runResults = parseRunResultsV5(parsed);

      expect(runResults).toBeDefined();
      expect(runResults.metadata.dbt_schema_version).toBe(
        "https://schemas.getdbt.com/dbt/run-results/v5.json",
      );
    });

    it("should parse run results v6 with parseRunResultsV6", () => {
      const jsonPath = path.join(
        __dirname,
        "../tests/resources/run_results/v6/jaffle_shop/run_results.json",
      );
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
      const runResults = parseRunResultsV6(parsed);

      expect(runResults).toBeDefined();
      expect(runResults.metadata.dbt_schema_version).toBe(
        "https://schemas.getdbt.com/dbt/run-results/v6.json",
      );
    });

    it("should throw error when version doesn't match", () => {
      const jsonPath = path.join(
        __dirname,
        "../tests/resources/run_results/v1/jaffle_shop/run_results.json",
      );
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;

      expect(() => parseRunResultsV2(parsed)).toThrow(
        "Not a run-results.json v2",
      );
    });
  });

  describe("ParsedRunResults union type", () => {
    it("should accept different run results versions", () => {
      const jsonPath = path.join(
        __dirname,
        "../tests/resources/run_results/v6/jaffle_shop/run_results.json",
      );
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
      const runResults: ParsedRunResults = parseRunResults(parsed);

      expect(runResults).toBeDefined();
    });
  });

  describe("all run_results versions", () => {
    const runResultsFiles = discoverRunResultsFiles();
    const versionParsers = [
      parseRunResultsV1,
      parseRunResultsV2,
      parseRunResultsV3,
      parseRunResultsV4,
      parseRunResultsV5,
      parseRunResultsV6,
    ];

    // Test parseRunResults() with all versions
    for (const [version, files] of runResultsFiles.entries()) {
      describe(`version ${version}`, () => {
        for (const filePath of files) {
          const fileName = path.basename(filePath);
          it(`should parse ${fileName} with parseRunResults()`, () => {
            const jsonContent = fs.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
            const runResults = parseRunResults(parsed);

            expect(runResults).toBeDefined();
            expect(runResults.metadata).toBeDefined();
            expect(runResults.metadata.dbt_schema_version).toContain(
              `/run-results/v${version}.json`,
            );
            expect(runResults.results).toBeDefined();
            expect(Array.isArray(runResults.results)).toBe(true);
          });

          it(`should parse ${fileName} with version-specific parser`, () => {
            const jsonContent = fs.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
            const parser = versionParsers[version - 1];

            if (parser) {
              const runResults = parser(parsed);
              expect(runResults).toBeDefined();
              expect(runResults.metadata.dbt_schema_version).toContain(
                `/run-results/v${version}.json`,
              );
            }
          });

          it(`should accept ${fileName} as ParsedRunResults union type`, () => {
            const jsonContent = fs.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
            const runResults: ParsedRunResults = parseRunResults(parsed);

            expect(runResults).toBeDefined();
            expect(runResults.metadata).toBeDefined();
          });
        }
      });
    }
  });
});
