import type { BundleRow } from "@web/lib/analysis-workspace/bundleLayout";
import type { GanttItem } from "@web/types";
import { describe, expect, it } from "vitest";
import { AXIS_TOP, BUNDLE_HULL_PAD, ROW_H, TEST_LANE_H } from "./constants";
import {
  bundleRowHeight,
  computeRowLayout,
  computeVisRange,
  getFailureBundleIds,
} from "./ganttChartHelpers";

function parent(id: string, overrides: Partial<GanttItem> = {}): GanttItem {
  return {
    unique_id: id,
    name: id,
    start: 0,
    end: 100,
    duration: 100,
    status: "success",
    resourceType: "model",
    packageName: "pkg",
    path: null,
    parentId: null,
    ...overrides,
  };
}

function testItem(
  id: string,
  parentId: string,
  overrides: Partial<GanttItem> = {},
): GanttItem {
  return {
    unique_id: id,
    name: id,
    start: 0,
    end: 50,
    duration: 50,
    status: "pass",
    resourceType: "test",
    packageName: "pkg",
    path: null,
    parentId,
    ...overrides,
  };
}

function row(
  item: GanttItem,
  opts: { tests?: GanttItem[]; laneCount?: number } = {},
): BundleRow {
  const tests = opts.tests ?? [];
  const laneCount = opts.laneCount ?? (tests.length > 0 ? 1 : 0);
  const lanes = tests.map((t, i) => ({ item: t, lane: i % laneCount }));
  return { item, tests, lanes, laneCount };
}

describe("bundleRowHeight", () => {
  it("matches expanded layout when showTests and lanes exist", () => {
    const bundles = [
      row(parent("p"), {
        tests: [testItem("t1", "p")],
        laneCount: 2,
      }),
    ];
    expect(bundleRowHeight(bundles[0]!, true)).toBe(
      ROW_H + BUNDLE_HULL_PAD + 2 * TEST_LANE_H + BUNDLE_HULL_PAD,
    );
    expect(bundleRowHeight(bundles[0]!, false)).toBe(ROW_H);
  });
});

describe("computeRowLayout", () => {
  it("uses ROW_H for parents without tests when showTests is on", () => {
    const bundles = [row(parent("a")), row(parent("b"))];
    const { rowOffsets, rowHeights, totalHeight } = computeRowLayout(
      bundles,
      true,
    );
    expect(rowOffsets).toEqual([0, ROW_H]);
    expect(rowHeights.every((h) => h === ROW_H)).toBe(true);
    expect(totalHeight).toBe(ROW_H * 2);
  });

  it("expands height when showTests and laneCount > 0", () => {
    const p = parent("p");
    const bundles = [
      row(p, {
        tests: [testItem("t1", "p")],
        laneCount: 2,
      }),
    ];
    const { rowHeights, totalHeight } = computeRowLayout(bundles, true);
    expect(rowHeights[0]).toBe(
      ROW_H + BUNDLE_HULL_PAD + 2 * TEST_LANE_H + BUNDLE_HULL_PAD,
    );
    expect(totalHeight).toBe(rowHeights[0]!);
  });

  it("does not expand lane height when showTests is false", () => {
    const p = parent("p");
    const bundles = [
      row(p, {
        tests: [testItem("t1", "p")],
        laneCount: 2,
      }),
    ];
    const { rowHeights } = computeRowLayout(bundles, false);
    expect(rowHeights[0]).toBe(ROW_H);
  });
});

describe("computeVisRange", () => {
  const offsets = [0, 40, 90, 200];
  const viewportH = 100;

  it("returns inclusive indices for rows intersecting the viewport", () => {
    const scrollTop = 0;
    const bottom = scrollTop + viewportH - AXIS_TOP;
    expect(bottom).toBe(68);
    const r = computeVisRange(offsets, scrollTop, viewportH, offsets.length);
    expect(r.visStart).toBe(0);
    expect(r.visEnd).toBeLessThanOrEqual(3);
    expect(r.visEnd).toBeGreaterThanOrEqual(1);
  });

  it("clamps visEnd to bundle count - 1", () => {
    const r = computeVisRange([0], 0, 500, 1);
    expect(r).toEqual({ visStart: 0, visEnd: 0 });
  });

  it("returns empty range when bundle count is zero", () => {
    expect(computeVisRange([], 0, 100, 0)).toEqual({
      visStart: 0,
      visEnd: -1,
    });
  });
});

describe("getFailureBundleIds", () => {
  it("includes bundles with non-positive parent status", () => {
    const bundles = [row(parent("x", { status: "error" }))];
    expect(getFailureBundleIds(bundles)).toEqual(new Set(["x"]));
  });

  it("includes bundles with failing tests when stats absent", () => {
    const p = parent("p");
    const bundles = [
      row(p, {
        tests: [testItem("t1", "p", { status: "fail" })],
      }),
    ];
    expect(getFailureBundleIds(bundles)).toEqual(new Set(["p"]));
  });

  it("uses testStatsById fail+error when present", () => {
    const p = parent("p", { status: "success" });
    const bundles = [row(p)];
    const stats = new Map([["p", { pass: 1, fail: 0, error: 1 }]]);
    expect(getFailureBundleIds(bundles, stats)).toEqual(new Set(["p"]));
  });

  it("returns empty when all healthy", () => {
    const p = parent("p");
    const bundles = [
      row(p, { tests: [testItem("t1", "p", { status: "pass" })] }),
    ];
    const stats = new Map([["p", { pass: 1, fail: 0, error: 0 }]]);
    expect(getFailureBundleIds(bundles, stats).size).toBe(0);
  });
});
