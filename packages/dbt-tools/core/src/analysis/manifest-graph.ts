import { DirectedGraph } from "graphology";
import { hasCycle } from "graphology-dag";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import type { ParsedManifest } from "dbt-artifacts-parser/manifest";
import type {
  GraphNodeAttributes,
  GraphEdgeAttributes,
  GraphSummary,
  DbtResourceType,
} from "../types";
import {
  isSupportedVersion,
  getVersionInfo,
  MIN_SUPPORTED_SCHEMA_VERSION,
} from "../version";

/**
 * ManifestGraph builds and manages a directed graph from a dbt manifest.
 *
 * This class transforms dbt artifacts into a graphology graph, enabling
 * efficient graph operations like cycle detection, path finding, and traversal.
 */
export class ManifestGraph {
  private graph: DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>;

  constructor(manifest: ParsedManifest) {
    if (!isSupportedVersion(manifest)) {
      const versionInfo = getVersionInfo(manifest);
      throw new Error(
        `Unsupported dbt version. ` +
          `Schema version: ${versionInfo.schema_version || "unknown"}, ` +
          `dbt version: ${versionInfo.dbt_version || "unknown"}. ` +
          `Requires dbt 1.10+ (manifest schema v${MIN_SUPPORTED_SCHEMA_VERSION}+)`,
      );
    }
    this.graph = new DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>();
    this.buildGraph(manifest);
  }

  /**
   * Build the graph from manifest data
   */
  private buildGraph(manifest: ParsedManifest): void {
    // Add all nodes from manifest
    this.addNodes(manifest);

    // Add edges based on dependencies
    this.addEdges(manifest);
  }

  /**
   * Add nodes from manifest to the graph
   */
  private addNodes(manifest: ParsedManifest): void {
    // Add nodes
    if (manifest.nodes) {
      for (const [uniqueId, node] of Object.entries(manifest.nodes)) {
        const nodeAny = node as Record<string, unknown>;
        const resourceType = this.extractResourceType(
          (nodeAny.resource_type as string) || "model",
        );
        this.graph.addNode(uniqueId, {
          unique_id: uniqueId,
          resource_type: resourceType,
          name: (nodeAny.name as string) || uniqueId,
          package_name: (nodeAny.package_name as string) || "",
          path: (nodeAny.path as string) || undefined,
          original_file_path:
            (nodeAny.original_file_path as string) || undefined,
          tags: (nodeAny.tags as string[]) || undefined,
          description: (nodeAny.description as string) || undefined,
        });
      }
    }

    // Add sources
    if (manifest.sources) {
      for (const [uniqueId, source] of Object.entries(manifest.sources)) {
        const sourceAny = source as Record<string, unknown>;
        this.graph.addNode(uniqueId, {
          unique_id: uniqueId,
          resource_type: "source",
          name: (sourceAny.name as string) || uniqueId,
          package_name: (sourceAny.package_name as string) || "",
          path: (sourceAny.path as string) || undefined,
          original_file_path:
            (sourceAny.original_file_path as string) || undefined,
          tags: (sourceAny.tags as string[]) || undefined,
          description: (sourceAny.description as string) || undefined,
        });
      }
    }

    // Add macros (as nodes for dependency tracking)
    if (manifest.macros) {
      for (const [uniqueId, macro] of Object.entries(manifest.macros)) {
        const macroAny = macro as Record<string, unknown>;
        this.graph.addNode(uniqueId, {
          unique_id: uniqueId,
          resource_type: "macro",
          name: (macroAny.name as string) || uniqueId,
          package_name: (macroAny.package_name as string) || "",
          path: (macroAny.path as string) || undefined,
          original_file_path:
            (macroAny.original_file_path as string) || undefined,
        });
      }
    }

    // Add exposures
    if (manifest.exposures) {
      for (const [uniqueId, exposure] of Object.entries(manifest.exposures)) {
        const exposureAny = exposure as Record<string, unknown>;
        this.graph.addNode(uniqueId, {
          unique_id: uniqueId,
          resource_type: "exposure",
          name: (exposureAny.name as string) || uniqueId,
          package_name: (exposureAny.package_name as string) || "",
          tags: (exposureAny.tags as string[]) || undefined,
          description: (exposureAny.description as string) || undefined,
        });
      }
    }

    // Add metrics
    if (manifest.metrics) {
      for (const [uniqueId, metric] of Object.entries(manifest.metrics)) {
        const metricAny = metric as Record<string, unknown>;
        const tagsValue = metricAny.tags;
        const tags = Array.isArray(tagsValue)
          ? (tagsValue as string[])
          : typeof tagsValue === "string"
            ? [tagsValue]
            : undefined;
        this.graph.addNode(uniqueId, {
          unique_id: uniqueId,
          resource_type: "metric",
          name: (metricAny.name as string) || uniqueId,
          package_name: (metricAny.package_name as string) || "",
          tags,
        });
      }
    }

    // Add semantic models
    if (manifest.semantic_models) {
      for (const [uniqueId, semanticModel] of Object.entries(
        manifest.semantic_models,
      )) {
        const semanticModelAny = semanticModel as Record<string, unknown>;
        this.graph.addNode(uniqueId, {
          unique_id: uniqueId,
          resource_type: "semantic_model",
          name: (semanticModelAny.name as string) || uniqueId,
          package_name: (semanticModelAny.package_name as string) || "",
        });
      }
    }

    // Add unit tests
    if (manifest.unit_tests) {
      for (const [uniqueId, unitTest] of Object.entries(manifest.unit_tests)) {
        const unitTestAny = unitTest as Record<string, unknown>;
        this.graph.addNode(uniqueId, {
          unique_id: uniqueId,
          resource_type: "unit_test",
          name: (unitTestAny.name as string) || uniqueId,
          package_name: (unitTestAny.package_name as string) || "",
        });
      }
    }
  }

  /**
   * Add edges based on dependencies
   */
  private addEdges(manifest: ParsedManifest): void {
    // Use parent_map if available (more efficient)
    if (manifest.parent_map) {
      for (const [childId, parentIds] of Object.entries(manifest.parent_map)) {
        // Only add edges if both nodes exist
        if (this.graph.hasNode(childId)) {
          const parentIdsArray = parentIds as string[];
          for (const parentId of parentIdsArray) {
            if (this.graph.hasNode(parentId)) {
              // Avoid duplicate edges
              if (!this.graph.hasEdge(parentId, childId)) {
                this.graph.addEdge(parentId, childId, {
                  dependency_type: this.inferDependencyType(parentId),
                });
              }
            }
          }
        }
      }
      return;
    }

    // Fallback: iterate through nodes and use depends_on
    if (manifest.nodes) {
      for (const [uniqueId, node] of Object.entries(manifest.nodes)) {
        const nodeAny = node as Record<string, unknown>;
        if (nodeAny.depends_on) {
          const dependsOn = nodeAny.depends_on as {
            nodes?: string[];
            macros?: string[];
          };

          // Add edges for node dependencies
          if (dependsOn.nodes) {
            for (const depNodeId of dependsOn.nodes) {
              if (this.graph.hasNode(depNodeId)) {
                if (!this.graph.hasEdge(depNodeId, uniqueId)) {
                  this.graph.addEdge(depNodeId, uniqueId, {
                    dependency_type: "node",
                  });
                }
              }
            }
          }

          // Add edges for macro dependencies (optional, macros are usually not in graph)
          if (dependsOn.macros) {
            for (const macroId of dependsOn.macros) {
              if (this.graph.hasNode(macroId)) {
                if (!this.graph.hasEdge(macroId, uniqueId)) {
                  this.graph.addEdge(macroId, uniqueId, {
                    dependency_type: "macro",
                  });
                }
              }
            }
          }
        }
      }
    }

    // Handle exposures dependencies
    if (manifest.exposures) {
      for (const [uniqueId, exposure] of Object.entries(manifest.exposures)) {
        const exposureAny = exposure as Record<string, unknown>;
        if (exposureAny.depends_on) {
          const dependsOn = exposureAny.depends_on as {
            nodes?: string[];
            macros?: string[];
          };
          if (dependsOn.nodes) {
            for (const depNodeId of dependsOn.nodes) {
              if (this.graph.hasNode(depNodeId)) {
                if (!this.graph.hasEdge(depNodeId, uniqueId)) {
                  this.graph.addEdge(depNodeId, uniqueId, {
                    dependency_type: "node",
                  });
                }
              }
            }
          }
        }
      }
    }

    // Handle metrics dependencies
    if (manifest.metrics) {
      for (const [uniqueId, metric] of Object.entries(manifest.metrics)) {
        const metricAny = metric as Record<string, unknown>;
        if (metricAny.depends_on) {
          const dependsOn = metricAny.depends_on as {
            nodes?: string[];
            macros?: string[];
          };
          if (dependsOn.nodes) {
            for (const depNodeId of dependsOn.nodes) {
              if (this.graph.hasNode(depNodeId)) {
                if (!this.graph.hasEdge(depNodeId, uniqueId)) {
                  this.graph.addEdge(depNodeId, uniqueId, {
                    dependency_type: "node",
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Extract resource type from manifest node
   */
  private extractResourceType(resourceType: string): DbtResourceType {
    const normalized = resourceType.toLowerCase();
    if (
      [
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
        "function",
      ].includes(normalized)
    ) {
      return normalized as DbtResourceType;
    }
    return "model"; // Default fallback
  }

  /**
   * Infer dependency type from node ID
   */
  private inferDependencyType(nodeId: string): "node" | "macro" | "source" {
    if (nodeId.startsWith("macro.")) {
      return "macro";
    }
    if (nodeId.startsWith("source.")) {
      return "source";
    }
    return "node";
  }

  /**
   * Get the underlying graphology graph
   */
  getGraph(): DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes> {
    return this.graph;
  }

  /**
   * Get summary statistics about the graph
   */
  getSummary(): GraphSummary {
    const nodesByType: Record<string, number> = {};
    let totalNodes = 0;

    // Count nodes by type
    this.graph.forEachNode((nodeId, attributes) => {
      totalNodes++;
      const type = attributes.resource_type || "unknown";
      nodesByType[type] = (nodesByType[type] || 0) + 1;
    });

    // Detect cycles using graphology-dag
    const hasCycles = hasCycle(this.graph);

    return {
      total_nodes: totalNodes,
      nodes_by_type: nodesByType,
      total_edges: this.graph.size,
      has_cycles: hasCycles,
    };
  }

  /**
   * Get all upstream dependencies of a node
   */
  getUpstream(nodeId: string): string[] {
    if (!this.graph.hasNode(nodeId)) {
      return [];
    }

    const upstream: string[] = [];
    const visited = new Set<string>();

    const traverse = (currentId: string) => {
      if (visited.has(currentId)) {
        return;
      }
      visited.add(currentId);

      this.graph.inboundNeighbors(currentId).forEach((neighborId) => {
        if (!upstream.includes(neighborId)) {
          upstream.push(neighborId);
        }
        traverse(neighborId);
      });
    };

    traverse(nodeId);
    return upstream;
  }

  /**
   * Get all downstream dependents of a node
   */
  getDownstream(nodeId: string): string[] {
    if (!this.graph.hasNode(nodeId)) {
      return [];
    }

    const downstream: string[] = [];
    const visited = new Set<string>();

    const traverse = (currentId: string) => {
      if (visited.has(currentId)) {
        return;
      }
      visited.add(currentId);

      this.graph.outboundNeighbors(currentId).forEach((neighborId) => {
        if (!downstream.includes(neighborId)) {
          downstream.push(neighborId);
        }
        traverse(neighborId);
      });
    };

    traverse(nodeId);
    return downstream;
  }
}
