import type { NodeExecution } from "@dbt-tools/core";
import {
  ManifestGraph,
  resolveArtifactPaths,
  loadManifest,
  loadRunResults,
  validateSafePath,
  FieldFilter,
  formatOutput,
  shouldOutputJSON,
  analyzeParallelism,
  formatParallelismAnalysis,
  ExecutionAnalyzer,
} from "@dbt-tools/core";

type AnalyzeParallelismOptions = {
  targetDir?: string;
  runResultsPath?: string;
  fields?: string;
  json?: boolean;
  noJson?: boolean;
};

/**
 * CLI action: analyze parallelism
 *
 * Decomposes the dependency graph into topological waves and identifies
 * serialization bottlenecks and recommended thread counts.
 * Works from manifest alone; run_results is optional (adds timing estimates).
 */
export function analyzeParallelismAction(
  manifestPath: string | undefined,
  options: AnalyzeParallelismOptions,
  handleError: (error: unknown, isTTY: boolean) => void,
  isTTY: () => boolean,
): void {
  try {
    const paths = resolveArtifactPaths(
      manifestPath,
      options.runResultsPath,
      options.targetDir,
    );
    validateSafePath(paths.manifest);

    const manifest = loadManifest(paths.manifest);
    const graph = new ManifestGraph(manifest);

    // Optionally load run_results for timing estimates.
    // When --run-results-path is explicitly provided, errors are propagated
    // to the outer handler so the user is informed of the invalid path/file.
    let nodeExecutions: NodeExecution[] | undefined;
    if (options.runResultsPath) {
      validateSafePath(paths.runResults);
      const runResults = loadRunResults(paths.runResults);
      const analyzer = new ExecutionAnalyzer(runResults, graph);
      nodeExecutions = analyzer.getNodeExecutions();
    }

    let result = analyzeParallelism(graph, nodeExecutions);

    if (options.fields) {
      result = FieldFilter.filterFields(
        result,
        options.fields,
      ) as typeof result;
    }

    const useJson = shouldOutputJSON(options.json, options.noJson);
    if (useJson) {
      console.log(formatOutput(result, true));
    } else {
      console.log(formatParallelismAnalysis(result));
    }
  } catch (error) {
    handleError(error, isTTY());
  }
}
