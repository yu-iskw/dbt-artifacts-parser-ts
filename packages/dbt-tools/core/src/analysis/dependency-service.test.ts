import { describe, it, expect, beforeEach } from "vitest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseManifest } from "dbt-artifacts-parser/manifest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { loadTestManifest } from "dbt-artifacts-parser/test-utils";
import { ManifestGraph } from "./manifest-graph";
import { DependencyService } from "./dependency-service";

describe("DependencyService", () => {
  let graph: ManifestGraph;

  beforeEach(() => {
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    graph = new ManifestGraph(manifest);
  });

  describe("getDependencies", () => {
    it("should get downstream dependencies", () => {
      const graphologyGraph = graph.getGraph();
      let testNodeId: string | null = null;

      // Find a node that has downstream dependents
      graphologyGraph.forEachNode((nodeId) => {
        const outbound = graphologyGraph.outboundNeighbors(nodeId);
        if (outbound.length > 0 && !testNodeId) {
          testNodeId = nodeId;
        }
      });

      if (testNodeId) {
        const result = DependencyService.getDependencies(
          graph,
          testNodeId,
          "downstream",
        );
        expect(result.resource_id).toBe(testNodeId);
        expect(result.direction).toBe("downstream");
        expect(result.dependencies).toBeInstanceOf(Array);
        expect(result.count).toBeGreaterThan(0);
        expect(result.dependencies.length).toBe(result.count);
      }
    });

    it("should get upstream dependencies", () => {
      const graphologyGraph = graph.getGraph();
      let testNodeId: string | null = null;

      // Find a node that has upstream dependencies
      graphologyGraph.forEachNode((nodeId) => {
        const inbound = graphologyGraph.inboundNeighbors(nodeId);
        if (inbound.length > 0 && !testNodeId) {
          testNodeId = nodeId;
        }
      });

      if (testNodeId) {
        const result = DependencyService.getDependencies(
          graph,
          testNodeId,
          "upstream",
        );
        expect(result.resource_id).toBe(testNodeId);
        expect(result.direction).toBe("upstream");
        expect(result.dependencies).toBeInstanceOf(Array);
        expect(result.count).toBeGreaterThan(0);
      }
    });

    it("should return empty list for non-existent resource", () => {
      const result = DependencyService.getDependencies(
        graph,
        "non.existent.resource",
        "downstream",
      );
      expect(result.resource_id).toBe("non.existent.resource");
      expect(result.dependencies).toEqual([]);
      expect(result.count).toBe(0);
    });

    it("should filter fields when specified", () => {
      const graphologyGraph = graph.getGraph();
      let testNodeId: string | null = null;

      graphologyGraph.forEachNode((nodeId) => {
        const outbound = graphologyGraph.outboundNeighbors(nodeId);
        if (outbound.length > 0 && !testNodeId) {
          testNodeId = nodeId;
        }
      });

      if (testNodeId) {
        const result = DependencyService.getDependencies(
          graph,
          testNodeId,
          "downstream",
          "unique_id,name",
        );
        expect(result.dependencies.length).toBeGreaterThan(0);
        const firstDep = result.dependencies[0];
        expect(firstDep).toHaveProperty("unique_id");
        expect(firstDep).toHaveProperty("name");
        // Should not have other fields (or they should be minimal)
        const keys = Object.keys(firstDep);
        expect(keys.length).toBeLessThanOrEqual(4); // unique_id, name, resource_type, package_name (minimal)
      }
    });

    it("should include all required fields in dependencies", () => {
      const graphologyGraph = graph.getGraph();
      let testNodeId: string | null = null;

      graphologyGraph.forEachNode((nodeId) => {
        const outbound = graphologyGraph.outboundNeighbors(nodeId);
        if (outbound.length > 0 && !testNodeId) {
          testNodeId = nodeId;
        }
      });

      if (testNodeId) {
        const result = DependencyService.getDependencies(
          graph,
          testNodeId,
          "downstream",
        );
        expect(result.dependencies.length).toBeGreaterThan(0);
        const firstDep = result.dependencies[0];
        expect(firstDep).toHaveProperty("unique_id");
        expect(firstDep).toHaveProperty("resource_type");
        expect(firstDep).toHaveProperty("name");
        expect(firstDep).toHaveProperty("package_name");
      }
    });
  });
});
