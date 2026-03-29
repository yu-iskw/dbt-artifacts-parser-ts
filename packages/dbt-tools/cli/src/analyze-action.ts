import {
  ManifestGraph,
  ExecutionAnalyzer,
  resolveArtifactPaths,
  loadManifest,
  loadRunResults,
  validateSafePath,
  detectBottlenecks,
  formatOutput,
  shouldOutputJSON,
  buildOptimizationReport,
} from "@dbt-tools/core";

type AnalyzeBaseOptions = {
  targetDir?: string;
  json?: boolean;
  noJson?: boolean;
};

type AnalyzeBottlenecksOptions = AnalyzeBaseOptions & {
  top?: number;
  threshold?: number;
};

type AnalyzeOptimizeOptions = AnalyzeBaseOptions & {
  top?: number;
};

function formatBottleneckText(result: ReturnType<typeof detectBottlenecks>): string {
  if (result.nodes.length === 0) {
    return "No bottlenecks found.";
  }

  const lines = ["Bottlenecks", "==========="];
  for (const node of result.nodes) {
    lines.push(
      `#${node.rank} ${node.unique_id} (${node.execution_time.toFixed(2)}s, ${node.pct_of_total.toFixed(1)}% of total)`,
    );
  }
  return lines.join("\n");
}

function formatCriticalPathText(path: string[] | undefined, totalTime: number): string {
  if (!path || path.length === 0) {
    return "No critical path could be determined.";
  }

  return [
    "Critical Path",
    "============",
    `Total Time: ${totalTime.toFixed(2)}s`,
    `Path: ${path.join(" -> ")}`,
  ].join("\n");
}

function formatOptimizeText(report: ReturnType<typeof buildOptimizationReport>): string {
  if (report.candidates.length === 0) {
    return "No optimization candidates found.";
  }

  const lines = [
    "Optimization Candidates",
    "=======================",
    `Top N: ${report.top_n}`,
    `Total Execution Time: ${report.total_execution_time_seconds.toFixed(2)}s`,
  ];

  for (const candidate of report.candidates) {
    lines.push("");
    lines.push(
      `- ${candidate.unique_id} | impact=${candidate.impact_score.toFixed(2)} | time=${candidate.execution_time_seconds.toFixed(2)}s | downstream=${candidate.downstream_reach} | confidence=${candidate.confidence.toFixed(1)}`,
    );
    lines.push(`  suggestions: ${candidate.recommendations.join("; ")}`);
  }

  return lines.join("\n");
}

function resolveAndLoad(
  runResultsPath: string | undefined,
  manifestPath: string | undefined,
  options: AnalyzeBaseOptions,
): {
  analyzer: ExecutionAnalyzer;
  graph: ManifestGraph;
  adapterType?: string;
} {
  const paths = resolveArtifactPaths(manifestPath, runResultsPath, options.targetDir);
  validateSafePath(paths.runResults);
  validateSafePath(paths.manifest);

  const runResults = loadRunResults(paths.runResults);
  const manifest = loadManifest(paths.manifest);
  const graph = new ManifestGraph(manifest);
  const analyzer = new ExecutionAnalyzer(runResults, graph);

  return {
    analyzer,
    graph,
    adapterType: (manifest.metadata as { adapter_type?: string } | undefined)?.adapter_type,
  };
}

export function analyzeBottlenecksAction(
  runResultsPath: string | undefined,
  manifestPath: string | undefined,
  options: AnalyzeBottlenecksOptions,
  handleError: (error: unknown, isTTY: boolean) => void,
  isTTY: () => boolean,
): void {
  try {
    const { analyzer, graph } = resolveAndLoad(runResultsPath, manifestPath, options);
    const summary = analyzer.getSummary();

    if (options.top !== undefined && options.threshold !== undefined) {
      throw new Error("Cannot use both --top and --threshold; choose one");
    }

    const bottlenecks =
      options.threshold !== undefined
        ? detectBottlenecks(summary.node_executions, {
            mode: "threshold",
            min_seconds: options.threshold,
            graph,
          })
        : detectBottlenecks(summary.node_executions, {
            mode: "top_n",
            top: Math.max(1, options.top ?? 10),
            graph,
          });

    const useJson = shouldOutputJSON(options.json, options.noJson);
    console.log(useJson ? formatOutput(bottlenecks, true) : formatBottleneckText(bottlenecks));
  } catch (error) {
    handleError(error, isTTY());
  }
}

export function analyzeCriticalPathAction(
  runResultsPath: string | undefined,
  manifestPath: string | undefined,
  options: AnalyzeBaseOptions,
  handleError: (error: unknown, isTTY: boolean) => void,
  isTTY: () => boolean,
): void {
  try {
    const { analyzer } = resolveAndLoad(runResultsPath, manifestPath, options);
    const summary = analyzer.getSummary();
    const criticalPath = summary.critical_path;

    const result = {
      critical_path: criticalPath?.path ?? [],
      total_time: criticalPath?.total_time ?? 0,
      total_execution_time: summary.total_execution_time,
    };

    const useJson = shouldOutputJSON(options.json, options.noJson);
    console.log(
      useJson
        ? formatOutput(result, true)
        : formatCriticalPathText(result.critical_path, result.total_time),
    );
  } catch (error) {
    handleError(error, isTTY());
  }
}

export function analyzeOptimizeAction(
  runResultsPath: string | undefined,
  manifestPath: string | undefined,
  options: AnalyzeOptimizeOptions,
  handleError: (error: unknown, isTTY: boolean) => void,
  isTTY: () => boolean,
): void {
  try {
    const { analyzer, graph, adapterType } = resolveAndLoad(runResultsPath, manifestPath, options);
    const summary = analyzer.getSummary();

    const report = buildOptimizationReport(summary.node_executions, graph, {
      topN: Math.max(1, options.top ?? 10),
      criticalPath: summary.critical_path?.path,
      adapterType,
    });

    const useJson = shouldOutputJSON(options.json, options.noJson);
    console.log(useJson ? formatOutput(report, true) : formatOptimizeText(report));
  } catch (error) {
    handleError(error, isTTY());
  }
}
