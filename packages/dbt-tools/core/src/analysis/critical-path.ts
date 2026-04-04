import { topologicalSort } from "graphology-dag";
import type { DirectedGraph } from "graphology";
import type { GraphEdgeAttributes, GraphNodeAttributes } from "../types";

export interface WeightedCriticalPathResult {
  path: string[];
  total_time: number;
  node_times: Record<string, number>;
}

function resolveCandidateNodes(
  graph: DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>,
  nodeWeights: Map<string, number>,
  includeNodes?: Set<string>,
): Set<string> {
  if (includeNodes) {
    return includeNodes;
  }
  return new Set(Array.from(nodeWeights.keys()).filter((n) => graph.hasNode(n)));
}

function calculateDistances(
  graph: DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>,
  order: string[],
  candidateNodes: Set<string>,
  nodeWeights: Map<string, number>,
): {
  dist: Map<string, number>;
  prev: Map<string, string | undefined>;
} {
  const dist = new Map<string, number>();
  const prev = new Map<string, string | undefined>();

  for (const nodeId of order) {
    let bestPred: string | undefined;
    let bestPredDist = 0;

    for (const pred of graph.inboundNeighbors(nodeId)) {
      if (!candidateNodes.has(pred)) continue;
      const predDist = dist.get(pred) ?? 0;
      if (bestPred === undefined || predDist > bestPredDist) {
        bestPred = pred;
        bestPredDist = predDist;
      }
    }

    const weight = Math.max(0, nodeWeights.get(nodeId) ?? 0);
    dist.set(nodeId, bestPredDist + weight);
    prev.set(nodeId, bestPred);
  }

  return { dist, prev };
}

function findBestEndpoint(
  graph: DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>,
  order: string[],
  candidateNodes: Set<string>,
  dist: Map<string, number>,
): string | undefined {
  let bestEnd: string | undefined;
  let bestTotal = -1;

  const updateBest = (nodeId: string) => {
    const nodeDist = dist.get(nodeId) ?? 0;
    if (bestEnd === undefined || nodeDist > bestTotal) {
      bestEnd = nodeId;
      bestTotal = nodeDist;
    }
  };

  for (const nodeId of order) {
    const hasIncludedChild = graph
      .outboundNeighbors(nodeId)
      .some((child) => candidateNodes.has(child));
    if (!hasIncludedChild) {
      updateBest(nodeId);
    }
  }

  if (bestEnd !== undefined) {
    return bestEnd;
  }

  for (const nodeId of order) {
    updateBest(nodeId);
  }
  return bestEnd;
}

function buildPath(
  endNode: string,
  prev: Map<string, string | undefined>,
): string[] {
  const path: string[] = [];
  let cursor: string | undefined = endNode;
  while (cursor !== undefined) {
    path.push(cursor);
    cursor = prev.get(cursor);
  }
  path.reverse();
  return path;
}

export function calculateWeightedCriticalPath(
  graph: DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>,
  nodeWeights: Map<string, number>,
  includeNodes?: Set<string>,
): WeightedCriticalPathResult | undefined {
  const candidateNodes = resolveCandidateNodes(graph, nodeWeights, includeNodes);

  if (candidateNodes.size === 0) {
    return undefined;
  }

  const order = topologicalSort(graph).filter((nodeId) => candidateNodes.has(nodeId));
  if (order.length === 0) {
    return undefined;
  }

  const { dist, prev } = calculateDistances(graph, order, candidateNodes, nodeWeights);
  const bestEnd = findBestEndpoint(graph, order, candidateNodes, dist);
  if (bestEnd === undefined) {
    return undefined;
  }

  const path = buildPath(bestEnd, prev);
  const bestTotal = dist.get(bestEnd) ?? 0;

  const nodeTimes: Record<string, number> = {};
  for (const nodeId of path) {
    nodeTimes[nodeId] = Math.max(0, nodeWeights.get(nodeId) ?? 0);
  }

  return {
    path,
    total_time: Math.max(0, bestTotal),
    node_times: nodeTimes,
  };
}
