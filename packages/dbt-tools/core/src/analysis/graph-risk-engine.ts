import type { ParsedManifest } from "dbt-artifacts-parser/manifest";
import type { ParsedRunResults } from "dbt-artifacts-parser/run_results";
import { ManifestGraph } from "./manifest-graph";
import type { DbtResourceType } from "../types";
import { GRAPH_RISK_RESOURCE_TYPE_SET } from "./graph-risk-config";
import type { GraphRiskRankingMetric } from "./graph-risk-config";
import type {
  GraphRiskAnalyzerArgs,
  GraphRiskAnalyzerOptions,
  GraphRiskSummary,
  GraphRiskThresholds,
  NodeRiskAssessment,
  NodeStructuralMetrics,
} from "./graph-risk-model";
import type {
  ResolvedOptions,
  StructuralRawMetrics,
} from "./graph-risk-analysis-types";
import { buildAnalysisNodes } from "./graph-risk-graph-build";
import { computeStructuralRawMetrics } from "./graph-risk-structural-metrics";
import { computeExecutionAnalysis } from "./graph-risk-execution";
import { buildFindingsForNode } from "./graph-risk-findings";
import { clampScore, normalizeArray } from "./graph-risk-math";

const DEFAULT_THRESHOLDS: GraphRiskThresholds = {
  highScore: 70,
  moderateScore: 45,
  highFanIn: 4,
  criticalSlackMs: 1,
};

const DEFAULT_OPTIONS: ResolvedOptions = {
  resourceTypes: ["model"],
  includeExecution: true,
  topN: 10,
  maxExactStructuralNodes: 5000,
  thresholds: DEFAULT_THRESHOLDS,
};

function resolveOptions(options?: GraphRiskAnalyzerOptions): ResolvedOptions {
  const resourceTypes = (
    options?.resourceTypes ?? DEFAULT_OPTIONS.resourceTypes
  ).filter((type): type is DbtResourceType =>
    GRAPH_RISK_RESOURCE_TYPE_SET.has(type),
  );
  const topN = Math.max(1, Math.trunc(options?.topN ?? DEFAULT_OPTIONS.topN));
  const maxExactStructuralNodes = Math.max(
    1,
    Math.trunc(
      options?.maxExactStructuralNodes ??
        DEFAULT_OPTIONS.maxExactStructuralNodes,
    ),
  );

  return {
    resourceTypes: resourceTypes.length > 0 ? resourceTypes : ["model"],
    includeExecution:
      options?.includeExecution ?? DEFAULT_OPTIONS.includeExecution,
    topN,
    maxExactStructuralNodes,
    thresholds: {
      ...DEFAULT_THRESHOLDS,
      ...(options?.thresholds ?? {}),
    },
  };
}

function buildStructuralMetrics(rawMetrics: StructuralRawMetrics): {
  structural: NodeStructuralMetrics[];
  pathConcentrationScores: number[];
  blastRadiusScores: number[];
} {
  const blastRadiusScores = normalizeArray(
    rawMetrics.transitiveDownstreamCount,
  );
  const inDegreeScores = normalizeArray(rawMetrics.inDegree);
  const upstreamDepthScores = normalizeArray(rawMetrics.longestUpstreamDepth);
  const reconvergenceScores = normalizeArray(rawMetrics.reconvergenceRaw);
  const pathConcentrationScores = normalizeArray(
    rawMetrics.pathConcentrationRaw,
  );

  const structural = rawMetrics.inDegree.map((_, index) => ({
    inDegree: rawMetrics.inDegree[index]!,
    outDegree: rawMetrics.outDegree[index]!,
    transitiveUpstreamCount: rawMetrics.transitiveUpstreamCount[index]!,
    transitiveDownstreamCount: rawMetrics.transitiveDownstreamCount[index]!,
    longestUpstreamDepth: rawMetrics.longestUpstreamDepth[index]!,
    longestDownstreamDepth: rawMetrics.longestDownstreamDepth[index]!,
    blastRadiusScore: blastRadiusScores[index]!,
    fragilityScore: clampScore(
      inDegreeScores[index]! * 0.25 +
        upstreamDepthScores[index]! * 0.2 +
        reconvergenceScores[index]! * 0.25 +
        pathConcentrationScores[index]! * 0.3,
    ),
    reconvergenceScore: reconvergenceScores[index]!,
    pathConcentrationScore: pathConcentrationScores[index]!,
  }));

  return {
    structural,
    pathConcentrationScores,
    blastRadiusScores,
  };
}

export function getGraphRiskMetricNumeric(
  assessment: NodeRiskAssessment,
  metric: GraphRiskRankingMetric,
): number {
  switch (metric) {
    case "overallRiskScore":
      return assessment.composite.overallRiskScore;
    case "bottleneckScore":
      return assessment.composite.bottleneckScore;
    case "blastRadiusScore":
      return assessment.structural.blastRadiusScore;
    case "fragilityScore":
      return assessment.structural.fragilityScore;
    case "reconvergenceScore":
      return assessment.structural.reconvergenceScore;
    case "pathConcentrationScore":
      return assessment.structural.pathConcentrationScore ?? 0;
  }
}

export class GraphRiskAnalyzer {
  private readonly manifest: ParsedManifest;
  private readonly runResults?: ParsedRunResults;
  private readonly options: ResolvedOptions;
  private readonly graph: ManifestGraph;
  private summary: GraphRiskSummary | undefined;
  private nodeAssessments = new Map<string, NodeRiskAssessment>();

  constructor(args: GraphRiskAnalyzerArgs) {
    this.manifest = args.manifest;
    this.runResults = args.runResults;
    this.options = resolveOptions(args.options);
    this.graph = new ManifestGraph(this.manifest);
  }

  analyze(): GraphRiskSummary {
    if (this.summary) {
      return this.summary;
    }

    const { nodes, topoOrder } = buildAnalysisNodes(
      this.graph,
      this.options.resourceTypes,
    );

    if (nodes.length === 0) {
      this.summary = {
        totalNodes: this.graph.getGraph().order,
        analyzedNodes: 0,
        resourceTypes: [...this.options.resourceTypes],
        topBottlenecks: [],
        topFragileNodes: [],
        topBlastRadiusNodes: [],
      };
      return this.summary;
    }

    const structuralRaw = computeStructuralRawMetrics(
      nodes,
      topoOrder,
      this.options.maxExactStructuralNodes,
    );
    const structuralBundle = buildStructuralMetrics(structuralRaw);
    const executionAnalysis = computeExecutionAnalysis(
      nodes,
      topoOrder,
      this.options,
      this.runResults,
      structuralBundle.blastRadiusScores,
      structuralBundle.pathConcentrationScores,
    );

    const hasExecutionData = executionAnalysis.durations.some(
      (duration) => duration !== undefined,
    );

    this.nodeAssessments.clear();
    for (const node of nodes) {
      const structural = structuralBundle.structural[node.index]!;
      const execution =
        executionAnalysis.durations[node.index] === undefined
          ? undefined
          : {
              durationMs: executionAnalysis.durations[node.index],
              criticalPath: executionAnalysis.criticalPath[node.index],
              slackMs: executionAnalysis.slackMs[node.index],
              weightedImpactScore:
                executionAnalysis.weightedImpactScores[node.index],
              status: executionAnalysis.statuses[node.index],
              threadId: executionAnalysis.threadIds[node.index],
            };

      const durationScore = executionAnalysis.durationScores[node.index] ?? 0;
      const criticalPathBonus = execution?.criticalPath ? 100 : 0;
      const bottleneckScore = execution
        ? clampScore(
            durationScore * 0.35 +
              (execution.weightedImpactScore ?? 0) * 0.25 +
              (structural.pathConcentrationScore ?? 0) * 0.2 +
              criticalPathBonus * 0.2,
          )
        : clampScore(
            structural.blastRadiusScore * 0.5 + structural.fragilityScore * 0.5,
          );

      const assessment: NodeRiskAssessment = {
        uniqueId: node.uniqueId,
        resourceType: node.attributes.resource_type,
        name: node.attributes.name,
        packageName: node.attributes.package_name || undefined,
        structural,
        ...(execution ? { execution } : {}),
        composite: {
          bottleneckScore,
          overallRiskScore: clampScore(
            bottleneckScore * 0.4 +
              structural.fragilityScore * 0.35 +
              structural.blastRadiusScore * 0.25,
          ),
        },
        findings: [],
        recommendations: [],
      };

      const rationale = buildFindingsForNode(
        assessment,
        this.options.thresholds,
        hasExecutionData,
        executionAnalysis.durationScores[node.index],
      );
      assessment.findings = rationale.findings;
      assessment.recommendations = rationale.recommendations;
      this.nodeAssessments.set(node.uniqueId, assessment);
    }

    this.summary = {
      totalNodes: this.graph.getGraph().order,
      analyzedNodes: nodes.length,
      resourceTypes: [...this.options.resourceTypes],
      ...(executionAnalysis.executionCoveragePct !== undefined
        ? { executionCoveragePct: executionAnalysis.executionCoveragePct }
        : {}),
      topBottlenecks: this.sortNodesByMetric(
        "bottleneckScore",
        this.options.topN,
      ),
      topFragileNodes: this.sortNodesByMetric(
        "fragilityScore",
        this.options.topN,
      ),
      topBlastRadiusNodes: this.sortNodesByMetric(
        "blastRadiusScore",
        this.options.topN,
      ),
    };

    return this.summary;
  }

  getNode(uniqueId: string): NodeRiskAssessment | undefined {
    this.analyze();
    return this.nodeAssessments.get(uniqueId);
  }

  getTopNodes(args?: {
    metric?: GraphRiskRankingMetric;
    limit?: number;
  }): NodeRiskAssessment[] {
    this.analyze();
    const metric = args?.metric ?? "overallRiskScore";
    const limit = Math.max(1, Math.trunc(args?.limit ?? this.options.topN));
    return this.sortNodesByMetric(metric, limit);
  }

  private sortNodesByMetric(
    metric: GraphRiskRankingMetric,
    limit: number,
  ): NodeRiskAssessment[] {
    return [...this.nodeAssessments.values()]
      .sort((left, right) => {
        const delta =
          getGraphRiskMetricNumeric(right, metric) -
          getGraphRiskMetricNumeric(left, metric);
        if (delta !== 0) {
          return delta;
        }
        return left.uniqueId.localeCompare(right.uniqueId);
      })
      .slice(0, limit);
  }
}
