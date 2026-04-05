import type { DbtResourceType } from "../types";

/** Metric keys used for graph-risk ranking (CLI, schema, analyzer). */
export const GRAPH_RISK_RANKING_METRICS = [
  "overallRiskScore",
  "bottleneckScore",
  "blastRadiusScore",
  "fragilityScore",
  "reconvergenceScore",
  "pathConcentrationScore",
] as const;

export type GraphRiskRankingMetric =
  (typeof GRAPH_RISK_RANKING_METRICS)[number];

const GRAPH_RISK_RANKING_METRIC_SET = new Set<string>(
  GRAPH_RISK_RANKING_METRICS,
);

export function isGraphRiskRankingMetric(
  value: string,
): value is GraphRiskRankingMetric {
  return GRAPH_RISK_RANKING_METRIC_SET.has(value);
}

/** Resource types accepted by graph-risk analysis and CLI `--resource-types`. */
export const GRAPH_RISK_RESOURCE_TYPES = [
  "model",
  "source",
  "seed",
  "snapshot",
  "test",
  "analysis",
  "macro",
  "exposure",
  "metric",
  "semantic_model",
  "unit_test",
  "field",
  "function",
] as const satisfies readonly DbtResourceType[];

export const GRAPH_RISK_RESOURCE_TYPE_SET = new Set<DbtResourceType>(
  GRAPH_RISK_RESOURCE_TYPES,
);

export function isGraphRiskResourceType(
  value: string,
): value is DbtResourceType {
  return GRAPH_RISK_RESOURCE_TYPE_SET.has(value as DbtResourceType);
}

/** Human-readable labels for console / formatter output. */
export const GRAPH_RISK_METRIC_LABELS: Record<GraphRiskRankingMetric, string> =
  {
    overallRiskScore: "overall risk",
    bottleneckScore: "bottleneck",
    blastRadiusScore: "blast radius",
    fragilityScore: "fragility",
    reconvergenceScore: "reconvergence",
    pathConcentrationScore: "path concentration",
  };
