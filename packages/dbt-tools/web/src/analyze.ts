import type { AnalysisState } from "./types";

/**
 * Parses manifest and run_results JSON, runs analysis, and returns AnalysisState.
 * Shared by both file upload and API preload paths.
 */
export async function analyzeArtifacts(
  manifestJson: Record<string, unknown>,
  runResultsJson: Record<string, unknown>,
): Promise<AnalysisState> {
  const [manifestParser, runResultsParser, coreMod] = await Promise.all([
    import("dbt-artifacts-parser/manifest"),
    import("dbt-artifacts-parser/run_results"),
    import("@dbt-tools/core/browser"),
  ]);
  const manifest = manifestParser.parseManifest(manifestJson);
  const runResults = runResultsParser.parseRunResults(runResultsJson);

  const { ManifestGraph, ExecutionAnalyzer, detectBottlenecks } = coreMod;
  const graph = new ManifestGraph(manifest);
  const analyzer = new ExecutionAnalyzer(runResults, graph);

  const summary = analyzer.getSummary();
  const ganttData = analyzer.getGanttData();
  const bottlenecks = detectBottlenecks(summary.node_executions, {
    mode: "top_n",
    top: 5,
    graph,
  });

  return {
    summary,
    ganttData,
    bottlenecks,
  };
}
