import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ArtifactLoader } from "./artifact-loader";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import {
  loadTestManifest,
  loadTestRunResults,
} from "dbt-artifacts-parser/test-utils";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseManifest } from "dbt-artifacts-parser/manifest";

describe("ArtifactLoader", () => {
  let tempDir: string;
  const originalEnv = process.env.DBT_TARGET_DIR;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dbt-tools-test-"));
    delete process.env.DBT_TARGET_DIR;
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (originalEnv) {
      process.env.DBT_TARGET_DIR = originalEnv;
    } else {
      delete process.env.DBT_TARGET_DIR;
    }
  });

  describe("resolveArtifactPaths", () => {
    it("should default to ./target directory", () => {
      const result = ArtifactLoader.resolveArtifactPaths();
      expect(result.manifest).toContain("target");
      expect(result.manifest).toContain("manifest.json");
    });

    it("should use custom target directory", () => {
      const result = ArtifactLoader.resolveArtifactPaths(
        undefined,
        undefined,
        tempDir,
      );
      expect(result.manifest).toBe(path.join(tempDir, "manifest.json"));
    });

    it("should use DBT_TARGET_DIR environment variable", () => {
      process.env.DBT_TARGET_DIR = tempDir;
      const result = ArtifactLoader.resolveArtifactPaths();
      expect(result.manifest).toBe(path.join(tempDir, "manifest.json"));
    });

    it("should handle explicit manifest path", () => {
      const manifestPath = path.join(tempDir, "custom-manifest.json");
      const result = ArtifactLoader.resolveArtifactPaths(manifestPath);
      expect(result.manifest).toBe(path.resolve(manifestPath));
    });

    it("should handle directory path for manifest", () => {
      const result = ArtifactLoader.resolveArtifactPaths(tempDir);
      expect(result.manifest).toBe(path.join(tempDir, "manifest.json"));
    });

    it("should resolve run results path", () => {
      const result = ArtifactLoader.resolveArtifactPaths(
        undefined,
        tempDir,
        undefined,
      );
      expect(result.runResults).toBe(path.join(tempDir, "run_results.json"));
    });

    it("should handle absolute paths", () => {
      const absPath = path.resolve(tempDir, "manifest.json");
      const result = ArtifactLoader.resolveArtifactPaths(absPath);
      expect(result.manifest).toBe(absPath);
    });
  });

  describe("loadManifest", () => {
    it("should load and parse valid manifest", () => {
      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifestPath = path.join(tempDir, "manifest.json");
      fs.writeFileSync(manifestPath, JSON.stringify(manifestJson), "utf-8");

      const manifest = ArtifactLoader.loadManifest(manifestPath);
      expect(manifest).toBeDefined();
      expect(manifest.metadata).toBeDefined();
    });

    it("should throw error for missing file", () => {
      const missingPath = path.join(tempDir, "nonexistent.json");
      expect(() => ArtifactLoader.loadManifest(missingPath)).toThrow(
        "Manifest file not found",
      );
    });

    it("should throw error for invalid JSON", () => {
      const invalidPath = path.join(tempDir, "manifest.json");
      fs.writeFileSync(invalidPath, "invalid json", "utf-8");

      expect(() => ArtifactLoader.loadManifest(invalidPath)).toThrow(
        "Failed to parse manifest file",
      );
    });
  });

  describe("loadRunResults", () => {
    it("should load and parse valid run results", () => {
      const runResultsJson = loadTestRunResults("v6", "run_results.json");
      const runResultsPath = path.join(tempDir, "run_results.json");
      fs.writeFileSync(runResultsPath, JSON.stringify(runResultsJson), "utf-8");

      const parsed = ArtifactLoader.loadRunResults(runResultsPath);
      expect(parsed).toBeDefined();
      expect(parsed.metadata).toBeDefined();
    });

    it("should throw error for missing file", () => {
      const missingPath = path.join(tempDir, "nonexistent.json");
      expect(() => ArtifactLoader.loadRunResults(missingPath)).toThrow(
        "Run results file not found",
      );
    });

    it("should throw error for invalid JSON", () => {
      const invalidPath = path.join(tempDir, "run_results.json");
      fs.writeFileSync(invalidPath, "invalid json", "utf-8");

      expect(() => ArtifactLoader.loadRunResults(invalidPath)).toThrow(
        "Failed to parse run results file",
      );
    });
  });
});
