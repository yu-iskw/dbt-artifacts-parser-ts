import type { ParsedManifest } from "dbt-artifacts-parser/manifest";
import type { ParsedRunResults } from "dbt-artifacts-parser/run_results";
import type { DbtResourceType } from "../types";

export interface GraphRiskAnalyzerArgs {
  manifest: ParsedManifest;
  runResults?: ParsedRunResults;
  options?: GraphRiskAnalyzerOptions;
}

export interface GraphRiskThresholds {
  highScore: number;
  moderateScore: number;
  highFanIn: number;
  criticalSlackMs: number;
}

export interface GraphRiskAnalyzerOptions {
  resourceTypes?: DbtResourceType[];
  includeExecution?: boolean;
  topN?: number;
  maxExactStructuralNodes?: number;
  thresholds?: Partial<GraphRiskThresholds>;
}

export interface NodeStructuralMetrics {
  inDegree: number;
  outDegree: number;
  transitiveUpstreamCount: number;
  transitiveDownstreamCount: number;
  longestUpstreamDepth: number;
  longestDownstreamDepth: number;
  blastRadiusScore: number;
  fragilityScore: number;
  reconvergenceScore: number;
  pathConcentrationScore?: number;
}

export interface NodeExecutionMetrics {
  durationMs?: number;
  criticalPath?: boolean;
  slackMs?: number;
  weightedImpactScore?: number;
  status?: string;
  threadId?: string;
}

export interface NodeRiskAssessment {
  uniqueId: string;
  resourceType: string;
  name: string;
  packageName?: string;
  structural: NodeStructuralMetrics;
  execution?: NodeExecutionMetrics;
  composite: {
    bottleneckScore: number;
    overallRiskScore: number;
  };
  findings: string[];
  recommendations: string[];
}

export interface GraphRiskSummary {
  totalNodes: number;
  analyzedNodes: number;
  resourceTypes: string[];
  executionCoveragePct?: number;
  topBottlenecks: NodeRiskAssessment[];
  topFragileNodes: NodeRiskAssessment[];
  topBlastRadiusNodes: NodeRiskAssessment[];
}
