import type {
  GraphRiskThresholds,
  NodeRiskAssessment,
  NodeStructuralMetrics,
} from "./graph-risk-model";

const RECOMMEND_ENRICHMENT_VS_MART =
  "Separate reusable enrichment logic from final mart assembly";

function addFinding(findings: string[], finding: string): void {
  if (!findings.includes(finding)) {
    findings.push(finding);
  }
}

function addRecommendation(
  recommendations: string[],
  recommendation: string,
): void {
  if (!recommendations.includes(recommendation)) {
    recommendations.push(recommendation);
  }
}

function addStructuralFindings(
  structural: NodeStructuralMetrics,
  thresholds: GraphRiskThresholds,
  findings: string[],
  recommendations: string[],
): void {
  if (structural.blastRadiusScore >= thresholds.highScore) {
    addFinding(
      findings,
      `High downstream blast radius: affects ${structural.transitiveDownstreamCount} descendants`,
    );
    addRecommendation(recommendations, RECOMMEND_ENRICHMENT_VS_MART);
  }

  if (structural.inDegree >= thresholds.highFanIn) {
    addFinding(findings, `High fan-in: ${structural.inDegree} direct parents`);
    addRecommendation(
      recommendations,
      "Reduce direct fan-in by staging/enrichment decomposition",
    );
  }

  if ((structural.reconvergenceScore ?? 0) >= thresholds.highScore) {
    addFinding(
      findings,
      "High reconvergence: merges multiple large upstream branches",
    );
    addRecommendation(
      recommendations,
      "Split intermediate models by concept to reduce repeated branch merges",
    );
  }

  if ((structural.pathConcentrationScore ?? 0) >= thresholds.highScore) {
    addFinding(
      findings,
      "Likely single transformation chokepoint: many root-to-leaf paths pass through this node",
    );
    addRecommendation(recommendations, RECOMMEND_ENRICHMENT_VS_MART);
  }
}

function addExecutionFindings(
  assessment: NodeRiskAssessment,
  thresholds: GraphRiskThresholds,
  hasExecutionData: boolean,
  effectiveDurationScore: number,
  findings: string[],
  recommendations: string[],
): void {
  const { structural, execution } = assessment;
  if (!execution) {
    return;
  }

  if (
    execution.criticalPath &&
    (execution.slackMs ?? Number.MAX_SAFE_INTEGER) <= thresholds.criticalSlackMs
  ) {
    addFinding(findings, "On critical path with low slack");
    addRecommendation(
      recommendations,
      "Materialize an upstream expensive branch",
    );
  }

  if (!hasExecutionData || execution.durationMs === undefined) {
    return;
  }

  if (
    structural.fragilityScore >= thresholds.highScore &&
    effectiveDurationScore < thresholds.moderateScore
  ) {
    addFinding(findings, "Structurally central but not slow in this run");
  }

  if (
    effectiveDurationScore >= thresholds.highScore &&
    execution.criticalPath !== true
  ) {
    addFinding(findings, "Slow but not schedule-critical in this run");
    addRecommendation(
      recommendations,
      "Review whether this view chain should be materialized",
    );
  }

  if (
    effectiveDurationScore >= thresholds.moderateScore &&
    execution.criticalPath
  ) {
    addFinding(findings, "Slow and schedule-critical in this run");
    addRecommendation(
      recommendations,
      "Materialize an upstream expensive branch",
    );
  }

  if (execution.durationMs > 0 && assessment.resourceType === "model") {
    addRecommendation(
      recommendations,
      "Review whether this view chain should be materialized",
    );
  }
}

function addFallbackFinding(
  structural: NodeStructuralMetrics,
  thresholds: GraphRiskThresholds,
  findings: string[],
  recommendations: string[],
): void {
  if (
    findings.length !== 0 ||
    structural.fragilityScore < thresholds.moderateScore
  ) {
    return;
  }

  addFinding(
    findings,
    "Elevated structural fragility from lineage depth and dependency concentration",
  );
  addRecommendation(recommendations, "Split intermediate models by concept");
}

export function buildFindingsForNode(
  assessment: NodeRiskAssessment,
  thresholds: GraphRiskThresholds,
  hasExecutionData: boolean,
  durationScore?: number,
): { findings: string[]; recommendations: string[] } {
  const findings: string[] = [];
  const recommendations: string[] = [];
  const { structural } = assessment;
  const effectiveDurationScore = durationScore ?? 0;

  addStructuralFindings(structural, thresholds, findings, recommendations);
  addExecutionFindings(
    assessment,
    thresholds,
    hasExecutionData,
    effectiveDurationScore,
    findings,
    recommendations,
  );
  addFallbackFinding(structural, thresholds, findings, recommendations);

  return { findings, recommendations };
}
