/**
 * Freshness-report CLI action handler and helpers.
 */
import {
  SourceFreshnessAnalyzer,
  resolveArtifactPaths,
  loadManifest,
  loadSources,
  validateSafePath,
  formatOutput,
  shouldOutputJSON,
  FieldFilter,
  type SourceFreshnessSummary,
  type SourceFreshnessEntry,
} from "@dbt-tools/core";

type FreshnessReportOptions = {
  targetDir?: string;
  manifestPath?: string;
  fields?: string;
  status?: string;
  staleOnly?: boolean;
  json?: boolean;
  noJson?: boolean;
};

/**
 * Format age in seconds to human-readable format.
 */
function formatAge(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/**
 * Format a single freshness entry for human output.
 */
function formatFreshnessEntry(entry: SourceFreshnessEntry): string[] {
  const lines: string[] = [];
  const sourceLabel = entry.source_name
    ? `${entry.source_name}.${entry.name}`
    : entry.name || entry.unique_id;
  const statusBadge = entry.status === "pass" ? "✓" : "⚠";
  lines.push(`${statusBadge} ${sourceLabel} [${entry.status}]`);

  if (entry.max_loaded_at) {
    lines.push(`    max_loaded_at: ${entry.max_loaded_at}`);
  }
  if (entry.age_seconds !== undefined) {
    lines.push(`    age: ${formatAge(entry.age_seconds)}`);
  }
  if (entry.execution_time !== undefined) {
    lines.push(`    execution_time: ${entry.execution_time.toFixed(2)}s`);
  }
  lines.push("");

  return lines;
}

/**
 * Format source freshness summary as human-readable output.
 */
export function formatFreshnessReport(summary: SourceFreshnessSummary): string {
  const lines: string[] = [];
  lines.push("Source Freshness Report");
  lines.push("=======================");
  lines.push("");

  // Summary counts
  lines.push(`Total sources: ${summary.total}`);
  if (Object.keys(summary.counts_by_status).length > 0) {
    lines.push("Status breakdown:");
    for (const [status, count] of Object.entries(summary.counts_by_status)) {
      lines.push(`  ${status}: ${count}`);
    }
  }
  lines.push("");

  // Entries
  if (summary.entries.length > 0) {
    lines.push("Sources:");
    lines.push("---------");
    for (const entry of summary.entries) {
      lines.push(...formatFreshnessEntry(entry));
    }
  }

  return lines.join("\n");
}

/**
 * Apply status filtering to summary.
 */
function applyStatusFilter(
  analyzer: SourceFreshnessAnalyzer,
  options: FreshnessReportOptions,
): SourceFreshnessSummary {
  if (options.status) {
    const statuses = options.status.split(",").map((s) => s.trim());
    return analyzer.filterByStatus(statuses);
  }
  if (options.staleOnly) {
    return analyzer.filterByStatus(["warn", "error", "runtime error"]);
  }
  return analyzer.summarize();
}

/**
 * Enrich summary with manifest data if available.
 */
function enrichSummaryIfAvailable(
  analyzer: SourceFreshnessAnalyzer,
  paths: ReturnType<typeof resolveArtifactPaths>,
  options: FreshnessReportOptions,
): SourceFreshnessSummary {
  const shouldEnrich =
    options.manifestPath || (!options.targetDir);

  if (!shouldEnrich) {
    return applyStatusFilter(analyzer, options);
  }

  try {
    const manifest = loadManifest(paths.manifest);
    let summary = analyzer.enrichWithManifest(manifest);

    // Re-apply filtering after enrichment
    if (options.status) {
      const statuses = options.status.split(",").map((s) => s.trim());
      summary = {
        ...summary,
        entries: summary.entries.filter((e) =>
          statuses.includes(e.status),
        ),
      };
    } else if (options.staleOnly) {
      summary = {
        ...summary,
        entries: summary.entries.filter((e) =>
          ["warn", "error", "runtime error"].includes(e.status),
        ),
      };
    }

    return summary;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Manifest file not found")) {
      // Manifest is optional, continue without it
      return applyStatusFilter(analyzer, options);
    }
    throw error;
  }
}

/**
 * Freshness-report action handler
 */
export function freshnessReportAction(
  sourcesPath: string | undefined,
  manifestPath: string | undefined,
  options: FreshnessReportOptions,
  handleError: (error: unknown, isTTY: boolean) => void,
  isTTY: () => boolean,
): void {
  try {
    // Resolve artifact paths
    const paths = resolveArtifactPaths(
      manifestPath,
      undefined,
      options.targetDir,
      undefined,
      sourcesPath,
    );

    // Validate paths
    validateSafePath(paths.sources!);

    // Load sources
    const sources = loadSources(paths.sources!);
    const analyzer = new SourceFreshnessAnalyzer(sources);

    // Get summary with filtering and enrichment
    let summary = enrichSummaryIfAvailable(analyzer, paths, options);

    // Apply field filtering if requested
    if (options.fields) {
      summary = {
        ...summary,
        entries: summary.entries.map((entry) =>
          FieldFilter.filterFields(entry, options.fields!) as typeof entry,
        ),
      };
    }

    // Format output
    const useJson = shouldOutputJSON(options.json, options.noJson);

    if (useJson) {
      console.log(formatOutput(summary, true));
    } else {
      console.log(formatFreshnessReport(summary));
    }
  } catch (error) {
    handleError(error, isTTY());
  }
}
