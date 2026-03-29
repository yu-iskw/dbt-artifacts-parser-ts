import {
  ManifestGraph,
  resolveArtifactPaths,
  loadManifest,
  loadRunResults,
  validateSafePath,
  FieldFilter,
  formatOutput,
  shouldOutputJSON,
  analyzeBottlenecks,
  formatBottleneckAnalysis,
} from "@dbt-tools/core";

type AnalyzeBottlenecksOptions = {
  targetDir?: string;
  top?: number;
  threshold?: number;
  fields?: string;
  json?: boolean;
  noJson?: boolean;
};

/**
 * CLI action: analyze bottlenecks
 *
 * Ranks nodes by structural impact score (execution_time × downstream reach)
 * rather than raw execution time, so high-fan-out bottlenecks surface first.
 */
export function analyzeBottlenecksAction(
  runResultsPath: string | undefined,
  manifestPath: string | undefined,
  options: AnalyzeBottlenecksOptions,
  handleError: (error: unknown, isTTY: boolean) => void,
  isTTY: () => boolean,
): void {
  try {
    if (options.top !== undefined && options.threshold !== undefined) {
      throw new Error("Cannot use both --top and --threshold; choose one");
    }

    const paths = resolveArtifactPaths(
      manifestPath,
      runResultsPath,
      options.targetDir,
    );
    validateSafePath(paths.runResults);
    validateSafePath(paths.manifest);

    const runResults = loadRunResults(paths.runResults);
    const manifest = loadManifest(paths.manifest);
    const graph = new ManifestGraph(manifest);

    const threshold = options.threshold;
    const topN = options.top ?? 10;

    const mode =
      threshold !== undefined && threshold > 0
        ? ({ mode: "threshold", min_seconds: threshold } as const)
        : ({ mode: "top_n", top: topN > 0 ? topN : 10 } as const);

    let result = analyzeBottlenecks(runResults, graph, mode);

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
      console.log(formatBottleneckAnalysis(result));
    }
  } catch (error) {
    handleError(error, isTTY());
  }
}
