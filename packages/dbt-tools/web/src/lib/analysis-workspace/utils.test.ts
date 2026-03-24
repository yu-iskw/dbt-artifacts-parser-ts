import { describe, it, expect } from "vitest";
import {
  formatSeconds,
  deriveProjectName,
  matchesResource,
  isMainProjectResource,
  isDefaultTimelineResource,
} from "./utils";
import type { ResourceNode } from "@web/types";
import type { ExecutionRow } from "@web/types";

// minimal stubs
function makeResource(overrides: Partial<ResourceNode> = {}): ResourceNode {
  return {
    uniqueId: "model.jaffle_shop.orders",
    name: "orders",
    resourceType: "model",
    packageName: "jaffle_shop",
    fqn: ["jaffle_shop", "orders"],
    originalFilePath: "models/orders.sql",
    description: "",
    dependsOn: [],
    database: "dev",
    schema: "dbt",
    ...overrides,
  } as ResourceNode;
}

describe("formatSeconds", () => {
  it("formats sub-minute", () => expect(formatSeconds(1.5)).toBe("1.50s"));
  it("formats exactly 0", () => expect(formatSeconds(0)).toBe("0.00s"));
  it("formats minutes", () => expect(formatSeconds(65.3)).toBe("1m 05.30s"));
  it("formats large values", () =>
    expect(formatSeconds(125)).toBe("2m 05.00s"));
});

describe("deriveProjectName", () => {
  it("returns null for empty array", () =>
    expect(deriveProjectName([])).toBeNull());
  it("returns most-common packageName", () => {
    const rows = [
      { packageName: "a" },
      { packageName: "b" },
      { packageName: "b" },
    ] as ExecutionRow[];
    expect(deriveProjectName(rows)).toBe("b");
  });
});

describe("matchesResource", () => {
  it("matches by name", () =>
    expect(matchesResource(makeResource(), "orders")).toBe(true));
  it("no match on wrong query", () =>
    expect(matchesResource(makeResource(), "customers")).toBe(false));
  it("empty query always matches", () =>
    expect(matchesResource(makeResource(), "")).toBe(true));
});

describe("isMainProjectResource", () => {
  it("true when packageName equals projectName", () =>
    expect(
      isMainProjectResource(
        makeResource({ packageName: "jaffle_shop" }),
        "jaffle_shop",
      ),
    ).toBe(true));
  it("false for different package", () =>
    expect(
      isMainProjectResource(
        makeResource({ packageName: "elementary" }),
        "jaffle_shop",
      ),
    ).toBe(false));
});

describe("isDefaultTimelineResource", () => {
  it("false for test resource", () =>
    expect(
      isDefaultTimelineResource(makeResource({ resourceType: "test" })),
    ).toBe(false));
  it("false for unit_test resource", () =>
    expect(
      isDefaultTimelineResource(makeResource({ resourceType: "unit_test" })),
    ).toBe(false));
  it("true for model resource", () =>
    expect(
      isDefaultTimelineResource(makeResource({ resourceType: "model" })),
    ).toBe(true));
});
