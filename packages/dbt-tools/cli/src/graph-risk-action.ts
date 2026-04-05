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
  GRAPH_RISK_RANKING_METRICS,
  isGraphRiskRankingMetric,
  isGraphRiskResourceType,
  type DbtResourceType,
  type GraphRiskRankingMetric,
} from "@dbt-tools/core";

type GraphRiskActionOptions = {
  targetDir?: string;
  runResults?: string;
  top?: number;
  /** Raw `--metric` string; validated inside this action. */
  metric?: string;
  /** Raw `--resource-types` CSV, or an array (tests / programmatic use). */
  resourceTypes?: string | DbtResourceType[];
  fields?: string;
  json?: boolean;
  noJson?: boolean;
};

function parseResourceTypesArg(
  input: string | DbtResourceType[],
): { ok: true; value: DbtResourceType[] } | { ok: false; invalid: string[] } {
  const list = (
    Array.isArray(input)
      ? input.map((v) => String(v).trim())
      : input.split(",").map((s) => s.trim())
  ).filter((s) => s.length > 0);

  const invalid = list.filter((t) => !isGraphRiskResourceType(t));
  if (invalid.length > 0) {
    return { ok: false, invalid };
  }
  return { ok: true, value: list as DbtResourceType[] };
}

export function graphRiskAction(
  manifestPath: string | undefined,
  options: GraphRiskActionOptions,
  handleError: (error: unknown, isTTY: boolean) => void,
  isTTY: () => boolean,
): void {
  try {
    let metric: GraphRiskRankingMetric | undefined;
    if (options.metric !== undefined && options.metric !== "") {
      if (!isGraphRiskRankingMetric(options.metric)) {
        handleError(
          new Error(
            `--metric must be one of: ${GRAPH_RISK_RANKING_METRICS.join(", ")}`,
          ),
          isTTY(),
        );
        return;
      }
      metric = options.metric;
    }

    let resourceTypes: DbtResourceType[] | undefined;
    if (options.resourceTypes !== undefined) {
      const parsed = parseResourceTypesArg(options.resourceTypes);
      if (!parsed.ok) {
        handleError(
          new Error(
            `--resource-types contains unsupported values: ${parsed.invalid.join(", ")}`,
          ),
          isTTY(),
        );
        return;
      }
      resourceTypes = parsed.value;
    }

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

    const resolvedMetric = metric ?? "overallRiskScore";
    const top = options.top ?? 10;
    const analyzer = new GraphRiskAnalyzer({
      manifest,
      ...(runResults ? { runResults } : {}),
      options: {
        resourceTypes,
        includeExecution: runResults !== undefined,
        topN: top,
      },
    });

    const summary = analyzer.analyze();
    const topByMetric = analyzer.getTopNodes({
      metric: resolvedMetric,
      limit: top,
    });
    const report = {
      ...summary,
      selected_metric: resolvedMetric,
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
        selectedMetric: resolvedMetric,
        topByMetric,
      }),
    );
  } catch (error) {
    handleError(error, isTTY());
  }
}
