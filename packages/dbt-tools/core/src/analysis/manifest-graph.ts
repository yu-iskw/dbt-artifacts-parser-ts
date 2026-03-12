import { DirectedGraph } from "graphology";
import { hasCycle, topologicalSort } from "graphology-dag";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import type { ParsedManifest } from "dbt-artifacts-parser/manifest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import type { ParsedCatalog } from "dbt-artifacts-parser/catalog";
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
import { ColumnDependencyMap } from "./sql-analyzer";

/**
 * ManifestGraph builds and manages a directed graph from a dbt manifest.
 *
 * This class transforms dbt artifacts into a graphology graph, enabling
 * efficient graph operations like cycle detection, path finding, and traversal.
 */
export class ManifestGraph {
  private graph: DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>;
  private relationMap: Map<string, string> = new Map(); // relation_name -> unique_id

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

        if (nodeAny.relation_name) {
          this.relationMap.set(
            (nodeAny.relation_name as string).toLowerCase(),
            uniqueId,
          );
        }
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

        if (sourceAny.relation_name) {
          this.relationMap.set(
            (sourceAny.relation_name as string).toLowerCase(),
            uniqueId,
          );
        }
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
   * Get all upstream dependencies of a node using BFS.
   * @param nodeId - The node to find upstream dependencies for
   * @param maxDepth - Optional limit; 1 = immediate neighbors only, undefined = all levels
   * @returns Array of { nodeId, depth } where depth is the shortest distance from the node
   */
  getUpstream(
    nodeId: string,
    maxDepth?: number,
  ): Array<{ nodeId: string; depth: number }> {
    if (!this.graph.hasNode(nodeId)) {
      return [];
    }

    const result: Array<{ nodeId: string; depth: number }> = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [];

    for (const neighborId of this.graph.inboundNeighbors(nodeId)) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        result.push({ nodeId: neighborId, depth: 1 });
        if (maxDepth === undefined || 1 < maxDepth) {
          queue.push({ id: neighborId, depth: 1 });
        }
      }
    }

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      const nextDepth = depth + 1;
      for (const neighborId of this.graph.inboundNeighbors(id)) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          result.push({ nodeId: neighborId, depth: nextDepth });
          if (maxDepth === undefined || nextDepth < maxDepth) {
            queue.push({ id: neighborId, depth: nextDepth });
          }
        }
      }
    }

    return result;
  }

  /**
   * Get all downstream dependents of a node using BFS.
   * @param nodeId - The node to find downstream dependents for
   * @param maxDepth - Optional limit; 1 = immediate neighbors only, undefined = all levels
   * @returns Array of { nodeId, depth } where depth is the shortest distance from the node
   */
  getDownstream(
    nodeId: string,
    maxDepth?: number,
  ): Array<{ nodeId: string; depth: number }> {
    if (!this.graph.hasNode(nodeId)) {
      return [];
    }

    const result: Array<{ nodeId: string; depth: number }> = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [];

    for (const neighborId of this.graph.outboundNeighbors(nodeId)) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        result.push({ nodeId: neighborId, depth: 1 });
        if (maxDepth === undefined || 1 < maxDepth) {
          queue.push({ id: neighborId, depth: 1 });
        }
      }
    }

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      const nextDepth = depth + 1;
      for (const neighborId of this.graph.outboundNeighbors(id)) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          result.push({ nodeId: neighborId, depth: nextDepth });
          if (maxDepth === undefined || nextDepth < maxDepth) {
            queue.push({ id: neighborId, depth: nextDepth });
          }
        }
      }
    }

    return result;
  }

  /**
   * Get upstream dependencies with parent info for tree construction.
   * @returns Array of { nodeId, depth, parentId } where parentId is the BFS predecessor
   */
  getUpstreamWithParents(
    nodeId: string,
    maxDepth?: number,
  ): Array<{ nodeId: string; depth: number; parentId: string }> {
    if (!this.graph.hasNode(nodeId)) {
      return [];
    }

    const result: Array<{
      nodeId: string;
      depth: number;
      parentId: string;
    }> = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number; parentId: string }> = [];

    for (const neighborId of this.graph.inboundNeighbors(nodeId)) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        result.push({ nodeId: neighborId, depth: 1, parentId: nodeId });
        if (maxDepth === undefined || 1 < maxDepth) {
          queue.push({ id: neighborId, depth: 1, parentId: nodeId });
        }
      }
    }

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      const nextDepth = depth + 1;
      for (const neighborId of this.graph.inboundNeighbors(id)) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          result.push({ nodeId: neighborId, depth: nextDepth, parentId: id });
          if (maxDepth === undefined || nextDepth < maxDepth) {
            queue.push({ id: neighborId, depth: nextDepth, parentId: id });
          }
        }
      }
    }

    return result;
  }

  /**
   * Get upstream dependencies in build order (topological sort).
   * Sources and root models first, then models that depend on them.
   * @param nodeId - The node to find upstream dependencies for
   * @param maxDepth - Optional limit; 1 = immediate neighbors only, undefined = all levels
   * @returns Array of { nodeId, depth } in build order
   */
  getUpstreamBuildOrder(
    nodeId: string,
    maxDepth?: number,
  ): Array<{ nodeId: string; depth: number }> {
    const entries = this.getUpstream(nodeId, maxDepth);
    if (entries.length === 0) {
      return [];
    }

    const nodeIds = new Set(entries.map((e) => e.nodeId));
    const depthByNode = new Map(entries.map((e) => [e.nodeId, e.depth]));

    const subgraph = new DirectedGraph<
      GraphNodeAttributes,
      GraphEdgeAttributes
    >();
    for (const nid of nodeIds) {
      subgraph.addNode(nid, this.graph.getNodeAttributes(nid));
    }
    this.graph.forEachEdge((_edge, attr, source, target) => {
      if (nodeIds.has(source) && nodeIds.has(target)) {
        if (!subgraph.hasEdge(source, target)) {
          subgraph.addEdge(source, target, attr);
        }
      }
    });

    const orderedIds = topologicalSort(subgraph);
    return orderedIds.map((nid) => ({
      nodeId: nid,
      depth: depthByNode.get(nid) ?? 0,
    }));
  }

  /**
   * Get downstream dependents with parent info for tree construction.
   * @returns Array of { nodeId, depth, parentId } where parentId is the BFS predecessor
   */
  getDownstreamWithParents(
    nodeId: string,
    maxDepth?: number,
  ): Array<{ nodeId: string; depth: number; parentId: string }> {
    if (!this.graph.hasNode(nodeId)) {
      return [];
    }

    const result: Array<{
      nodeId: string;
      depth: number;
      parentId: string;
    }> = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number; parentId: string }> = [];

    for (const neighborId of this.graph.outboundNeighbors(nodeId)) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        result.push({ nodeId: neighborId, depth: 1, parentId: nodeId });
        if (maxDepth === undefined || 1 < maxDepth) {
          queue.push({ id: neighborId, depth: 1, parentId: nodeId });
        }
      }
    }

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      const nextDepth = depth + 1;
      for (const neighborId of this.graph.outboundNeighbors(id)) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          result.push({ nodeId: neighborId, depth: nextDepth, parentId: id });
          if (maxDepth === undefined || nextDepth < maxDepth) {
            queue.push({ id: neighborId, depth: nextDepth, parentId: id });
          }
        }
      }
    }

    return result;
  }

  /**
   * Add field nodes from catalog metadata
   */
  public addFieldNodes(catalog: ParsedCatalog): void {
    if (catalog.nodes) {
      for (const [uniqueId, node] of Object.entries(catalog.nodes)) {
        if (this.graph.hasNode(uniqueId)) {
          this.processCatalogColumns(uniqueId, (node as any).columns);
        }
      }
    }

    if (catalog.sources) {
      for (const [uniqueId, source] of Object.entries(catalog.sources)) {
        if (this.graph.hasNode(uniqueId)) {
          this.processCatalogColumns(uniqueId, (source as any).columns);
        }
      }
    }
  }

  private processCatalogColumns(
    parentUniqueId: string,
    columns: Record<string, any>,
  ): void {
    if (!columns) return;

    const parentNode = this.graph.getNodeAttributes(parentUniqueId);

    for (const [colName, colAttr] of Object.entries(columns)) {
      const fieldUniqueId = `${parentUniqueId}#${colName}`;

      // Add field node if it doesn't exist
      if (!this.graph.hasNode(fieldUniqueId)) {
        this.graph.addNode(fieldUniqueId, {
          unique_id: fieldUniqueId,
          resource_type: "field",
          name: colName,
          package_name: parentNode.package_name,
          parent_id: parentUniqueId,
          description: (colAttr as any).comment || (colAttr as any).description,
        });

        // Add internal edge from parent to field
        this.graph.addEdge(parentUniqueId, fieldUniqueId, {
          dependency_type: "internal",
        });
      }
    }
  }

  /**
   * Add field-to-field edges based on SQL analysis
   */
  public addFieldEdges(
    childNodeId: string,
    dependencies: ColumnDependencyMap,
  ): void {
    if (!this.graph.hasNode(childNodeId)) return;

    for (const [targetCol, sourceCols] of Object.entries(dependencies)) {
      const targetFieldId = `${childNodeId}#${targetCol}`;

      // Ensure target field node exists
      this.ensureFieldNode(childNodeId, targetCol);

      for (const source of sourceCols) {
        // Resolve source table name/relation name to unique ID
        const sourceNodeId = this.resolveRelationToUniqueId(source.sourceTable);
        if (!sourceNodeId) continue;

        const sourceFieldId = `${sourceNodeId}#${source.sourceColumn}`;
        this.ensureFieldNode(sourceNodeId, source.sourceColumn);

        // Add field edge from source field to target field
        if (!this.graph.hasEdge(sourceFieldId, targetFieldId)) {
          this.graph.addEdge(sourceFieldId, targetFieldId, {
            dependency_type: "field",
          });
        }
      }
    }
  }

  private ensureFieldNode(parentNodeId: string, colName: string): string {
    const fieldId = `${parentNodeId}#${colName}`;
    if (!this.graph.hasNode(fieldId)) {
      const parentAttr = this.graph.getNodeAttributes(parentNodeId);
      this.graph.addNode(fieldId, {
        unique_id: fieldId,
        resource_type: "field",
        name: colName,
        package_name: parentAttr.package_name,
        parent_id: parentNodeId,
      });
      // Add internal edge
      this.graph.addEdge(parentNodeId, fieldId, {
        dependency_type: "internal",
      });
    }
    return fieldId;
  }

  private resolveRelationToUniqueId(relationName: string): string | undefined {
    // Try exact match
    const normalized = relationName.toLowerCase();
    if (this.relationMap.has(normalized)) {
      return this.relationMap.get(normalized);
    }

    // Try stripping quotes if any
    const unquoted = normalized.replace(/["`]/g, "");
    if (this.relationMap.has(unquoted)) {
      return this.relationMap.get(unquoted);
    }

    // Try partial match if it's just the table name (alias)
    // We also strip quotes from the mapped relations for comparison
    for (const [rel, uid] of this.relationMap.entries()) {
      const relUnquoted = rel.replace(/["`]/g, "");
      if (relUnquoted.endsWith(`.${unquoted}`) || relUnquoted === unquoted) {
        return uid;
      }
    }

    return undefined;
  }
}
