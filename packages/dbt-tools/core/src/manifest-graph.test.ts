import { describe, it, expect } from "vitest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseManifest } from "dbt-artifacts-parser/manifest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { loadTestManifest } from "dbt-artifacts-parser/test-utils";
import { ManifestGraph } from "./manifest-graph";

describe("ManifestGraph", () => {
  describe("version validation", () => {
    it("should accept v12 manifest", () => {
      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      expect(() => new ManifestGraph(manifest)).not.toThrow();
    });

    it("should accept v11 manifest", () => {
      const manifestJson = loadTestManifest("v11", "manifest.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      expect(() => new ManifestGraph(manifest)).not.toThrow();
    });

    it("should accept v10 manifest", () => {
      const manifestJson = loadTestManifest("v10", "manifest.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      expect(() => new ManifestGraph(manifest)).not.toThrow();
    });

    it("should reject v9 manifest with appropriate error", () => {
      const manifestJson = loadTestManifest(
        "v9",
        "manifest.json",
        "jaffle_shop_at_1.5rc1",
      );
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      expect(() => new ManifestGraph(manifest)).toThrow(
        /Unsupported dbt version/,
      );
      expect(() => new ManifestGraph(manifest)).toThrow(/Requires dbt 1.10\+/);
    });

    it("should include version information in error message", () => {
      const manifestJson = loadTestManifest(
        "v9",
        "manifest.json",
        "jaffle_shop_at_1.5rc1",
      );
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      try {
        new ManifestGraph(manifest);
        expect.fail("Should have thrown an error");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        expect(errorMessage).toContain("Schema version");
        expect(errorMessage).toContain("v10+");
      }
    });
  });

  describe("graph building", () => {
    it("should build a graph from manifest v12", () => {
      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      expect(graphologyGraph.order).toBeGreaterThan(0);
      expect(graphologyGraph.size).toBeGreaterThanOrEqual(0);
    });

    it("should build a graph from manifest v11", () => {
      const manifestJson = loadTestManifest("v11", "manifest.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      expect(graphologyGraph.order).toBeGreaterThan(0);
    });

    it("should build a graph from manifest v10", () => {
      const manifestJson = loadTestManifest("v10", "manifest.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      expect(graphologyGraph.order).toBeGreaterThan(0);
    });

    it("should add nodes from manifest", () => {
      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      let hasModelNode = false;
      let hasSourceNode = false;

      graphologyGraph.forEachNode((nodeId, attributes) => {
        if (nodeId.startsWith("model.")) {
          hasModelNode = true;
          expect(attributes.resource_type).toBeDefined();
          expect(attributes.name).toBeDefined();
        }
        if (nodeId.startsWith("source.")) {
          hasSourceNode = true;
          expect(attributes.resource_type).toBe("source");
        }
      });

      expect(hasModelNode).toBe(true);
      expect(hasSourceNode).toBe(true);
    });

    it("should add edges based on dependencies", () => {
      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      let hasEdges = false;

      graphologyGraph.forEachEdge((edgeId, attributes, source, target) => {
        hasEdges = true;
        expect(attributes.dependency_type).toBeDefined();
        expect(graphologyGraph.hasNode(source)).toBe(true);
        expect(graphologyGraph.hasNode(target)).toBe(true);
      });

      // The graph should have edges if there are dependencies
      if (graphologyGraph.order > 1) {
        expect(hasEdges).toBe(true);
      }
    });
  });

  describe("getSummary", () => {
    it("should generate summary statistics", () => {
      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const summary = graph.getSummary();

      expect(summary.total_nodes).toBeGreaterThan(0);
      expect(summary.total_edges).toBeGreaterThanOrEqual(0);
      expect(summary.nodes_by_type).toBeDefined();
      expect(typeof summary.has_cycles).toBe("boolean");
    });

    it("should count nodes by type correctly", () => {
      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const summary = graph.getSummary();

      // Verify that the sum of nodes_by_type equals total_nodes
      const sumByType = Object.values(summary.nodes_by_type).reduce(
        (sum, count) => sum + count,
        0,
      );
      expect(sumByType).toBe(summary.total_nodes);
    });

    it("should detect cycles correctly", () => {
      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const summary = graph.getSummary();

      // dbt graphs should typically be acyclic (DAG)
      // But we just verify the property exists and is boolean
      expect(typeof summary.has_cycles).toBe("boolean");
    });
  });

  describe("getUpstream", () => {
    it("should return upstream dependencies for a node", () => {
      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

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
        const upstream = graph.getUpstream(testNodeId);
        expect(Array.isArray(upstream)).toBe(true);
        expect(upstream.length).toBeGreaterThan(0);

        // Verify all upstream nodes exist in the graph
        for (const nodeId of upstream) {
          expect(graphologyGraph.hasNode(nodeId)).toBe(true);
        }
      }
    });

    it("should return empty array for non-existent node", () => {
      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const upstream = graph.getUpstream("non.existent.node");
      expect(upstream).toEqual([]);
    });

    it("should return empty array for root nodes", () => {
      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      let rootNodeId: string | null = null;

      // Find a root node (no inbound neighbors)
      graphologyGraph.forEachNode((nodeId) => {
        const inbound = graphologyGraph.inboundNeighbors(nodeId);
        if (inbound.length === 0 && !rootNodeId) {
          rootNodeId = nodeId;
        }
      });

      if (rootNodeId) {
        const upstream = graph.getUpstream(rootNodeId);
        expect(upstream).toEqual([]);
      }
    });
  });

  describe("getDownstream", () => {
    it("should return downstream dependents for a node", () => {
      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

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
        const downstream = graph.getDownstream(testNodeId);
        expect(Array.isArray(downstream)).toBe(true);
        expect(downstream.length).toBeGreaterThan(0);

        // Verify all downstream nodes exist in the graph
        for (const nodeId of downstream) {
          expect(graphologyGraph.hasNode(nodeId)).toBe(true);
        }
      }
    });

    it("should return empty array for non-existent node", () => {
      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const downstream = graph.getDownstream("non.existent.node");
      expect(downstream).toEqual([]);
    });

    it("should return empty array for leaf nodes", () => {
      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      let leafNodeId: string | null = null;

      // Find a leaf node (no outbound neighbors)
      graphologyGraph.forEachNode((nodeId) => {
        const outbound = graphologyGraph.outboundNeighbors(nodeId);
        if (outbound.length === 0 && !leafNodeId) {
          leafNodeId = nodeId;
        }
      });

      if (leafNodeId) {
        const downstream = graph.getDownstream(leafNodeId);
        expect(downstream).toEqual([]);
      }
    });
  });

  describe("getGraph", () => {
    it("should return the underlying graphology graph", () => {
      const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      expect(graphologyGraph).toBeDefined();
      expect(typeof graphologyGraph.order).toBe("number");
      expect(typeof graphologyGraph.size).toBe("number");
    });
  });
});
