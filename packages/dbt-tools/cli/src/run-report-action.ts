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
  buildAdapterTotals,
  buildNodeExecutionsFromRunResults,
  detectAdapterHeavyNodes,
  searchRunResults,
  formatOutput,
  formatRunReport,
  formatAdapterTotalsHuman,
  formatAdapterHeavyHuman,
  formatAdapterNodeDetailsHuman,
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
  adapterMinRowsAffected?: number;
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

function filterExecutionsForAdapterTop(
  executions: NodeExecution[],
  options: RunReportOptions,
): NodeExecution[] {
  let filtered = executions;
  const filters = [
    { key: "min_bytes_processed" as const, value: options.adapterMinBytes },
    { key: "min_slot_ms" as const, value: options.adapterMinSlotMs },
    {
      key: "min_rows_affected" as const,
      value: options.adapterMinRowsAffected,
    },
  ];
  for (const filter of filters) {
    if (filter.value === undefined) continue;
    filtered = searchRunResults(filtered, {
      [filter.key]: filter.value,
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
  const summaryMetrics: Array<{
    metric: AdapterHeavyMetric;
    label: string;
  }> = [
    { metric: "slot_ms", label: "Top 5 by slot_ms (summary)" },
    {
      metric: "bytes_processed",
      label: "Top 5 by bytes_processed (summary)",
    },
    { metric: "rows_affected", label: "Top 5 by rows_affected (summary)" },
  ];

  if (options.adapterSummary && adapterTotals != null) {
    jsonParts.adapter_totals = adapterTotals;
    humanParts.push(formatAdapterTotalsHuman(adapterTotals));
    humanParts.push(formatAdapterNodeDetailsHuman(adapterSource));

    if (!options.adapterTopBy && adapterTotals.nodesWithAdapterData > 0) {
      for (const summaryMetric of summaryMetrics) {
        const heavy = detectAdapterHeavyNodes(adapterSource, {
          metric: summaryMetric.metric,
          top: 5,
          graph,
        });
        if (heavy.total_metric > 0) {
          humanParts.push(formatAdapterHeavyHuman(heavy, summaryMetric.label));
        }
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
    let adapterType: string | null | undefined;
    if (manifestPath) {
      const manifest = loadManifest(paths.manifest);
      graph = new ManifestGraph(manifest);
      adapterType = manifest.metadata?.adapter_type ?? null;
      analyzer = new ExecutionAnalyzer(runResults, graph, adapterType);
    }

    const summary: ExecutionSummary = analyzer
      ? analyzer.getSummary()
      : {
          ...createMinimalSummary(runResults),
          node_executions: buildNodeExecutionsFromRunResults(
            runResults,
            adapterType,
          ),
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
