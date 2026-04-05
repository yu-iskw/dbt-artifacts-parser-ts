import type {
  AnalysisNode,
  StructuralRawMetrics,
} from "./graph-risk-analysis-types";
import {
  buildReachabilityState,
  computeReconvergenceRaw,
} from "./graph-risk-reachability";
import { logSumExp, safeProbability } from "./graph-risk-math";

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

export function computeStructuralRawMetrics(
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
