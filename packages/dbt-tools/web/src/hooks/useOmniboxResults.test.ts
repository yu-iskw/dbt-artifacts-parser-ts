import { describe, expect, it } from "vitest";
import type { AnalysisState, ResourceNode } from "@web/types";
import { computeOmniboxResults } from "./useOmniboxResults";

function analysisWithResources(resources: ResourceNode[]): AnalysisState {
  return {
    resources,
    summary: {
      total_nodes: 0,
      total_edges: 0,
      status_counts: {},
      type_counts: {},
    },
    bundles: [],
    graph: { nodes: [], edges: [] },
  } as unknown as AnalysisState;
}

describe("computeOmniboxResults", () => {
  it("returns recent resources when query is empty", () => {
    const resources = [
      {
        uniqueId: "m.a",
        name: "a",
        resourceType: "model",
        packageName: "pkg",
        path: "models/a.sql",
      },
    ] as ResourceNode[];
    const analysis = analysisWithResources(resources);
    const out = computeOmniboxResults(analysis, {
      query: "",
      recentResourceIds: ["m.a"],
      isOpen: true,
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.uniqueId).toBe("m.a");
  });

  it("filters by query when non-empty", () => {
    const resources = [
      {
        uniqueId: "m.x",
        name: "alpha",
        resourceType: "model",
        packageName: "pkg",
        path: "models/x.sql",
      },
      {
        uniqueId: "m.y",
        name: "beta",
        resourceType: "test",
        packageName: "pkg",
        path: "tests/y.sql",
      },
    ] as ResourceNode[];
    const analysis = analysisWithResources(resources);
    const out = computeOmniboxResults(analysis, {
      query: "beta",
      recentResourceIds: [],
      isOpen: true,
    });
    expect(out.map((r) => r.uniqueId)).toEqual(["m.y"]);
  });

  it("returns empty when analysis is null", () => {
    expect(
      computeOmniboxResults(null, {
        query: "",
        recentResourceIds: [],
        isOpen: false,
      }),
    ).toEqual([]);
  });
});
