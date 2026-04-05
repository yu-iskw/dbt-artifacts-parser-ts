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
  GraphBottleneckAnalyzer,
  buildAdapterTotals,
  buildNodeExecutionsFromRunResults,
  detectAdapterHeavyNodes,
  searchRunResults,
  formatOutput,
  formatRunReport,
  formatAdapterTotalsHuman,
  formatAdapterHeavyHuman,
  shouldOutputJSON,
  type ExecutionSummary,
  type NodeExecution,
  type AdapterHeavyMetric,
} from "@dbt-tools/core";

type RunReportOptions = {
  targetDir?: string;
  fields?: string;
  bottlenecks?: boolean;
  bottlenecksTop?: number;
  bottlenecksThreshold?: number;
  json?: boolean;
  noJson?: boolean;
  adapterSummary?: boolean;
  adapterTopBy?: AdapterHeavyMetric;
  adapterTopN?: number;
  adapterMinBytes?: number;
  adapterMinSlotMs?: number;
};

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

  const executionStatusById = new Map(
    summary.node_executions.map((execution) => [execution.unique_id, execution]),
  );

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
    if (graph) {
      const report = new GraphBottleneckAnalyzer(
        graph,
        summary.node_executions,
      ).analyze();
      const nodes = report.ranked_nodes
        .filter((node) => (node.execution_time ?? 0) >= threshold)
        .map((node, index) => {
          const time = node.execution_time ?? 0;
          const pct =
            summary.total_execution_time > 0
              ? (time / summary.total_execution_time) * 100
              : 0;
          return {
            unique_id: node.unique_id,
            name: node.name,
            execution_time: time,
            rank: index + 1,
            pct_of_total: Math.round(pct * 10) / 10,
            status:
              executionStatusById.get(node.unique_id)?.status ?? "unknown",
            bottleneck_score: node.bottleneck_score,
            reasons: node.reasons,
          };
        });
      return {
        bottlenecks: {
          nodes,
          total_execution_time: summary.total_execution_time,
          criteria_used: "threshold",
        },
        bottlenecksTopLabel: `>= ${threshold}s`,
      };
    }
    const bottlenecks = detectBottlenecks(summary.node_executions, {
      mode: "threshold",
      min_seconds: threshold,
      graph,
    });
    return { bottlenecks, bottlenecksTopLabel: `>= ${threshold}s` };
  }

  if (graph) {
    const report = new GraphBottleneckAnalyzer(graph, summary.node_executions)
      .analyze({
        topN: topN > 0 ? topN : 10,
      })
      .ranked_nodes;
    const nodes = report.map((node, index) => {
      const time = node.execution_time ?? 0;
      const pct =
        summary.total_execution_time > 0
          ? (time / summary.total_execution_time) * 100
          : 0;
      return {
        unique_id: node.unique_id,
        name: node.name,
        execution_time: time,
        rank: index + 1,
        pct_of_total: Math.round(pct * 10) / 10,
        status: executionStatusById.get(node.unique_id)?.status ?? "unknown",
        bottleneck_score: node.bottleneck_score,
        reasons: node.reasons,
      };
    });

    return {
      bottlenecks: {
        nodes,
        total_execution_time: summary.total_execution_time,
        criteria_used: "top_n",
      },
      bottlenecksTopLabel: `top ${topN} by graph bottleneck score`,
    };
  }

  const bottlenecks = detectBottlenecks(summary.node_executions, {
    mode: "top_n",
    top: topN > 0 ? topN : 10,
    graph,
  });
  return { bottlenecks, bottlenecksTopLabel: `top ${topN}` };
}

function filterExecutionsForAdapterTop(
  executions: NodeExecution[],
  options: RunReportOptions,
): NodeExecution[] {
  let filtered = executions;
  if (options.adapterMinBytes !== undefined) {
    filtered = searchRunResults(filtered, {
      min_bytes_processed: options.adapterMinBytes,
    });
  }
  if (options.adapterMinSlotMs !== undefined) {
    filtered = searchRunResults(filtered, {
      min_slot_ms: options.adapterMinSlotMs,
    });
  }
  return filtered;
}

function buildAdapterSections(
  adapterSource: NodeExecution[],
  options: RunReportOptions,
  graph: ManifestGraph | undefined,
): {
  jsonParts: Record<string, unknown>;
  humanAppend: string;
} {
  const jsonParts: Record<string, unknown> = {};
  const humanParts: string[] = [];

  const adapterTotals = buildAdapterTotals(
    adapterSource.map((e) => e.adapterMetrics),
  );

  if (options.adapterSummary && adapterTotals != null) {
    jsonParts.adapter_totals = adapterTotals;
    humanParts.push(formatAdapterTotalsHuman(adapterTotals));

    if (!options.adapterTopBy && adapterTotals.nodesWithAdapterData > 0) {
      const bySlot = detectAdapterHeavyNodes(adapterSource, {
        metric: "slot_ms",
        top: 5,
        graph,
      });
      const byBytes = detectAdapterHeavyNodes(adapterSource, {
        metric: "bytes_processed",
        top: 5,
        graph,
      });
      if (bySlot.total_metric > 0) {
        humanParts.push(
          formatAdapterHeavyHuman(bySlot, "Top 5 by slot_ms (summary)"),
        );
      }
      if (byBytes.total_metric > 0) {
        humanParts.push(
          formatAdapterHeavyHuman(
            byBytes,
            "Top 5 by bytes_processed (summary)",
          ),
        );
      }
    }
  }

  if (options.adapterTopBy) {
    const filtered = filterExecutionsForAdapterTop(adapterSource, options);
    const topN = options.adapterTopN ?? 10;
    const adapterTop = detectAdapterHeavyNodes(filtered, {
      metric: options.adapterTopBy,
      top: topN > 0 ? topN : 10,
      graph,
    });
    jsonParts.adapter_top = adapterTop;
    humanParts.push(formatAdapterHeavyHuman(adapterTop));
  }

  return {
    jsonParts,
    humanAppend: humanParts.join(""),
  };
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

    validateSafePath(paths.runResults);
    if (manifestPath) {
      validateSafePath(paths.manifest);
    }

    const runResults = loadRunResults(paths.runResults);

    let analyzer: ExecutionAnalyzer | undefined;
    let graph: ManifestGraph | undefined;
    if (manifestPath) {
      const manifest = loadManifest(paths.manifest);
      graph = new ManifestGraph(manifest);
      analyzer = new ExecutionAnalyzer(runResults, graph);
    }

    const summary: ExecutionSummary = analyzer
      ? analyzer.getSummary()
      : {
          ...createMinimalSummary(runResults),
          node_executions: buildNodeExecutionsFromRunResults(runResults),
        };

    const adapterSource = summary.node_executions as NodeExecution[];

    const { bottlenecks, bottlenecksTopLabel } = computeBottlenecksSection(
      summary,
      options,
      graph,
    );

    const wantsAdapter =
      options.adapterSummary === true || options.adapterTopBy != null;
    const { jsonParts: adapterJson, humanAppend: adapterHumanAppend } =
      wantsAdapter
        ? buildAdapterSections(adapterSource, options, graph)
        : { jsonParts: {}, humanAppend: "" };

    let filteredSummary: ExecutionSummary = summary;
    if (options.fields) {
      filteredSummary = FieldFilter.filterFields(
        summary,
        options.fields,
      ) as ExecutionSummary;
    }

    const useJson = shouldOutputJSON(options.json, options.noJson);

    if (useJson) {
      const report: Record<string, unknown> = { ...filteredSummary };
      if (bottlenecks) {
        report.bottlenecks = bottlenecks;
      }
      Object.assign(report, adapterJson);
      console.log(formatOutput(report, true));
    } else {
      console.log(
        formatRunReport(
          filteredSummary,
          bottlenecks,
          bottlenecksTopLabel,
          adapterHumanAppend || undefined,
        ),
      );
    }
  } catch (error) {
    handleError(error, isTTY());
  }
}
