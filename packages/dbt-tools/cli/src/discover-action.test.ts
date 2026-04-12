import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
} from "@dbt-tools/core";
import { discoverAction } from "./discover-action";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dbt-cli-discover-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
});

function touch(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "{}");
}

function runDiscover(
  options: Parameters<typeof discoverAction>[0],
): { stdout: string; error: Error | null } {
  const lines: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => lines.push(args.join(" "));

  let capturedError: Error | null = null;
  const handleError = (err: unknown) => {
    capturedError = err instanceof Error ? err : new Error(String(err));
  };

  try {
    discoverAction(options, handleError, () => true);
  } finally {
    console.log = originalLog;
  }

  return { stdout: lines.join("\n"), error: capturedError };
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe("discoverAction", () => {
  it("reports a valid artifact set with required pair only", () => {
    const dir = makeTempDir();
    touch(path.join(dir, DBT_MANIFEST_JSON));
    touch(path.join(dir, DBT_RUN_RESULTS_JSON));

    const { stdout, error } = runDiscover({
      sourceType: "local",
      location: dir,
    });

    expect(error).toBeNull();
    expect(stdout).toContain("1 complete artifact set");
    expect(stdout).toContain(DBT_MANIFEST_JSON);
    expect(stdout).toContain(DBT_RUN_RESULTS_JSON);
    expect(stdout).toContain("(not found — optional)");
  });

  it("reports all four artifacts when catalog and sources are present", () => {
    const dir = makeTempDir();
    touch(path.join(dir, DBT_MANIFEST_JSON));
    touch(path.join(dir, DBT_RUN_RESULTS_JSON));
    touch(path.join(dir, DBT_CATALOG_JSON));
    touch(path.join(dir, DBT_SOURCES_JSON));

    const { stdout, error } = runDiscover({
      sourceType: "local",
      location: dir,
    });

    expect(error).toBeNull();
    expect(stdout).toContain("All artifacts present");
    // Optional files should show ✓ (not "not found")
    expect(stdout.split("not found")).toHaveLength(1);
  });

  it("reports failure when manifest.json is missing", () => {
    const dir = makeTempDir();
    touch(path.join(dir, DBT_RUN_RESULTS_JSON));

    const { stdout, error } = runDiscover({
      sourceType: "local",
      location: dir,
    });

    expect(error).toBeNull();
    expect(stdout).toContain("Required artifact pair not found");
    expect(stdout).toContain("0 complete artifact sets");
  });

  it("reports failure when run_results.json is missing", () => {
    const dir = makeTempDir();
    touch(path.join(dir, DBT_MANIFEST_JSON));

    const { stdout, error } = runDiscover({
      sourceType: "local",
      location: dir,
    });

    expect(error).toBeNull();
    expect(stdout).toContain("Required artifact pair not found");
  });

  it("defaults to --source-type local when not specified", () => {
    const dir = makeTempDir();
    touch(path.join(dir, DBT_MANIFEST_JSON));
    touch(path.join(dir, DBT_RUN_RESULTS_JSON));

    const { error } = runDiscover({ location: dir });
    expect(error).toBeNull();
  });

  it("uses --target-dir when --location is not provided", () => {
    const dir = makeTempDir();
    touch(path.join(dir, DBT_MANIFEST_JSON));
    touch(path.join(dir, DBT_RUN_RESULTS_JSON));

    const { error } = runDiscover({ targetDir: dir });
    expect(error).toBeNull();
  });

  it("rejects s3 source type with a clear error", () => {
    const { error } = runDiscover({
      sourceType: "s3",
      location: "my-bucket/prefix",
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain("web server");
  });

  it("rejects gcs source type with a clear error", () => {
    const { error } = runDiscover({
      sourceType: "gcs",
      location: "my-bucket/prefix",
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain("web server");
  });

  it("rejects an invalid source type", () => {
    const dir = makeTempDir();
    const { error } = runDiscover({
      sourceType: "ftp",
      location: dir,
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain("Invalid --source-type");
  });

  it("rejects path traversal in location", () => {
    const { error } = runDiscover({
      sourceType: "local",
      location: "../../etc/passwd",
    });

    expect(error).not.toBeNull();
  });

  it("outputs valid JSON with --json flag", () => {
    const dir = makeTempDir();
    touch(path.join(dir, DBT_MANIFEST_JSON));
    touch(path.join(dir, DBT_RUN_RESULTS_JSON));

    const lines: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => lines.push(args.join(" "));

    discoverAction({ sourceType: "local", location: dir, json: true }, () => {}, () => false);
    console.log = originalLog;

    const parsed = JSON.parse(lines.join("\n")) as { source_type: string; candidates: unknown[] };
    expect(parsed.source_type).toBe("local");
    expect(Array.isArray(parsed.candidates)).toBe(true);
  });
});
