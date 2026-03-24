import { describe, it, expect } from "vitest";
import { clampDepth, collectDependencyIdsByDepth } from "./lineageModel";
import type { DependencyIndex } from "./lineageModel";

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
