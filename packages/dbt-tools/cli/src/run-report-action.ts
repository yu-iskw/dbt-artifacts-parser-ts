/**
 * Run-report CLI action handler and helpers.
 */
import {
  ManifestGraph,
  ExecutionAnalyzer,
  resolveArtifactPaths,
  loadManifest,
  loadRunResults,
  validateSafePath,
  FieldFilter,
  detectBottlenecks,
  formatOutput,
  formatRunReport,
  shouldOutputJSON,
} from "@dbt-tools/core";

type RunReportOptions = {
  targetDir?: string;
  fields?: string;
  bottlenecks?: boolean;
  bottlenecksTop?: number;
  bottlenecksThreshold?: number;
  json?: boolean;
  noJson?: boolean;
};

interface ExecutionSummary {
  total_execution_time: number;
  total_nodes: number;
  nodes_by_status: Record<string, number>;
  node_executions: Array<{
    unique_id: string;
    status: string;
    execution_time: number;
  }>;
}

/** Create a minimal summary when no analyzer is available */
function createMinimalSummary(
  runResults: ReturnType<typeof loadRunResults>,
): ExecutionSummary {
  const nodesByStatus: Record<string, number> = {};
  if (runResults.results) {
    for (const result of runResults.results) {
      const status = result.status || "unknown";
      nodesByStatus[status] = (nodesByStatus[status] || 0) + 1;
    }
  }
  return {
    total_execution_time: runResults.elapsed_time || 0,
    total_nodes: runResults.results?.length || 0,
    nodes_by_status: nodesByStatus,
    node_executions: [],
  };
}

/** Compute bottlenecks from summary and options */
function computeBottlenecksSection(
  summary: ExecutionSummary,
  options: RunReportOptions,
  graph: ManifestGraph | undefined,
): {
  bottlenecks:
    | {
        nodes: Array<{
          unique_id: string;
          name?: string;
          execution_time: number;
          rank: number;
          pct_of_total: number;
          status: string;
        }>;
        total_execution_time: number;
        criteria_used: "top_n" | "threshold";
      }
    | undefined;
  bottlenecksTopLabel: string | undefined;
} {
  if (!options.bottlenecks || !summary.node_executions?.length) {
    return { bottlenecks: undefined, bottlenecksTopLabel: undefined };
  }

  const topN = options.bottlenecksTop ?? 10;
  const threshold = options.bottlenecksThreshold;

  if (
    options.bottlenecksTop !== undefined &&
    options.bottlenecksThreshold !== undefined
  ) {
    throw new Error(
      "Cannot use both --bottlenecks-top and --bottlenecks-threshold; choose one",
    );
  }

  if (threshold !== undefined && threshold > 0) {
    const bottlenecks = detectBottlenecks(summary.node_executions, {
      mode: "threshold",
      min_seconds: threshold,
      graph,
    });
    return { bottlenecks, bottlenecksTopLabel: `>= ${threshold}s` };
  }

  const bottlenecks = detectBottlenecks(summary.node_executions, {
    mode: "top_n",
    top: topN > 0 ? topN : 10,
    graph,
  });
  return { bottlenecks, bottlenecksTopLabel: `top ${topN}` };
}

/**
 * Run report action handler
 */
export function runReportAction(
  runResultsPath: string | undefined,
  manifestPath: string | undefined,
  options: RunReportOptions,
  handleError: (error: unknown, isTTY: boolean) => void,
  isTTY: () => boolean,
): void {
  try {
    const paths = resolveArtifactPaths(
      manifestPath,
      runResultsPath,
      options.targetDir,
    );

    validateSafePath(paths.manifest);
    validateSafePath(paths.runResults);

    const runResults = loadRunResults(paths.runResults);

    let analyzer: ExecutionAnalyzer | undefined;
    let graph: ManifestGraph | undefined;
    if (paths.manifest) {
      const manifest = loadManifest(paths.manifest);
      graph = new ManifestGraph(manifest);
      analyzer = new ExecutionAnalyzer(runResults, graph);
    }

    let summary: ExecutionSummary = analyzer
      ? analyzer.getSummary()
      : createMinimalSummary(runResults);

    const { bottlenecks, bottlenecksTopLabel } = computeBottlenecksSection(
      summary,
      options,
      graph,
    );

    if (options.fields) {
      summary = FieldFilter.filterFields(
        summary,
        options.fields,
      ) as ExecutionSummary;
    }

    const useJson = shouldOutputJSON(options.json, options.noJson);

    if (useJson) {
      const report: Record<string, unknown> = { ...summary };
      if (bottlenecks) {
        report.bottlenecks = bottlenecks;
      }
      console.log(formatOutput(report, true));
    } else {
      console.log(formatRunReport(summary, bottlenecks, bottlenecksTopLabel));
    }
  } catch (error) {
    handleError(error, isTTY());
  }
}
