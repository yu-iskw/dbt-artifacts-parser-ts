import { DirectedGraph } from "graphology";
import { hasCycle, topologicalSort } from "graphology-dag";
import type { ParsedManifest } from "dbt-artifacts-parser/manifest";
import type { ParsedRunResults } from "dbt-artifacts-parser/run_results";
import { ManifestGraph } from "./manifest-graph";
import type { GraphNodeAttributes, DbtResourceType } from "../types";
import { buildNodeExecutionsFromRunResults } from "./execution-analyzer";

export interface GraphRiskAnalyzerArgs {
  manifest: ParsedManifest;
  runResults?: ParsedRunResults;
  options?: GraphRiskAnalyzerOptions;
}

export type GraphRiskRankingMetric =
  | "overallRiskScore"
  | "bottleneckScore"
  | "blastRadiusScore"
  | "fragilityScore"
  | "reconvergenceScore"
  | "pathConcentrationScore";

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
  dominanceScore?: number;
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

type ResolvedOptions = {
  resourceTypes: DbtResourceType[];
  includeExecution: boolean;
  topN: number;
  maxExactStructuralNodes: number;
  thresholds: GraphRiskThresholds;
};

type AnalysisNode = {
  index: number;
  uniqueId: string;
  attributes: GraphNodeAttributes;
  parents: number[];
  children: number[];
};

type ReachabilityCollection = Uint32Array | Set<number>;

type ReachabilityState = {
  useBitsets: boolean;
  ancestors: ReachabilityCollection[];
  descendants: ReachabilityCollection[];
  ancestorCounts: number[];
  descendantCounts: number[];
};

type StructuralRawMetrics = {
  inDegree: number[];
  outDegree: number[];
  transitiveUpstreamCount: number[];
  transitiveDownstreamCount: number[];
  longestUpstreamDepth: number[];
  longestDownstreamDepth: number[];
  reconvergenceRaw: number[];
  pathConcentrationRaw: number[];
};

type ExecutionSnapshot = {
  durationMs: number;
  status: string;
  threadId?: string;
};

type ExecutionAnalysis = {
  durations: Array<number | undefined>;
  durationScores: Array<number | undefined>;
  weightedImpactScores: Array<number | undefined>;
  criticalPath: boolean[];
  slackMs: Array<number | undefined>;
  statuses: Array<string | undefined>;
  threadIds: Array<string | undefined>;
  executionCoveragePct?: number;
};

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

const VALID_RESOURCE_TYPES = new Set<DbtResourceType>([
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
]);

function resolveOptions(options?: GraphRiskAnalyzerOptions): ResolvedOptions {
  const resourceTypes = (
    options?.resourceTypes ?? DEFAULT_OPTIONS.resourceTypes
  ).filter((type): type is DbtResourceType => VALID_RESOURCE_TYPES.has(type));
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

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) return 0;
  if (value > 100) return 100;
  return roundNumber(value);
}

function roundNumber(value: number, digits = 2): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeArray(values: number[]): number[] {
  if (values.length === 0) {
    return [];
  }

  const finiteValues = values.filter(Number.isFinite);
  if (finiteValues.length === 0) {
    return values.map(() => 0);
  }

  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  if (max <= min) {
    return values.map(() => 0);
  }

  return values.map((value) => clampScore(((value - min) / (max - min)) * 100));
}

function normalizeSparseArray(
  values: Array<number | undefined>,
): Array<number | undefined> {
  const finiteValues = values.filter(
    (value): value is number => value !== undefined && Number.isFinite(value),
  );
  if (finiteValues.length === 0) {
    return values.map(() => undefined);
  }

  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  if (max <= min) {
    return values.map((value) => (value === undefined ? undefined : 0));
  }

  return values.map((value) =>
    value === undefined
      ? undefined
      : clampScore(((value - min) / (max - min)) * 100),
  );
}

function logSumExp(values: number[]): number {
  if (values.length === 0) {
    return Number.NEGATIVE_INFINITY;
  }

  const max = Math.max(...values);
  if (!Number.isFinite(max)) {
    return max;
  }

  let sum = 0;
  for (const value of values) {
    sum += Math.exp(value - max);
  }
  return max + Math.log(sum);
}

function safeProbability(logValue: number): number {
  if (!Number.isFinite(logValue)) {
    return 0;
  }
  return Math.max(0, Math.min(1, Math.exp(logValue)));
}

function popcount32(value: number): number {
  let current = value >>> 0;
  let count = 0;
  while (current !== 0) {
    current &= current - 1;
    count++;
  }
  return count;
}

function createBitset(words: number): Uint32Array {
  return new Uint32Array(words);
}

function unionIntoBitset(target: Uint32Array, source: Uint32Array): void {
  for (let index = 0; index < target.length; index++) {
    target[index] |= source[index];
  }
}

function setBit(bitset: Uint32Array, index: number): void {
  const word = index >>> 5;
  const offset = index & 31;
  bitset[word] |= 1 << offset;
}

function countBits(bitset: Uint32Array): number {
  let count = 0;
  for (const word of bitset) {
    count += popcount32(word);
  }
  return count;
}

function countBitsetIntersection(a: Uint32Array, b: Uint32Array): number {
  let count = 0;
  for (let index = 0; index < a.length; index++) {
    count += popcount32(a[index]! & b[index]!);
  }
  return count;
}

function countSetIntersection(a: Set<number>, b: Set<number>): number {
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  let count = 0;
  for (const value of smaller) {
    if (larger.has(value)) {
      count++;
    }
  }
  return count;
}

function buildSubgraphOrder(nodes: AnalysisNode[]): number[] {
  const subgraph = new DirectedGraph<
    GraphNodeAttributes,
    { kind: "analysis" }
  >();
  for (const node of nodes) {
    subgraph.addNode(node.uniqueId, node.attributes);
  }
  for (const node of nodes) {
    for (const childIndex of node.children) {
      const child = nodes[childIndex]!;
      if (!subgraph.hasEdge(node.uniqueId, child.uniqueId)) {
        subgraph.addEdge(node.uniqueId, child.uniqueId, { kind: "analysis" });
      }
    }
  }

  if (hasCycle(subgraph)) {
    throw new Error(
      "GraphRiskAnalyzer requires an acyclic analyzed subgraph; the selected resource types contain a cycle.",
    );
  }

  const orderedIds = topologicalSort(subgraph);
  const indexById = new Map(nodes.map((node) => [node.uniqueId, node.index]));
  return orderedIds
    .map((nodeId) => indexById.get(nodeId))
    .filter((value): value is number => value !== undefined);
}

function buildAnalysisNodes(
  graph: ManifestGraph,
  resourceTypes: DbtResourceType[],
): { nodes: AnalysisNode[]; topoOrder: number[] } {
  const g = graph.getGraph();
  const resourceTypeSet = new Set(resourceTypes);
  const selectedIds: string[] = [];

  g.forEachNode((nodeId, attributes) => {
    if (resourceTypeSet.has(attributes.resource_type)) {
      selectedIds.push(nodeId);
    }
  });

  const indexById = new Map(
    selectedIds.map((uniqueId, index) => [uniqueId, index]),
  );
  const nodes = selectedIds.map((uniqueId, index) => {
    const attributes = g.getNodeAttributes(uniqueId);
    const parents = g
      .inboundNeighbors(uniqueId)
      .map((neighborId) => indexById.get(neighborId))
      .filter((value): value is number => value !== undefined);
    const children = g
      .outboundNeighbors(uniqueId)
      .map((neighborId) => indexById.get(neighborId))
      .filter((value): value is number => value !== undefined);

    return {
      index,
      uniqueId,
      attributes,
      parents,
      children,
    };
  });

  const topoOrder = buildSubgraphOrder(nodes);
  return { nodes, topoOrder };
}

function buildReachabilityState(
  nodes: AnalysisNode[],
  topoOrder: number[],
  maxExactStructuralNodes: number,
): ReachabilityState {
  const useBitsets = nodes.length <= maxExactStructuralNodes;
  const words = Math.ceil(nodes.length / 32);
  const ancestors = createReachabilityCollections(
    nodes.length,
    useBitsets,
    words,
  );
  const descendants = createReachabilityCollections(
    nodes.length,
    useBitsets,
    words,
  );
  const ancestorCounts = new Array<number>(nodes.length).fill(0);
  const descendantCounts = new Array<number>(nodes.length).fill(0);

  if (useBitsets) {
    populateAncestorBitsets(nodes, topoOrder, ancestors, ancestorCounts);
    populateDescendantBitsets(nodes, topoOrder, descendants, descendantCounts);
  } else {
    populateAncestorSets(nodes, topoOrder, ancestors, ancestorCounts);
    populateDescendantSets(nodes, topoOrder, descendants, descendantCounts);
  }

  return {
    useBitsets,
    ancestors,
    descendants,
    ancestorCounts,
    descendantCounts,
  };
}

function createReachabilityCollections(
  count: number,
  useBitsets: boolean,
  words: number,
): ReachabilityCollection[] {
  return Array.from({ length: count }, () =>
    useBitsets ? createBitset(words) : new Set<number>(),
  );
}

function populateAncestorBitsets(
  nodes: AnalysisNode[],
  topoOrder: number[],
  ancestors: ReachabilityCollection[],
  ancestorCounts: number[],
): void {
  for (const nodeIndex of topoOrder) {
    const current = ancestors[nodeIndex] as Uint32Array;
    for (const parentIndex of nodes[nodeIndex]!.parents) {
      unionIntoBitset(current, ancestors[parentIndex] as Uint32Array);
      setBit(current, parentIndex);
    }
    ancestorCounts[nodeIndex] = countBits(current);
  }
}

function populateDescendantBitsets(
  nodes: AnalysisNode[],
  topoOrder: number[],
  descendants: ReachabilityCollection[],
  descendantCounts: number[],
): void {
  for (let position = topoOrder.length - 1; position >= 0; position--) {
    const nodeIndex = topoOrder[position]!;
    const current = descendants[nodeIndex] as Uint32Array;
    for (const childIndex of nodes[nodeIndex]!.children) {
      unionIntoBitset(current, descendants[childIndex] as Uint32Array);
      setBit(current, childIndex);
    }
    descendantCounts[nodeIndex] = countBits(current);
  }
}

function populateAncestorSets(
  nodes: AnalysisNode[],
  topoOrder: number[],
  ancestors: ReachabilityCollection[],
  ancestorCounts: number[],
): void {
  for (const nodeIndex of topoOrder) {
    const current = ancestors[nodeIndex] as Set<number>;
    for (const parentIndex of nodes[nodeIndex]!.parents) {
      current.add(parentIndex);
      for (const ancestor of ancestors[parentIndex] as Set<number>) {
        current.add(ancestor);
      }
    }
    ancestorCounts[nodeIndex] = current.size;
  }
}

function populateDescendantSets(
  nodes: AnalysisNode[],
  topoOrder: number[],
  descendants: ReachabilityCollection[],
  descendantCounts: number[],
): void {
  for (let position = topoOrder.length - 1; position >= 0; position--) {
    const nodeIndex = topoOrder[position]!;
    const current = descendants[nodeIndex] as Set<number>;
    for (const childIndex of nodes[nodeIndex]!.children) {
      current.add(childIndex);
      for (const descendant of descendants[childIndex] as Set<number>) {
        current.add(descendant);
      }
    }
    descendantCounts[nodeIndex] = current.size;
  }
}

function computeDepthMetrics(
  nodes: AnalysisNode[],
  topoOrder: number[],
): Pick<
  StructuralRawMetrics,
  "longestUpstreamDepth" | "longestDownstreamDepth" | "inDegree" | "outDegree"
> {
  const longestUpstreamDepth = new Array<number>(nodes.length).fill(0);
  const longestDownstreamDepth = new Array<number>(nodes.length).fill(0);
  const inDegree = nodes.map((node) => node.parents.length);
  const outDegree = nodes.map((node) => node.children.length);

  for (const nodeIndex of topoOrder) {
    const node = nodes[nodeIndex]!;
    if (node.parents.length === 0) {
      continue;
    }
    longestUpstreamDepth[nodeIndex] =
      Math.max(
        ...node.parents.map(
          (parentIndex) => longestUpstreamDepth[parentIndex]!,
        ),
      ) + 1;
  }

  for (let position = topoOrder.length - 1; position >= 0; position--) {
    const nodeIndex = topoOrder[position]!;
    const node = nodes[nodeIndex]!;
    if (node.children.length === 0) {
      continue;
    }
    longestDownstreamDepth[nodeIndex] =
      Math.max(
        ...node.children.map(
          (childIndex) => longestDownstreamDepth[childIndex]!,
        ),
      ) + 1;
  }

  return {
    inDegree,
    outDegree,
    longestUpstreamDepth,
    longestDownstreamDepth,
  };
}

function countOverlapRatio(
  reachability: ReachabilityState,
  leftIndex: number,
  rightIndex: number,
): number {
  const leftCount = reachability.ancestorCounts[leftIndex]!;
  const rightCount = reachability.ancestorCounts[rightIndex]!;

  if (reachability.useBitsets) {
    const intersection = countBitsetIntersection(
      reachability.ancestors[leftIndex] as Uint32Array,
      reachability.ancestors[rightIndex] as Uint32Array,
    );
    const union = leftCount + rightCount - intersection;
    return union <= 0 ? 0 : intersection / union;
  }

  const intersection = countSetIntersection(
    reachability.ancestors[leftIndex] as Set<number>,
    reachability.ancestors[rightIndex] as Set<number>,
  );
  const union = leftCount + rightCount - intersection;
  return union <= 0 ? 0 : intersection / union;
}

function computeReconvergenceRaw(
  nodes: AnalysisNode[],
  reachability: ReachabilityState,
): number[] {
  const scores = new Array<number>(nodes.length).fill(0);

  for (const node of nodes) {
    if (node.parents.length < 2) {
      continue;
    }

    let pairCount = 0;
    let overlapTotal = 0;
    for (let left = 0; left < node.parents.length; left++) {
      for (let right = left + 1; right < node.parents.length; right++) {
        overlapTotal += countOverlapRatio(
          reachability,
          node.parents[left]!,
          node.parents[right]!,
        );
        pairCount++;
      }
    }

    const averagePairwiseOverlap = pairCount > 0 ? overlapTotal / pairCount : 0;
    const averageParentBreadth =
      node.parents.reduce(
        (sum, parentIndex) => sum + reachability.ancestorCounts[parentIndex]!,
        0,
      ) / node.parents.length;

    // Reconvergence rises when several parents merge and those parent branches
    // are both wide and overlapping. Parent count matters, but overlap remains
    // the main driver so repeated merges outrank simple high fan-in joins.
    scores[node.index] =
      averagePairwiseOverlap * 2 +
      Math.log1p(averageParentBreadth) * 0.75 +
      Math.log1p(node.parents.length - 1) * 0.5;
  }

  return scores;
}

function computePathConcentrationRaw(
  nodes: AnalysisNode[],
  topoOrder: number[],
): number[] {
  if (nodes.length === 0) {
    return [];
  }

  const logPathsFromRoots = new Array<number>(nodes.length).fill(
    Number.NEGATIVE_INFINITY,
  );
  const logPathsToLeaves = new Array<number>(nodes.length).fill(
    Number.NEGATIVE_INFINITY,
  );

  for (const nodeIndex of topoOrder) {
    const node = nodes[nodeIndex]!;
    if (node.parents.length === 0) {
      logPathsFromRoots[nodeIndex] = 0;
      continue;
    }
    logPathsFromRoots[nodeIndex] = logSumExp(
      node.parents.map((parentIndex) => logPathsFromRoots[parentIndex]!),
    );
  }

  for (let position = topoOrder.length - 1; position >= 0; position--) {
    const nodeIndex = topoOrder[position]!;
    const node = nodes[nodeIndex]!;
    if (node.children.length === 0) {
      logPathsToLeaves[nodeIndex] = 0;
      continue;
    }
    logPathsToLeaves[nodeIndex] = logSumExp(
      node.children.map((childIndex) => logPathsToLeaves[childIndex]!),
    );
  }

  const leafLogs = topoOrder
    .filter((nodeIndex) => nodes[nodeIndex]!.children.length === 0)
    .map((nodeIndex) => logPathsFromRoots[nodeIndex]!);
  const totalRootLeafLog = logSumExp(leafLogs);

  return topoOrder.map((nodeIndex) =>
    safeProbability(
      logPathsFromRoots[nodeIndex]! +
        logPathsToLeaves[nodeIndex]! -
        totalRootLeafLog,
    ),
  );
}

function computeStructuralRawMetrics(
  nodes: AnalysisNode[],
  topoOrder: number[],
  maxExactStructuralNodes: number,
): StructuralRawMetrics {
  const reachability = buildReachabilityState(
    nodes,
    topoOrder,
    maxExactStructuralNodes,
  );
  const depthMetrics = computeDepthMetrics(nodes, topoOrder);
  const reconvergenceRaw = computeReconvergenceRaw(nodes, reachability);
  const pathConcentrationRaw = computePathConcentrationRaw(nodes, topoOrder);

  return {
    inDegree: depthMetrics.inDegree,
    outDegree: depthMetrics.outDegree,
    transitiveUpstreamCount: reachability.ancestorCounts,
    transitiveDownstreamCount: reachability.descendantCounts,
    longestUpstreamDepth: depthMetrics.longestUpstreamDepth,
    longestDownstreamDepth: depthMetrics.longestDownstreamDepth,
    reconvergenceRaw,
    pathConcentrationRaw,
  };
}

function buildExecutionMap(
  runResults: ParsedRunResults | undefined,
  nodes: AnalysisNode[],
): Map<string, ExecutionSnapshot> {
  if (!runResults) {
    return new Map();
  }

  const allowedIds = new Set(nodes.map((node) => node.uniqueId));
  const snapshots = new Map<string, ExecutionSnapshot>();

  for (const execution of buildNodeExecutionsFromRunResults(runResults)) {
    if (!allowedIds.has(execution.unique_id)) {
      continue;
    }
    snapshots.set(execution.unique_id, {
      durationMs: Math.max(
        0,
        Math.round((execution.execution_time ?? 0) * 1000),
      ),
      status: execution.status || "unknown",
      threadId: execution.thread_id,
    });
  }

  return snapshots;
}

function computeExecutionAnalysis(
  nodes: AnalysisNode[],
  topoOrder: number[],
  options: ResolvedOptions,
  runResults: ParsedRunResults | undefined,
  blastRadiusScores: number[],
  pathConcentrationScores: number[],
): ExecutionAnalysis {
  const durations = new Array<number | undefined>(nodes.length).fill(undefined);
  const durationScores = new Array<number | undefined>(nodes.length).fill(
    undefined,
  );
  const weightedImpactScores = new Array<number | undefined>(nodes.length).fill(
    undefined,
  );
  const criticalPath = new Array<boolean>(nodes.length).fill(false);
  const slackMs = new Array<number | undefined>(nodes.length).fill(undefined);
  const statuses = new Array<string | undefined>(nodes.length).fill(undefined);
  const threadIds = new Array<string | undefined>(nodes.length).fill(undefined);

  if (!options.includeExecution || !runResults) {
    return {
      durations,
      durationScores,
      weightedImpactScores,
      criticalPath,
      slackMs,
      statuses,
      threadIds,
    };
  }

  const executionMap = buildExecutionMap(runResults, nodes);
  if (executionMap.size === 0) {
    return {
      durations,
      durationScores,
      weightedImpactScores,
      criticalPath,
      slackMs,
      statuses,
      threadIds,
      executionCoveragePct:
        nodes.length === 0 ? undefined : roundNumber((0 / nodes.length) * 100),
    };
  }

  const earliestStart = new Array<number>(nodes.length).fill(0);
  const earliestFinish = new Array<number>(nodes.length).fill(0);
  const latestStart = new Array<number>(nodes.length).fill(0);
  const latestFinish = new Array<number>(nodes.length).fill(0);
  const weightedImpactRaw = new Array<number | undefined>(nodes.length).fill(
    undefined,
  );
  const executed = new Array<boolean>(nodes.length).fill(false);

  for (const node of nodes) {
    const snapshot = executionMap.get(node.uniqueId);
    if (!snapshot) {
      continue;
    }
    executed[node.index] = true;
    durations[node.index] = snapshot.durationMs;
    statuses[node.index] = snapshot.status;
    threadIds[node.index] = snapshot.threadId;
  }

  for (const nodeIndex of topoOrder) {
    if (!executed[nodeIndex]) {
      continue;
    }
    const node = nodes[nodeIndex]!;
    const executedParents = node.parents.filter(
      (parentIndex) => executed[parentIndex],
    );
    earliestStart[nodeIndex] =
      executedParents.length === 0
        ? 0
        : Math.max(
            ...executedParents.map(
              (parentIndex) => earliestFinish[parentIndex]!,
            ),
          );
    earliestFinish[nodeIndex] =
      earliestStart[nodeIndex]! + (durations[nodeIndex] ?? 0);
  }

  const projectDuration = Math.max(...earliestFinish);
  for (let position = topoOrder.length - 1; position >= 0; position--) {
    const nodeIndex = topoOrder[position]!;
    if (!executed[nodeIndex]) {
      continue;
    }
    const node = nodes[nodeIndex]!;
    const executedChildren = node.children.filter(
      (childIndex) => executed[childIndex],
    );
    latestFinish[nodeIndex] =
      executedChildren.length === 0
        ? projectDuration
        : Math.min(
            ...executedChildren.map((childIndex) => latestStart[childIndex]!),
          );
    latestStart[nodeIndex] =
      latestFinish[nodeIndex]! - (durations[nodeIndex] ?? 0);
    const slack = Math.max(
      0,
      latestStart[nodeIndex]! - earliestStart[nodeIndex]!,
    );
    slackMs[nodeIndex] = Math.round(slack);
    criticalPath[nodeIndex] = slack <= options.thresholds.criticalSlackMs;
    weightedImpactRaw[nodeIndex] =
      (durations[nodeIndex] ?? 0) *
      (1 +
        (blastRadiusScores[nodeIndex] ?? 0) / 100 +
        (pathConcentrationScores[nodeIndex] ?? 0) / 100);
  }

  const normalizedDurations = normalizeSparseArray(durations);
  const normalizedWeightedImpact = normalizeSparseArray(weightedImpactRaw);

  for (let index = 0; index < nodes.length; index++) {
    durationScores[index] = normalizedDurations[index];
    weightedImpactScores[index] = normalizedWeightedImpact[index];
  }

  return {
    durations,
    durationScores,
    weightedImpactScores,
    criticalPath,
    slackMs,
    statuses,
    threadIds,
    executionCoveragePct: roundNumber((executionMap.size / nodes.length) * 100),
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
    addRecommendation(
      recommendations,
      "Separate reusable enrichment logic from final mart assembly",
    );
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
    addRecommendation(
      recommendations,
      "Separate reusable enrichment logic from final mart assembly",
    );
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

function buildFindingsForNode(
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

function getMetricValue(
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
          getMetricValue(right, metric) - getMetricValue(left, metric);
        if (delta !== 0) {
          return delta;
        }
        return left.uniqueId.localeCompare(right.uniqueId);
      })
      .slice(0, limit);
  }
}
