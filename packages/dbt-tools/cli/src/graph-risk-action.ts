import {
  FieldFilter,
  GraphRiskAnalyzer,
  formatGraphRiskReport,
  formatOutput,
  loadManifest,
  loadRunResults,
  resolveArtifactPaths,
  shouldOutputJSON,
  validateSafePath,
  type DbtResourceType,
  type GraphRiskRankingMetric,
} from "@dbt-tools/core";

type GraphRiskActionOptions = {
  targetDir?: string;
  runResults?: string;
  top?: number;
  metric?: GraphRiskRankingMetric;
  resourceTypes?: DbtResourceType[];
  fields?: string;
  json?: boolean;
  noJson?: boolean;
};

export function graphRiskAction(
  manifestPath: string | undefined,
  options: GraphRiskActionOptions,
  handleError: (error: unknown, isTTY: boolean) => void,
  isTTY: () => boolean,
): void {
  try {
    const manifestArtifactPaths = resolveArtifactPaths(
      manifestPath,
      undefined,
      options.targetDir,
    );
    validateSafePath(manifestArtifactPaths.manifest);
    const manifest = loadManifest(manifestArtifactPaths.manifest);

    let runResults = undefined;
    if (options.runResults) {
      const runResultsArtifactPaths = resolveArtifactPaths(
        undefined,
        options.runResults,
        options.targetDir,
      );
      validateSafePath(runResultsArtifactPaths.runResults);
      runResults = loadRunResults(runResultsArtifactPaths.runResults);
    }

    const metric = options.metric ?? "overallRiskScore";
    const top = options.top ?? 10;
    const analyzer = new GraphRiskAnalyzer({
      manifest,
      ...(runResults ? { runResults } : {}),
      options: {
        resourceTypes: options.resourceTypes,
        includeExecution: runResults !== undefined,
        topN: top,
      },
    });

    const summary = analyzer.analyze();
    const topByMetric = analyzer.getTopNodes({ metric, limit: top });
    const report = {
      ...summary,
      selected_metric: metric,
      top_by_metric: topByMetric,
    };

    const useJson = shouldOutputJSON(options.json, options.noJson);
    if (useJson) {
      const filtered = options.fields
        ? FieldFilter.filterFields(report, options.fields)
        : report;
      console.log(formatOutput(filtered, true));
      return;
    }

    console.log(
      formatGraphRiskReport({
        summary,
        selectedMetric: metric,
        topByMetric,
      }),
    );
  } catch (error) {
    handleError(error, isTTY());
  }
}
