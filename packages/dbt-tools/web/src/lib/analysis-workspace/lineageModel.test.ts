import { describe, it, expect } from "vitest";
import type { ResourceNode } from "@web/types";
import {
  STATUS_LENS_FILLS,
  TYPE_LENS_SOLID,
  TYPE_LENS_FILLS,
  buildLineageGraphModel,
  clampDepth,
  collectDependencyIdsByDepth,
  getLensNodeFill,
  getLensLegendItems,
} from "./lineageModel";
import type { DependencyIndex } from "./lineageModel";

function makeResource(overrides: Partial<ResourceNode> = {}): ResourceNode {
  return {
    uniqueId: overrides.uniqueId ?? "model.jaffle_shop.orders",
    name: overrides.name ?? "orders",
    resourceType: overrides.resourceType ?? "model",
    packageName: overrides.packageName ?? "jaffle_shop",
    path: overrides.path ?? "models/orders.sql",
    originalFilePath: overrides.originalFilePath ?? "models/orders.sql",
    description: overrides.description ?? null,
    status: overrides.status ?? "success",
    statusTone: overrides.statusTone ?? "positive",
    executionTime: overrides.executionTime ?? 1.2,
    threadId: overrides.threadId ?? "Thread-1",
    ...overrides,
  };
}

describe("clampDepth", () => {
  it("clamps below 0", () => expect(clampDepth(-1)).toBe(0));
  it("clamps above 10", () => expect(clampDepth(15)).toBe(10));
  it("passes through valid", () => expect(clampDepth(3)).toBe(3));
  it("passes through 0", () => expect(clampDepth(0)).toBe(0));
  it("passes through 10", () => expect(clampDepth(10)).toBe(10));
});

describe("collectDependencyIdsByDepth", () => {
  it("returns empty map for unknown id", () => {
    const index: DependencyIndex = {};
    const result = collectDependencyIdsByDepth(index, "unknown", 2, "upstream");
    expect(result.size).toBe(0);
  });

  it("collects direct upstream", () => {
    const index: DependencyIndex = {
      "model.p.b": {
        upstreamCount: 1,
        downstreamCount: 0,
        upstream: [
          { uniqueId: "model.p.a", name: "a", resourceType: "model", depth: 1 },
        ],
        downstream: [],
      },
    };
    const result = collectDependencyIdsByDepth(
      index,
      "model.p.b",
      1,
      "upstream",
    );
    expect([...result.keys()]).toContain("model.p.a");
    expect(result.get("model.p.a")).toBe(1);
  });
});

describe("buildLineageGraphModel", () => {
  it("attaches aggregated pass and fail counts to lineage nodes", () => {
    const resource = makeResource();
    const passTest = makeResource({
      uniqueId: "test.jaffle_shop.unique_orders",
      name: "unique_orders",
      resourceType: "test",
      path: "models/orders.yml",
      originalFilePath: "models/orders.yml",
      statusTone: "positive",
      status: "pass",
    });
    const failTest = makeResource({
      uniqueId: "test.jaffle_shop.not_null_orders",
      name: "not_null_orders",
      resourceType: "test",
      path: "models/orders.yml",
      originalFilePath: "models/orders.yml",
      statusTone: "danger",
      status: "error",
    });

    const dependencyIndex: DependencyIndex = {
      [resource.uniqueId]: {
        upstreamCount: 0,
        downstreamCount: 0,
        upstream: [],
        downstream: [],
      },
      [passTest.uniqueId]: {
        upstreamCount: 1,
        downstreamCount: 0,
        upstream: [
          {
            uniqueId: resource.uniqueId,
            name: resource.name,
            resourceType: resource.resourceType,
            depth: 1,
          },
        ],
        downstream: [],
      },
      [failTest.uniqueId]: {
        upstreamCount: 1,
        downstreamCount: 0,
        upstream: [
          {
            uniqueId: resource.uniqueId,
            name: resource.name,
            resourceType: resource.resourceType,
            depth: 1,
          },
        ],
        downstream: [],
      },
    };

    const model = buildLineageGraphModel({
      resource,
      dependencySummary: dependencyIndex[resource.uniqueId],
      dependencyIndex,
      resourceById: new Map([
        [resource.uniqueId, resource],
        [passTest.uniqueId, passTest],
        [failTest.uniqueId, failTest],
      ]),
      upstreamDepth: 2,
      downstreamDepth: 2,
      displayMode: "summary",
    });

    expect(model.nodeLayouts.get(resource.uniqueId)?.passCount).toBe(1);
    expect(model.nodeLayouts.get(resource.uniqueId)?.failCount).toBe(1);
  });
});

describe("getLensLegendItems", () => {
  it("uses the same fill tokens for type legend swatches as graph nodes", () => {
    const resource = makeResource();
    const model = buildLineageGraphModel({
      resource,
      dependencySummary: {
        upstreamCount: 0,
        downstreamCount: 0,
        upstream: [],
        downstream: [],
      },
      dependencyIndex: {},
      resourceById: new Map([[resource.uniqueId, resource]]),
      upstreamDepth: 2,
      downstreamDepth: 2,
      displayMode: "summary",
    });

    expect(getLensLegendItems("type", model.nodeLayouts)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "model",
          color: TYPE_LENS_FILLS.model,
          borderColor: TYPE_LENS_SOLID.model,
        }),
      ]),
    );
  });

  it("uses defined status fill tokens for status legend swatches", () => {
    const resource = makeResource({ statusTone: "warning", status: "warn" });
    const model = buildLineageGraphModel({
      resource,
      dependencySummary: {
        upstreamCount: 0,
        downstreamCount: 0,
        upstream: [],
        downstream: [],
      },
      dependencyIndex: {},
      resourceById: new Map([[resource.uniqueId, resource]]),
      upstreamDepth: 2,
      downstreamDepth: 2,
      displayMode: "summary",
    });

    expect(getLensLegendItems("status", model.nodeLayouts)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "warning",
          color: STATUS_LENS_FILLS.warning,
        }),
      ]),
    );
  });

  it("uses defined token strings for coverage legend swatches", () => {
    const resource = makeResource({ description: "Has docs" });
    const model = buildLineageGraphModel({
      resource,
      dependencySummary: {
        upstreamCount: 0,
        downstreamCount: 0,
        upstream: [],
        downstream: [],
      },
      dependencyIndex: {},
      resourceById: new Map([[resource.uniqueId, resource]]),
      upstreamDepth: 2,
      downstreamDepth: 2,
      displayMode: "summary",
    });

    expect(getLensLegendItems("coverage", model.nodeLayouts)).toEqual([
      {
        key: "documented",
        label: "Documented",
        color: "var(--bg-success-soft)",
      },
      {
        key: "undocumented",
        label: "No description",
        color: "var(--bg-danger-soft)",
      },
    ]);
  });
});

describe("getLensNodeFill", () => {
  it("uses resource-type tokens for type lens", () => {
    const resource = makeResource({ resourceType: "semantic_model" });
    expect(getLensNodeFill(resource, "type")).toBe(
      TYPE_LENS_FILLS.semantic_model,
    );
  });

  it("uses semantic status tokens for status and coverage lenses", () => {
    const warning = makeResource({ statusTone: "warning", status: "warn" });
    const documented = makeResource({ description: "Has docs" });
    const undocumented = makeResource({ description: null });

    expect(getLensNodeFill(warning, "status")).toBe(STATUS_LENS_FILLS.warning);
    expect(getLensNodeFill(documented, "coverage")).toBe(
      "var(--bg-success-soft)",
    );
    expect(getLensNodeFill(undocumented, "coverage")).toBe(
      "var(--bg-danger-soft)",
    );
  });
});
