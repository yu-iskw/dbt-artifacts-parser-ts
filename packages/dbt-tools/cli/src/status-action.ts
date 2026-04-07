/**
 * Status / freshness CLI action handler.
 * Reports artifact presence, modification times, and analysis readiness.
 */
import * as fs from "fs";
import * as path from "path";
import {
  resolveArtifactPaths,
  validateSafePath,
  formatOutput,
  shouldOutputJSON,
} from "@dbt-tools/core";

export type StatusOptions = {
  targetDir?: string;
  json?: boolean;
  noJson?: boolean;
};

export type ArtifactFileStatus = {
  path: string;
  exists: boolean;
  modified_at?: string;
  age_seconds?: number;
};

export type StatusResult = {
  target_dir: string;
  manifest: ArtifactFileStatus;
  run_results: ArtifactFileStatus;
  readiness: "manifest-only" | "full" | "unavailable";
  latest_modified_at?: string;
  age_seconds?: number;
  summary: string;
};

function getFileStatus(filePath: string): ArtifactFileStatus {
  try {
    const stat = fs.statSync(filePath);
    const modifiedAt = stat.mtime.toISOString();
    const ageSeconds = Math.floor((Date.now() - stat.mtime.getTime()) / 1000);
    return {
      path: filePath,
      exists: true,
      modified_at: modifiedAt,
      age_seconds: ageSeconds,
    };
  } catch {
    return { path: filePath, exists: false };
  }
}

function humanAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Format status as human-readable output.
 */
export function formatStatus(result: StatusResult): string {
  const lines: string[] = [];
  lines.push("dbt Artifact Status");
  lines.push("===================");
  lines.push(`Target dir:   ${result.target_dir}`);
  lines.push(`Readiness:    ${result.readiness}`);
  lines.push("");

  const mIcon = result.manifest.exists ? "✓" : "✗";
  lines.push(`${mIcon} manifest.json`);
  lines.push(`    path:     ${result.manifest.path}`);
  if (result.manifest.exists) {
    lines.push(`    modified: ${result.manifest.modified_at}`);
    if (result.manifest.age_seconds !== undefined) {
      lines.push(`    age:      ${humanAge(result.manifest.age_seconds)}`);
    }
  } else {
    lines.push("    (not found)");
  }

  lines.push("");
  const rrIcon = result.run_results.exists ? "✓" : "✗";
  lines.push(`${rrIcon} run_results.json`);
  lines.push(`    path:     ${result.run_results.path}`);
  if (result.run_results.exists) {
    lines.push(`    modified: ${result.run_results.modified_at}`);
    if (result.run_results.age_seconds !== undefined) {
      lines.push(`    age:      ${humanAge(result.run_results.age_seconds)}`);
    }
  } else {
    lines.push("    (not found)");
  }

  if (result.latest_modified_at) {
    lines.push("");
    lines.push(`Latest artifact: ${result.latest_modified_at}`);
    if (result.age_seconds !== undefined) {
      lines.push(`Age:             ${humanAge(result.age_seconds)}`);
    }
  }

  lines.push("");
  lines.push(`Summary: ${result.summary}`);

  return lines.join("\n");
}

/**
 * Status / freshness action handler
 */
export function statusAction(
  options: StatusOptions,
  handleError: (error: unknown, isTTY: boolean) => void,
  isTTY: () => boolean,
): void {
  try {
    const paths = resolveArtifactPaths(
      undefined,
      undefined,
      options.targetDir,
    );

    // Validate paths before accessing filesystem
    validateSafePath(paths.manifest);
    validateSafePath(paths.runResults);

    const manifestStatus = getFileStatus(paths.manifest);
    const runResultsStatus = getFileStatus(paths.runResults);

    // Determine target dir from the manifest path using path.dirname for portability
    const targetDir = path.dirname(paths.manifest) || ".";

    let readiness: StatusResult["readiness"];
    if (!manifestStatus.exists) {
      readiness = "unavailable";
    } else if (!runResultsStatus.exists) {
      readiness = "manifest-only";
    } else {
      readiness = "full";
    }

    // Latest modified artifact
    let latestModifiedAt: string | undefined;
    let latestAgeSeconds: number | undefined;

    const candidates: ArtifactFileStatus[] = [
      manifestStatus,
      runResultsStatus,
    ].filter((f) => f.exists);

    if (candidates.length > 0) {
      const latest = candidates.reduce((prev, cur) => {
        if (!prev.modified_at) return cur;
        if (!cur.modified_at) return prev;
        return cur.modified_at > prev.modified_at ? cur : prev;
      });
      latestModifiedAt = latest.modified_at;
      latestAgeSeconds = latest.age_seconds;
    }

    const summaryMap: Record<StatusResult["readiness"], string> = {
      full: "All artifacts present. Manifest and execution analysis available.",
      "manifest-only":
        "manifest.json found; run_results.json missing. Execution analysis unavailable.",
      unavailable:
        "manifest.json not found. Most commands require manifest.json.",
    };

    const result: StatusResult = {
      target_dir: targetDir,
      manifest: manifestStatus,
      run_results: runResultsStatus,
      readiness,
      latest_modified_at: latestModifiedAt,
      age_seconds: latestAgeSeconds,
      summary: summaryMap[readiness],
    };

    const useJson = shouldOutputJSON(options.json, options.noJson);

    if (useJson) {
      console.log(formatOutput(result, true));
    } else {
      console.log(formatStatus(result));
    }
  } catch (error) {
    handleError(error, isTTY());
  }
}
