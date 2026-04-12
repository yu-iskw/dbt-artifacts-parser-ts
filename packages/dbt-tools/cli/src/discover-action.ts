/**
 * discover action: scan a local directory for dbt artifact candidate sets.
 * Reports which artifacts are present, which are missing, and whether the
 * required pair (manifest.json + run_results.json) is available.
 */
import {
  discoverLocalArtifactRuns,
  formatOutput,
  validateSafePath,
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
  type LocalArtifactRun,
} from "@dbt-tools/core";

export type DiscoverOptions = {
  sourceType?: string;
  location?: string;
  targetDir?: string;
  json?: boolean;
  noJson?: boolean;
};

export interface DiscoverArtifactResult {
  run_id: string;
  manifest: string;
  run_results: string;
  catalog?: string;
  sources?: string;
  updated_at: string;
  missing_optional: string[];
}

export interface DiscoverResult {
  source_type: string;
  location: string;
  candidate_count: number;
  candidates: DiscoverArtifactResult[];
  required_pair_present: boolean;
  summary: string;
}

function formatArtifactResult(run: LocalArtifactRun): DiscoverArtifactResult {
  const missingOptional: string[] = [];
  if (run.catalogPath == null) missingOptional.push(DBT_CATALOG_JSON);
  if (run.sourcesPath == null) missingOptional.push(DBT_SOURCES_JSON);

  return {
    run_id: run.runId,
    manifest: run.manifestPath,
    run_results: run.runResultsPath,
    ...(run.catalogPath != null ? { catalog: run.catalogPath } : {}),
    ...(run.sourcesPath != null ? { sources: run.sourcesPath } : {}),
    updated_at: new Date(run.updatedAtMs).toISOString(),
    missing_optional: missingOptional,
  };
}

function formatCandidateLines(candidate: DiscoverArtifactResult): string[] {
  const lines: string[] = [];
  lines.push(`Run: ${candidate.run_id}`);
  lines.push(`  ✓ ${DBT_MANIFEST_JSON}   ${candidate.manifest}`);
  lines.push(`  ✓ ${DBT_RUN_RESULTS_JSON}  ${candidate.run_results}`);
  lines.push(
    candidate.catalog
      ? `  ✓ ${DBT_CATALOG_JSON}     ${candidate.catalog}`
      : `  ✗ ${DBT_CATALOG_JSON}     (not found — optional)`,
  );
  lines.push(
    candidate.sources
      ? `  ✓ ${DBT_SOURCES_JSON}      ${candidate.sources}`
      : `  ✗ ${DBT_SOURCES_JSON}      (not found — optional)`,
  );
  lines.push(`  Updated:  ${candidate.updated_at}`);
  if (candidate.missing_optional.length > 0) {
    lines.push(
      `  Note: Features requiring ${candidate.missing_optional.join(", ")} will be unavailable.`,
    );
  }
  lines.push("");
  return lines;
}

function formatDiscoverOutput(result: DiscoverResult): string {
  const setWord = result.candidate_count === 1 ? "set" : "sets";
  const lines: string[] = [
    "dbt Artifact Discovery",
    "======================",
    `Source type:  ${result.source_type}`,
    `Location:     ${result.location}`,
    `Candidates:   ${result.candidate_count} complete artifact ${setWord}`,
    "",
  ];

  if (result.candidates.length === 0) {
    lines.push("✗  No complete artifact set found.");
    lines.push("   Both manifest.json and run_results.json are required.");
  } else {
    for (const candidate of result.candidates) {
      lines.push(...formatCandidateLines(candidate));
    }
  }

  lines.push(`Summary: ${result.summary}`);
  return lines.join("\n");
}

/**
 * discover action handler.
 * Supports --source-type local (S3/GCS require the web server).
 */
export function discoverAction(
  options: DiscoverOptions,
  handleError: (error: unknown, isTTY: boolean) => void,
  isTTY: () => boolean,
): void {
  try {
    const sourceType = options.sourceType ?? "local";

    if (sourceType === "s3" || sourceType === "gcs") {
      throw new Error(
        `--source-type ${sourceType} requires the web server (configure DBT_TOOLS_REMOTE_SOURCE and use the web UI). ` +
          "The CLI discover command currently supports local sources only.",
      );
    }

    if (sourceType !== "local") {
      throw new Error(
        `Invalid --source-type "${sourceType}". Accepted values: local, s3, gcs.`,
      );
    }

    // Resolve location: --location takes precedence, then --target-dir, then cwd.
    const location = options.location ?? options.targetDir ?? ".";
    validateSafePath(location);

    const runs = discoverLocalArtifactRuns(location);
    const candidates = runs.map(formatArtifactResult);

    const summary =
      candidates.length === 0
        ? "Required artifact pair not found. Provide manifest.json and run_results.json."
        : candidates.length === 1
          ? `1 complete artifact set found. ${candidates[0]!.missing_optional.length > 0 ? `Missing optional: ${candidates[0]!.missing_optional.join(", ")}.` : "All artifacts present."}`
          : `${candidates.length} complete artifact sets found.`;

    const result: DiscoverResult = {
      source_type: sourceType,
      location,
      candidate_count: candidates.length,
      candidates,
      required_pair_present: candidates.length > 0,
      summary,
    };

    const useJson =
      options.noJson === true
        ? false
        : options.json === true
          ? true
          : !isTTY();
    if (useJson) {
      console.log(formatOutput(result, true));
    } else {
      console.log(formatDiscoverOutput(result));
    }
  } catch (error) {
    handleError(error, isTTY());
  }
}
