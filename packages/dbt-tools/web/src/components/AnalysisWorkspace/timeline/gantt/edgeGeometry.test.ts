import type { GanttItem, TimelineAdjacencyEntry } from "@web/types";
import type { BundleRow } from "@web/lib/analysis-workspace/bundleLayout";
import { describe, expect, it } from "vitest";
import {
  focusEdgePath,
  getFocusTimelineEdges,
  parcelCenterY,
} from "./edgeGeometry";
import { AXIS_TOP, ROW_H } from "./constants";

function model(id: string, start = 0, end = 1000): GanttItem {
  return {
    unique_id: id,
    name: id,
    start,
    end,
    duration: end - start,
    status: "success",
    resourceType: "model",
    packageName: "pkg",
    path: null,
    parentId: null,
  };
}

function test(id: string, parentId: string, start = 100, end = 200): GanttItem {
  return {
    unique_id: id,
    name: id,
    start,
    end,
    duration: end - start,
    status: "pass",
    resourceType: "test",
    packageName: "pkg",
    path: null,
    parentId,
  };
}

function makeBundle(parent: GanttItem, tests: GanttItem[]): BundleRow {
  const lanes = tests.map((t, i) => ({ item: t, lane: i }));
  return {
    item: parent,
    tests,
    lanes,
    laneCount: tests.length,
  };
}

describe("getFocusTimelineEdges", () => {
  it("returns empty when focusId is null", () => {
    const itemById = new Map<string, GanttItem>();
    const bundleIndexById = new Map<string, number>();
    expect(
      getFocusTimelineEdges(null, {}, itemById, bundleIndexById, {
        includeDownstream: false,
      }),
    ).toEqual([]);
  });

  it("emits primary inbound edges to focus and optional downstream", () => {
    const m1 = model("model.a");
    const m2 = model("model.b", 500, 1500);
    const rel = test("test.rel", "model.a", 200, 400);
    const items = [m1, m2, rel];
    const itemById = new Map(items.map((i) => [i.unique_id, i]));
    const bundleIndexById = new Map<string, number>([
      ["model.a", 0],
      ["test.rel", 0],
      ["model.b", 1],
    ]);

    const timelineAdjacency: Record<string, TimelineAdjacencyEntry> = {
      "test.rel": {
        inbound: ["model.a", "model.b"],
        outbound: ["model.c"],
      },
    };

    const up = getFocusTimelineEdges(
      "test.rel",
      timelineAdjacency,
      itemById,
      bundleIndexById,
      { includeDownstream: false },
    );
    expect(up).toHaveLength(2);
    expect(up).toContainEqual({
      fromId: "model.a",
      toId: "test.rel",
      tier: "primary",
    });
    expect(up).toContainEqual({
      fromId: "model.b",
      toId: "test.rel",
      tier: "primary",
    });

    const withDown = getFocusTimelineEdges(
      "test.rel",
      timelineAdjacency,
      itemById,
      bundleIndexById,
      { includeDownstream: true },
    );
    expect(withDown.some((e) => e.tier === "downstream")).toBe(false);

    const idx = new Map<string, number>([
      ["model.a", 0],
      ["test.rel", 0],
      ["model.b", 1],
      ["model.c", 2],
    ]);
    const withC = getFocusTimelineEdges(
      "test.rel",
      timelineAdjacency,
      itemById,
      idx,
      { includeDownstream: true },
    );
    expect(withC).toContainEqual({
      fromId: "test.rel",
      toId: "model.c",
      tier: "downstream",
    });
  });

  it("classifies sibling tests as secondary", () => {
    const m = model("model.p");
    const t1 = test("test.t1", "model.p");
    const t2 = test("test.t2", "model.p", 300, 400);
    const items = [m, t1, t2];
    const itemById = new Map(items.map((i) => [i.unique_id, i]));
    const bundleIndexById = new Map<string, number>([
      ["model.p", 0],
      ["test.t1", 0],
      ["test.t2", 0],
    ]);

    const timelineAdjacency: Record<string, TimelineAdjacencyEntry> = {
      "test.t2": { inbound: ["test.t1", "model.p"], outbound: [] },
    };

    const edges = getFocusTimelineEdges(
      "test.t2",
      timelineAdjacency,
      itemById,
      bundleIndexById,
      { includeDownstream: false },
    );
    expect(edges).toContainEqual({
      fromId: "test.t1",
      toId: "test.t2",
      tier: "secondary",
    });
    expect(edges).toContainEqual({
      fromId: "model.p",
      toId: "test.t2",
      tier: "primary",
    });
  });
});

describe("parcelCenterY and focusEdgePath", () => {
  it("places parent bar center in row coordinates", () => {
    const m = model("m.x");
    const bundles = [makeBundle(m, [])];
    const rowOffsets = [0];
    const y = parcelCenterY(0, "m.x", bundles, rowOffsets, 0, true);
    expect(y).toBe(AXIS_TOP + 6 + 7);
  });

  it("places test chip center when showTests", () => {
    const m = model("m.x");
    const t = test("t.x", "m.x");
    const bundles = [makeBundle(m, [t])];
    const rowOffsets = [0];
    const y = parcelCenterY(0, "t.x", bundles, rowOffsets, 0, true);
    const expectedChipTop = AXIS_TOP + ROW_H + 5;
    expect(y).toBe(expectedChipTop + 5);
  });

  it("builds a cubic path between two parcels", () => {
    const a = model("a", 0, 100);
    const b = model("b", 200, 300);
    const itemById = new Map([
      [a.unique_id, a],
      [b.unique_id, b],
    ]);
    const bundleIndexById = new Map([
      [a.unique_id, 0],
      [b.unique_id, 1],
    ]);
    const bundles = [makeBundle(a, []), makeBundle(b, [])];
    const rowOffsets = [0, ROW_H];

    const d = focusEdgePath({
      edge: { fromId: "a", toId: "b", tier: "primary" },
      itemById,
      bundleIndexById,
      bundles,
      rowOffsets,
      scrollTop: 0,
      showTests: true,
      effectiveLabelW: 100,
      maxEnd: 500,
      chartW: 400,
    });
    expect(d.startsWith("M")).toBe(true);
    expect(d.includes("C")).toBe(true);
  });
});
