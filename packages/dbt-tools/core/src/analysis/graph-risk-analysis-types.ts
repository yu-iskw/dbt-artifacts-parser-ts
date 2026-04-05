import type { GraphNodeAttributes, DbtResourceType } from "../types";
import type { GraphRiskThresholds } from "./graph-risk-model";

export type ResolvedOptions = {
  resourceTypes: DbtResourceType[];
  includeExecution: boolean;
  topN: number;
  maxExactStructuralNodes: number;
  thresholds: GraphRiskThresholds;
};

export type AnalysisNode = {
  index: number;
  uniqueId: string;
  attributes: GraphNodeAttributes;
  parents: number[];
  children: number[];
};

export type ReachabilityCollection = Uint32Array | Set<number>;

export type ReachabilityState = {
  useBitsets: boolean;
  ancestors: ReachabilityCollection[];
  descendants: ReachabilityCollection[];
  ancestorCounts: number[];
  descendantCounts: number[];
};

export type StructuralRawMetrics = {
  inDegree: number[];
  outDegree: number[];
  transitiveUpstreamCount: number[];
  transitiveDownstreamCount: number[];
  longestUpstreamDepth: number[];
  longestDownstreamDepth: number[];
  reconvergenceRaw: number[];
  pathConcentrationRaw: number[];
};

export type ExecutionSnapshot = {
  durationMs: number;
  status: string;
  threadId?: string;
};

export type ExecutionAnalysis = {
  durations: Array<number | undefined>;
  durationScores: Array<number | undefined>;
  weightedImpactScores: Array<number | undefined>;
  criticalPath: boolean[];
  slackMs: Array<number | undefined>;
  statuses: Array<string | undefined>;
  threadIds: Array<string | undefined>;
  executionCoveragePct?: number;
};
