import { DirectedGraph } from "graphology";
import { hasCycle, topologicalSort } from "graphology-dag";
import type { DbtResourceType, GraphNodeAttributes } from "../types";
import type { ManifestGraph } from "./manifest-graph";
import type { AnalysisNode } from "./graph-risk-analysis-types";

export function buildSubgraphOrder(nodes: AnalysisNode[]): number[] {
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

export function buildAnalysisNodes(
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
