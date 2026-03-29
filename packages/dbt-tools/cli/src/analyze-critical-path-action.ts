import {
  ManifestGraph,
  resolveArtifactPaths,
  loadManifest,
  loadRunResults,
  validateSafePath,
  FieldFilter,
  formatOutput,
  shouldOutputJSON,
  analyzeCriticalPath,
  formatCriticalPathAnalysis,
} from "@dbt-tools/core";

type AnalyzeCriticalPathOptions = {
  targetDir?: string;
  fields?: string;
  json?: boolean;
  noJson?: boolean;
};

/**
 * CLI action: analyze critical-path
 *
 * Identifies the longest execution path through the dependency graph,
 * annotating each node with cumulative time and concurrent parallelism.
 */
export function analyzeCriticalPathAction(
  runResultsPath: string | undefined,
  manifestPath: string | undefined,
  options: AnalyzeCriticalPathOptions,
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
    validateSafePath(paths.manifest);

    const runResults = loadRunResults(paths.runResults);
    const manifest = loadManifest(paths.manifest);
    const graph = new ManifestGraph(manifest);

    let result = analyzeCriticalPath(runResults, graph);

    if (!result) {
      const msg = "No critical path found. Ensure run_results.json has execution data that matches the manifest.";
      const useJson = shouldOutputJSON(options.json, options.noJson);
      if (useJson) {
        console.log(formatOutput({ error: msg }, true));
      } else {
        console.log(msg);
      }
      return;
    }

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
      console.log(formatCriticalPathAnalysis(result));
    }
  } catch (error) {
    handleError(error, isTTY());
  }
}
