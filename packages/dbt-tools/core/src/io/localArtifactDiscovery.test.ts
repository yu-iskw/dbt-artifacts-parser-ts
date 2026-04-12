import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  discoverLocalArtifactRuns,
  validateArtifactLocationLocal,
} from "./localArtifactDiscovery";
import {
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
} from "./artifact-filenames";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dbt-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
});

function touch(filePath: string, mtimeOffset = 0): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "{}");
  if (mtimeOffset !== 0) {
    const now = Date.now() + mtimeOffset;
    fs.utimesSync(filePath, now / 1000, now / 1000);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// discoverLocalArtifactRuns
// ────────────────────────────────────────────────────────────────────────────

describe("discoverLocalArtifactRuns", () => {
  it("returns a single 'current' candidate when required pair exists at root", () => {
    const dir = makeTempDir();
    touch(path.join(dir, DBT_MANIFEST_JSON));
    touch(path.join(dir, DBT_RUN_RESULTS_JSON));

    const runs = discoverLocalArtifactRuns(dir);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.runId).toBe("current");
    expect(runs[0]!.manifestPath).toBe(
      path.join(dir, DBT_MANIFEST_JSON),
    );
    expect(runs[0]!.runResultsPath).toBe(
      path.join(dir, DBT_RUN_RESULTS_JSON),
    );
    expect(runs[0]!.catalogPath).toBeUndefined();
    expect(runs[0]!.sourcesPath).toBeUndefined();
  });

  it("includes catalogPath and sourcesPath when optional artifacts exist", () => {
    const dir = makeTempDir();
    touch(path.join(dir, DBT_MANIFEST_JSON));
    touch(path.join(dir, DBT_RUN_RESULTS_JSON));
    touch(path.join(dir, DBT_CATALOG_JSON));
    touch(path.join(dir, DBT_SOURCES_JSON));

    const [run] = discoverLocalArtifactRuns(dir);
    expect(run?.catalogPath).toBe(path.join(dir, DBT_CATALOG_JSON));
    expect(run?.sourcesPath).toBe(path.join(dir, DBT_SOURCES_JSON));
  });

  it("returns empty array when manifest.json is missing", () => {
    const dir = makeTempDir();
    touch(path.join(dir, DBT_RUN_RESULTS_JSON));

    expect(discoverLocalArtifactRuns(dir)).toHaveLength(0);
  });

  it("returns empty array when run_results.json is missing", () => {
    const dir = makeTempDir();
    touch(path.join(dir, DBT_MANIFEST_JSON));

    expect(discoverLocalArtifactRuns(dir)).toHaveLength(0);
  });

  it("returns empty array for non-existent directory", () => {
    const dir = "/tmp/definitely-does-not-exist-" + Date.now().toString();
    expect(discoverLocalArtifactRuns(dir)).toHaveLength(0);
  });

  it("returns empty array for a file path (not a directory)", () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, "somefile.txt");
    fs.writeFileSync(filePath, "hi");
    expect(discoverLocalArtifactRuns(filePath)).toHaveLength(0);
  });

  it("discovers candidate sets from immediate subdirectories", () => {
    const dir = makeTempDir();
    const run1Dir = path.join(dir, "2026-01-01");
    const run2Dir = path.join(dir, "2026-01-02");

    touch(path.join(run1Dir, DBT_MANIFEST_JSON), -2000);
    touch(path.join(run1Dir, DBT_RUN_RESULTS_JSON), -2000);
    touch(path.join(run2Dir, DBT_MANIFEST_JSON), -1000);
    touch(path.join(run2Dir, DBT_RUN_RESULTS_JSON), -1000);

    const runs = discoverLocalArtifactRuns(dir);
    // Root has no required pair → only subdirs
    expect(runs).toHaveLength(2);
    const runIds = runs.map((r) => r.runId);
    expect(runIds).toContain("2026-01-01");
    expect(runIds).toContain("2026-01-02");
  });

  it("excludes subdirectories missing the required pair", () => {
    const dir = makeTempDir();
    const completeDir = path.join(dir, "complete");
    const incompleteDir = path.join(dir, "incomplete");

    touch(path.join(completeDir, DBT_MANIFEST_JSON));
    touch(path.join(completeDir, DBT_RUN_RESULTS_JSON));
    touch(path.join(incompleteDir, DBT_MANIFEST_JSON)); // missing run_results

    const runs = discoverLocalArtifactRuns(dir);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.runId).toBe("complete");
  });

  it("sorts results newest-first by required artifact mtime", () => {
    const dir = makeTempDir();
    const oldDir = path.join(dir, "old-run");
    const newDir = path.join(dir, "new-run");

    touch(path.join(oldDir, DBT_MANIFEST_JSON), -10_000);
    touch(path.join(oldDir, DBT_RUN_RESULTS_JSON), -10_000);
    touch(path.join(newDir, DBT_MANIFEST_JSON), -1_000);
    touch(path.join(newDir, DBT_RUN_RESULTS_JSON), -1_000);

    const runs = discoverLocalArtifactRuns(dir);
    expect(runs[0]!.runId).toBe("new-run");
    expect(runs[1]!.runId).toBe("old-run");
  });

  it("includes root 'current' alongside subdirectory candidates", () => {
    const dir = makeTempDir();
    touch(path.join(dir, DBT_MANIFEST_JSON));
    touch(path.join(dir, DBT_RUN_RESULTS_JSON));

    const subDir = path.join(dir, "archived");
    touch(path.join(subDir, DBT_MANIFEST_JSON), -5000);
    touch(path.join(subDir, DBT_RUN_RESULTS_JSON), -5000);

    const runs = discoverLocalArtifactRuns(dir);
    expect(runs).toHaveLength(2);
    const runIds = runs.map((r) => r.runId);
    expect(runIds).toContain("current");
    expect(runIds).toContain("archived");
  });

  it("throws on path traversal attempt", () => {
    expect(() => discoverLocalArtifactRuns("../../etc/passwd")).toThrow();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// validateArtifactLocationLocal
// ────────────────────────────────────────────────────────────────────────────

describe("validateArtifactLocationLocal", () => {
  it("is valid when both required artifacts exist", () => {
    const dir = makeTempDir();
    touch(path.join(dir, DBT_MANIFEST_JSON));
    touch(path.join(dir, DBT_RUN_RESULTS_JSON));

    const result = validateArtifactLocationLocal(dir);
    expect(result.valid).toBe(true);
    expect(result.missingRequired).toHaveLength(0);
    expect(result.missingOptional).toContain(DBT_CATALOG_JSON);
    expect(result.missingOptional).toContain(DBT_SOURCES_JSON);
  });

  it("reports missing manifest.json", () => {
    const dir = makeTempDir();
    touch(path.join(dir, DBT_RUN_RESULTS_JSON));

    const result = validateArtifactLocationLocal(dir);
    expect(result.valid).toBe(false);
    expect(result.missingRequired).toContain(DBT_MANIFEST_JSON);
  });

  it("reports missing run_results.json", () => {
    const dir = makeTempDir();
    touch(path.join(dir, DBT_MANIFEST_JSON));

    const result = validateArtifactLocationLocal(dir);
    expect(result.valid).toBe(false);
    expect(result.missingRequired).toContain(DBT_RUN_RESULTS_JSON);
  });

  it("all four present → valid with no missing optional", () => {
    const dir = makeTempDir();
    touch(path.join(dir, DBT_MANIFEST_JSON));
    touch(path.join(dir, DBT_RUN_RESULTS_JSON));
    touch(path.join(dir, DBT_CATALOG_JSON));
    touch(path.join(dir, DBT_SOURCES_JSON));

    const result = validateArtifactLocationLocal(dir);
    expect(result.valid).toBe(true);
    expect(result.missingOptional).toHaveLength(0);
  });
});
