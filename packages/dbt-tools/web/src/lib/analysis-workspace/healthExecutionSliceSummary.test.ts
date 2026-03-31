import { describe, expect, it } from "vitest";
import { buildHealthExecutionSliceSummary } from "./healthExecutionSliceSummary";
import type { OverviewFilterState } from "./types";

function state(over: Partial<OverviewFilterState>): OverviewFilterState {
  return {
    status: "all",
    resourceTypes: new Set(),
    query: "",
    ...over,
  };
}

describe("buildHealthExecutionSliceSummary", () => {
  it("describes all types and no search", () => {
    expect(buildHealthExecutionSliceSummary(state({}))).toBe(
      "All types · no search",
    );
  });

  it("counts selected types", () => {
    expect(
      buildHealthExecutionSliceSummary(
        state({ resourceTypes: new Set(["model"]) }),
      ),
    ).toBe("1 type · no search");
    expect(
      buildHealthExecutionSliceSummary(
        state({ resourceTypes: new Set(["model", "test"]) }),
      ),
    ).toBe("2 types · no search");
  });

  it("includes truncated query", () => {
    const q = "x".repeat(40);
    const s = buildHealthExecutionSliceSummary(state({ query: q }));
    expect(s).toContain("All types");
    expect(s).toContain("…");
    expect(s.length).toBeLessThan(q.length + 30);
  });
});
