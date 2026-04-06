import { DirectedGraph } from "graphology";
import type { ManifestGraph } from "./manifest-graph";
import type { GraphEdgeAttributes, GraphNodeAttributes } from "../types";

export function createFocusedGraph(
  graph: ManifestGraph,
  focusNodeIds: string[],
  direction: "upstream" | "downstream" | "both",
  depth?: number,
  resourceTypes?: Set<string>,
): DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes> {
  const base = graph.getGraph();
  const kept = new Set<string>();

  for (const nodeId of focusNodeIds) {
    kept.add(nodeId);
    if (direction === "upstream" || direction === "both") {
      for (const entry of graph.getUpstream(nodeId, depth)) {
        kept.add(entry.nodeId);
      }
    }
    if (direction === "downstream" || direction === "both") {
      for (const entry of graph.getDownstream(nodeId, depth)) {
        kept.add(entry.nodeId);
      }
    }
  }

  const out = new DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>();
  for (const nodeId of kept) {
    if (!base.hasNode(nodeId)) continue;
    const attributes = base.getNodeAttributes(nodeId);
    if (
      resourceTypes &&
      !resourceTypes.has(String(attributes.resource_type).toLowerCase())
    ) {
      continue;
    }
    out.addNode(nodeId, attributes);
  }

  base.forEachEdge((edgeId, attributes, source, target) => {
    if (out.hasNode(source) && out.hasNode(target) && !out.hasEdge(source, target)) {
      out.addEdgeWithKey(edgeId, source, target, attributes);
    }
  });

  return out;
}
