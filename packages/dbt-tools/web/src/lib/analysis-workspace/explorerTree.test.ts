import { describe, it, expect } from "vitest";
import {
  buildExplorerTree,
  collectAncestorBranchIdsForResource,
  flattenExplorerTree,
  findNodeByLeafResourceId,
  collectLeafIds,
  type ExplorerTreeRow,
} from "./explorerTree";
import type { ResourceNode } from "@web/types";

function makeResource(overrides: Partial<ResourceNode> = {}): ResourceNode {
  return {
    uniqueId: `model.jaffle_shop.${overrides.name ?? "r"}`,
    name: overrides.name ?? "r",
    resourceType: "model",
    packageName: "jaffle_shop",
    fqn: ["jaffle_shop", overrides.name ?? "r"],
    originalFilePath: `models/${overrides.name ?? "r"}.sql`,
    description: "",
    dependsOn: [],
    database: "dev",
    schema: "dbt",
    ...overrides,
  } as ResourceNode;
}

describe("buildExplorerTree", () => {
  it("returns empty array for no resources", () => {
    const tree = buildExplorerTree([], "project", "jaffle_shop");
    expect(tree).toHaveLength(0);
  });

  it("groups resources under package branch", () => {
    const resources = [
      makeResource({ name: "orders" }),
      makeResource({ name: "customers" }),
    ];
    const tree = buildExplorerTree(resources, "project", "jaffle_shop");
    expect(tree.length).toBeGreaterThan(0);
    const leafIds = collectLeafIds(tree);
    expect(leafIds).toContain("model.jaffle_shop.orders");
    expect(leafIds).toContain("model.jaffle_shop.customers");
  });
});

describe("flattenExplorerTree", () => {
  it("returns no rows for empty tree", () => {
    expect(flattenExplorerTree([], new Set())).toHaveLength(0);
  });

  it("collapsed branches hide children", () => {
    const resources = [makeResource({ name: "orders" })];
    const tree = buildExplorerTree(resources, "project", "jaffle_shop");
    // nothing expanded → only root branch visible
    const rows = flattenExplorerTree(tree, new Set());
    const leafRows = rows.filter(
      (r: ExplorerTreeRow) => r.node.resource != null,
    );
    expect(leafRows).toHaveLength(0);
  });
});

describe("findNodeByLeafResourceId", () => {
  it("returns null for empty tree", () => {
    expect(findNodeByLeafResourceId([], "model.x.y")).toBeNull();
  });

  it("finds existing resource", () => {
    const resources = [makeResource({ name: "orders" })];
    const tree = buildExplorerTree(resources, "project", "jaffle_shop");
    const node = findNodeByLeafResourceId(tree, "model.jaffle_shop.orders");
    expect(node).not.toBeNull();
    expect(node?.resource?.uniqueId).toBe("model.jaffle_shop.orders");
  });
});

describe("collectAncestorBranchIdsForResource", () => {
  it("returns ancestor branch ids for an existing resource", () => {
    const resources = [
      makeResource({
        name: "orders",
        originalFilePath: "models/marts/orders.sql",
      }),
    ];
    const tree = buildExplorerTree(resources, "project", "jaffle_shop");
    const ids = collectAncestorBranchIdsForResource(
      tree,
      "model.jaffle_shop.orders",
    );
    expect(ids.size).toBeGreaterThan(0);
    expect(
      [...ids].some((id) => id.includes("jaffle_shop/models/marts")),
    ).toBeTruthy();
  });

  it("returns an empty set for a missing resource", () => {
    const tree = buildExplorerTree(
      [makeResource({ name: "orders" })],
      "project",
      "jaffle_shop",
    );
    expect(
      collectAncestorBranchIdsForResource(tree, "model.jaffle_shop.missing"),
    ).toEqual(new Set());
  });
});
