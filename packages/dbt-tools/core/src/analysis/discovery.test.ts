import { describe, expect, it } from "vitest";
// @ts-expect-error workspace package path
import { parseManifest } from "dbt-artifacts-parser/manifest";
// @ts-expect-error workspace package path
import { loadTestManifest } from "dbt-artifacts-parser/test-utils";
import { ManifestGraph } from "./manifest-graph";
import { discoverResources } from "./discovery";

describe("discoverResources", () => {
  it("returns explainable matches for ambiguous query", () => {
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = discoverResources(graph, "orders", { limit: 5 });
    expect(result.query).toBe("orders");
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0]?.reasons.length).toBeGreaterThan(0);
    expect(result.matches[0]?.next_actions).toContain("explain");
  });

  it("supports typo-tolerant matches", () => {
    const manifestJson = loadTestManifest("v12", "manifest_1.10.json");
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    const graph = new ManifestGraph(manifest);

    const result = discoverResources(graph, "ordres", { limit: 5 });
    expect(result.matches.length).toBeGreaterThan(0);
  });
});

