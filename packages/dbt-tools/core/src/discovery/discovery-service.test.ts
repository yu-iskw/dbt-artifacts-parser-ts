import { describe, it, expect, beforeAll } from "vitest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseManifest } from "dbt-artifacts-parser/manifest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { loadTestManifest } from "dbt-artifacts-parser/test-utils";
import { ManifestGraph } from "../analysis/manifest-graph";
import { DiscoveryService } from "./discovery-service";

describe("DiscoveryService", () => {
  let graph: ManifestGraph;

  beforeAll(() => {
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    graph = new ManifestGraph(manifest);
  });

  // 1. Exact name match
  it("returns exact name match with high confidence", () => {
    const result = DiscoveryService.query(graph, "orders");
    expect(result.query).toBe("orders");
    expect(result.matches.length).toBeGreaterThan(0);
    const top = result.matches[0];
    expect(top.unique_id).toBe("model.jaffle_shop.orders");
    expect(top.confidence).toBe("high");
    expect(top.reasons).toContain("exact_name_match");
    expect(top.score).toBe(100);
  });

  // 2. Prefix match
  it("matches nodes whose names start with the query term", () => {
    const result = DiscoveryService.query(graph, "stg_ord");
    expect(result.matches.length).toBeGreaterThan(0);
    const top = result.matches[0];
    expect(top.display_name).toMatch(/^stg_ord/);
    expect(top.reasons).toContain("name_prefix_match");
  });

  // 3. Fuzzy match (typo tolerance)
  it("matches via fuzzy scoring when query has a small typo", () => {
    // "ordes" is 1 edit away from "orders"
    const result = DiscoveryService.query(graph, "ordes");
    expect(result.matches.length).toBeGreaterThan(0);
    const top = result.matches[0];
    expect(top.unique_id).toBe("model.jaffle_shop.orders");
    expect(top.reasons).toContain("fuzzy_name_match");
  });

  // 4. Type filter
  it("filters results to the requested resource type", () => {
    const result = DiscoveryService.query(graph, "orders", { type: "model" });
    for (const match of result.matches) {
      expect(match.resource_type).toBe("model");
    }
  });

  // 5. No match
  it("returns empty matches for an unrecognisable query", () => {
    const result = DiscoveryService.query(graph, "zzznomatch_xyzzy_12345");
    expect(result.total).toBe(0);
    expect(result.matches).toHaveLength(0);
  });

  // 6. Disambiguation
  it("populates disambiguation when multiple candidates score closely", () => {
    // "stg_" prefix will match many staging models at similar scores
    const result = DiscoveryService.query(graph, "stg_");
    expect(result.matches.length).toBeGreaterThan(0);
    const top = result.matches[0];
    // If there are close competitors their scores are within 20 pts of top
    if (top.disambiguation.length > 0) {
      for (const d of top.disambiguation) {
        expect(top.score - d.score).toBeLessThanOrEqual(20);
      }
    }
    // Also sanity-check disambiguation entries do not have nested disambiguation
    for (const d of top.disambiguation) {
      expect(d).not.toHaveProperty("disambiguation");
    }
  });

  // 7. Related resources populated
  it("includes depth-1 upstream and downstream in related", () => {
    const result = DiscoveryService.query(graph, "orders", { type: "model" });
    expect(result.matches.length).toBeGreaterThan(0);
    const top = result.matches[0];
    expect(top.related.length).toBeGreaterThan(0);
    const relations = top.related.map((r) => r.relation);
    expect(relations).toEqual(
      expect.arrayContaining(["upstream", "downstream"]),
    );
  });

  // 8. Next actions for a model
  it("includes correct next_actions for a model result", () => {
    const result = DiscoveryService.query(graph, "orders", { type: "model" });
    expect(result.matches.length).toBeGreaterThan(0);
    const top = result.matches[0];
    expect(top.next_actions).toEqual(["explain", "impact", "diagnose"]);
  });

  // 9. Centrality bonus — hub node scores higher than leaf for the same term
  it("applies centrality bonus to highly-connected nodes", () => {
    // Find the node with highest degree in the graph
    const g = graph.getGraph();
    let hubId = "";
    let maxDegree = 0;
    g.forEachNode((nodeId, attrs) => {
      if (attrs.resource_type === "field") return;
      const d =
        g.inboundNeighbors(nodeId).length + g.outboundNeighbors(nodeId).length;
      if (d > maxDegree) {
        maxDegree = d;
        hubId = nodeId;
      }
    });
    if (maxDegree > 10 && hubId) {
      const hubAttrs = g.getNodeAttributes(hubId);
      const result = DiscoveryService.query(graph, hubAttrs.name);
      const topMatch = result.matches.find((m) => m.unique_id === hubId);
      if (topMatch) {
        expect(
          topMatch.reasons.some((r) =>
            r.includes("centrality"),
          ),
        ).toBe(true);
      }
    }
  });

  // 10. Inline token parsing — type:model qualifier narrows results
  it("parses inline type: token from query string", () => {
    const withToken = DiscoveryService.query(graph, "type:model orders");
    const withOption = DiscoveryService.query(graph, "orders", { type: "model" });
    // Both approaches should produce the same top result
    expect(withToken.matches[0]?.unique_id).toBe(
      withOption.matches[0]?.unique_id,
    );
    for (const match of withToken.matches) {
      expect(match.resource_type).toBe("model");
    }
  });

  // Structural: DiscoveryOutput shape
  it("output matches the DiscoveryOutput schema", () => {
    const result = DiscoveryService.query(graph, "customers");
    expect(result).toHaveProperty("query");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("matches");
    expect(typeof result.total).toBe("number");
    if (result.matches.length > 0) {
      const m = result.matches[0];
      expect(m).toHaveProperty("resource_type");
      expect(m).toHaveProperty("unique_id");
      expect(m).toHaveProperty("display_name");
      expect(m).toHaveProperty("score");
      expect(m).toHaveProperty("confidence");
      expect(m).toHaveProperty("reasons");
      expect(m).toHaveProperty("disambiguation");
      expect(m).toHaveProperty("related");
      expect(m).toHaveProperty("next_actions");
      expect(typeof m.score).toBe("number");
      expect(m.score).toBeGreaterThanOrEqual(0);
      expect(m.score).toBeLessThanOrEqual(100);
    }
  });

  // Limit option
  it("respects the limit option", () => {
    const result = DiscoveryService.query(graph, "stg_", { limit: 3 });
    expect(result.matches.length).toBeLessThanOrEqual(3);
  });
});
