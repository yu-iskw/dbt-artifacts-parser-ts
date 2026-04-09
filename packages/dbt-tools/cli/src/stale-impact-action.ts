/**
 * Stale-impact CLI action handler and helpers.
 */
import {
  ManifestGraph,
  SourceFreshnessAnalyzer,
  resolveArtifactPaths,
  loadManifest,
  loadSources,
  validateSafePath,
  validateResourceId,
  formatOutput,
  shouldOutputJSON,
  FieldFilter,
  type StaleImpactReport,
} from "@dbt-tools/core";

type StaleImpactOptions = {
  targetDir?: string;
  manifestPath?: string;
  sourcesPath?: string;
  depth?: number;
  fields?: string;
  json?: boolean;
  noJson?: boolean;
};

/**
 * Format stale impact report as human-readable output.
 */
export function formatStaleImpact(report: StaleImpactReport): string {
  const lines: string[] = [];
  lines.push("Stale Impact Report");
  lines.push("===================");
  lines.push("");

  // Source info
  const sourceLabel = report.source.source_name
    ? `${report.source.source_name}.${report.source.name}`
    : report.source.unique_id;
  lines.push(`Source: ${sourceLabel}`);
  if (report.source.status) {
    lines.push(`Status: ${report.source.status}`);
  }
  lines.push("");

  // Impact summary
  lines.push("Impact Summary:");
  lines.push(`  Direct downstream: ${report.direct_downstream_count}`);
  lines.push(`  Total downstream: ${report.total_downstream_count}`);

  if (Object.keys(report.impacted_counts_by_type).length > 0) {
    lines.push("");
    lines.push("Impacted by type:");
    for (const [type, count] of Object.entries(
      report.impacted_counts_by_type,
    )) {
      lines.push(`  ${type}: ${count}`);
    }
  }

  // Impacted nodes
  if (report.impacted_nodes.length > 0) {
    lines.push("");
    lines.push("Impacted nodes (by depth):");
    lines.push("---------------------------");

    let currentDepth = -1;
    for (const node of report.impacted_nodes) {
      if (node.depth !== currentDepth) {
        currentDepth = node.depth;
        lines.push(`\nDepth ${currentDepth}:`);
      }
      const nodeLabel = node.name || node.unique_id;
      lines.push(
        `  [${node.resource_type || "unknown"}] ${nodeLabel}`,
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Load sources and create analyzer (optional).
 */
function loadSourcesAnalyzer(
  paths: ReturnType<typeof resolveArtifactPaths>,
): SourceFreshnessAnalyzer | undefined {
  try {
    validateSafePath(paths.sources!);
    const sources = loadSources(paths.sources!);
    return new SourceFreshnessAnalyzer(sources);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Sources file not found")) {
      // Sources are optional for this command
      return undefined;
    }
    throw error;
  }
}

/**
 * Enrich report with freshness data if analyzer available.
 */
function enrichReportWithFreshness(
  report: StaleImpactReport,
  analyzer: SourceFreshnessAnalyzer | undefined,
  sourceUniqueId: string,
): void {
  if (!analyzer) return;

  const summary = analyzer.summarize();
  const sourceEntry = summary.entries.find(
    (e) => e.unique_id === sourceUniqueId,
  );
  if (sourceEntry) {
    report.source.status = sourceEntry.status;
    report.source.name = sourceEntry.name;
    report.source.source_name = sourceEntry.source_name;
  }
}

/**
 * Apply depth limiting to report.
 */
function applyDepthLimit(
  report: StaleImpactReport,
  depth: number | undefined,
): void {
  if (depth === undefined || depth < 0) return;

  report.impacted_nodes = report.impacted_nodes.filter(
    (n) => n.depth <= depth,
  );

  // Recalculate counts
  const countsByType: Record<string, number> = {};
  for (const node of report.impacted_nodes) {
    const type = node.resource_type || "unknown";
    countsByType[type] = (countsByType[type] || 0) + 1;
  }
  report.impacted_counts_by_type = countsByType;
  report.total_downstream_count = report.impacted_nodes.length;
}

/**
 * Stale-impact action handler
 */
export function staleImpactAction(
  sourceUniqueId: string,
  options: StaleImpactOptions,
  handleError: (error: unknown, isTTY: boolean) => void,
  isTTY: () => boolean,
): void {
  try {
    // Validate unique_id format
    validateResourceId(sourceUniqueId);

    // Resolve artifact paths
    const paths = resolveArtifactPaths(
      options.manifestPath,
      undefined,
      options.targetDir,
      undefined,
      options.sourcesPath,
    );

    // Validate and load manifest (required for graph)
    validateSafePath(paths.manifest);
    const manifest = loadManifest(paths.manifest);
    const graph = new ManifestGraph(manifest);
    let report = graph.getStaleImpact(sourceUniqueId);

    // Load sources for enrichment (optional)
    const analyzer = loadSourcesAnalyzer(paths);
    enrichReportWithFreshness(report, analyzer, sourceUniqueId);

    // Apply depth limiting
    applyDepthLimit(report, options.depth);

    // Apply field filtering if requested
    if (options.fields) {
      report = FieldFilter.filterFields(
        report,
        options.fields,
      ) as StaleImpactReport;
    }

    // Format output
    const useJson = shouldOutputJSON(options.json, options.noJson);

    if (useJson) {
      console.log(formatOutput(report, true));
    } else {
      console.log(formatStaleImpact(report));
    }
  } catch (error) {
    handleError(error, isTTY());
  }
}
