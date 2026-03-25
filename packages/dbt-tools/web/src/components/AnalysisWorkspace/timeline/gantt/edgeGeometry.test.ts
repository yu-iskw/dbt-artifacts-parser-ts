import type { GanttItem, TimelineAdjacencyEntry } from "@web/types";
import type { BundleRow } from "@web/lib/analysis-workspace/bundleLayout";
import { describe, expect, it } from "vitest";
import {
  applyNeighborCap,
  applyUpstreamCap,
  countInboundOnTimeline,
  countOutboundOnTimeline,
  focusEdgePath,
  getFocusTimelineEdges,
  parcelCenterY,
  rankInboundNeighborIds,
  rankOutboundNeighborIds,
} from "./edgeGeometry";
import {
  AXIS_TOP,
  ROW_H,
  TIMELINE_MAX_DOWNSTREAM_EDGES,
  TIMELINE_MAX_UPSTREAM_EDGES,
} from "./constants";

const fullUpstreamOpts = {
  includeDownstream: false,
  showAllUpstream: true,
  maxUpstreamEdges: TIMELINE_MAX_UPSTREAM_EDGES,
  showAllDownstream: true,
  maxDownstreamEdges: TIMELINE_MAX_DOWNSTREAM_EDGES,
} as const;

function model(
  id: string,
  start = 0,
  end = 1000,
  resourceType = "model",
): GanttItem {
  return {
    unique_id: id,
    name: id,
    start,
    end,
    duration: end - start,
    status: "success",
    resourceType,
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

describe("rankInboundNeighborIds", () => {
  it("orders sibling tests before primary upstream", () => {
    const m = model("model.p");
    const t1 = test("test.t1", "model.p");
    const t2 = test("test.t2", "model.p", 300, 400);
    const itemById = new Map([m, t1, t2].map((i) => [i.unique_id, i]));
    const ranked = rankInboundNeighborIds(["model.p", "test.t1"], t2, itemById);
    expect(ranked[0]).toBe("test.t1");
    expect(ranked[1]).toBe("model.p");
  });

  it("uses resource type before temporal tie-break", () => {
    const src = model("source.x", 0, 50, "source");
    const m = model("model.x", 0, 200);
    const focus = model("model.f", 500, 600);
    const itemById = new Map([src, m, focus].map((i) => [i.unique_id, i]));
    const ranked = rankInboundNeighborIds(
      ["model.x", "source.x"],
      focus,
      itemById,
    );
    expect(ranked[0]).toBe("model.x");
    expect(ranked[1]).toBe("source.x");
  });
});

describe("applyUpstreamCap", () => {
  it("returns all when showAllUpstream", () => {
    const ids = ["a", "b", "c"];
    expect(applyUpstreamCap(ids, true, 2)).toEqual(ids);
  });

  it("slices when over max", () => {
    expect(applyUpstreamCap(["a", "b", "c", "d"], false, 2)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("applyNeighborCap", () => {
  it("matches upstream cap semantics", () => {
    expect(applyNeighborCap(["a", "b", "c"], true, 1)).toEqual(["a", "b", "c"]);
    expect(applyNeighborCap(["a", "b", "c"], false, 2)).toEqual(["a", "b"]);
  });
});

describe("countInboundOnTimeline", () => {
  it("counts only ids present in bundleIndexById", () => {
    const adj: Record<string, TimelineAdjacencyEntry> = {
      x: { inbound: ["a", "b", "missing"], outbound: [] },
    };
    const idx = new Map([
      ["a", 0],
      ["b", 1],
    ]);
    expect(countInboundOnTimeline("x", adj, idx)).toBe(2);
  });
});

describe("countOutboundOnTimeline", () => {
  it("counts only ids present in bundleIndexById", () => {
    const adj: Record<string, TimelineAdjacencyEntry> = {
      x: { inbound: [], outbound: ["a", "b", "gone"] },
    };
    const idx = new Map([
      ["a", 0],
      ["b", 1],
    ]);
    expect(countOutboundOnTimeline("x", adj, idx)).toBe(2);
  });
});

describe("rankOutboundNeighborIds", () => {
  it("uses resource type before temporal tie-break", () => {
    const focus = model("model.f", 0, 100);
    const src = model("source.x", 500, 600, "source");
    const m = model("model.x", 200, 300);
    const itemById = new Map([focus, src, m].map((i) => [i.unique_id, i]));
    const ranked = rankOutboundNeighborIds(
      ["source.x", "model.x"],
      focus,
      itemById,
    );
    expect(ranked[0]).toBe("model.x");
    expect(ranked[1]).toBe("source.x");
  });
});

describe("getFocusTimelineEdges", () => {
  it("returns empty when focusId is null", () => {
    const itemById = new Map<string, GanttItem>();
    const bundleIndexById = new Map<string, number>();
    expect(
      getFocusTimelineEdges(null, {}, itemById, bundleIndexById, {
        includeDownstream: false,
        showAllUpstream: true,
        maxUpstreamEdges: TIMELINE_MAX_UPSTREAM_EDGES,
        showAllDownstream: false,
        maxDownstreamEdges: TIMELINE_MAX_DOWNSTREAM_EDGES,
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
      { ...fullUpstreamOpts, includeDownstream: false },
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
      { ...fullUpstreamOpts, includeDownstream: true },
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
      { ...fullUpstreamOpts, includeDownstream: true },
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
      fullUpstreamOpts,
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

  it("caps upstream edges in compact mode", () => {
    const focus = model("model.focus", 5000, 6000);
    const inboundIds: string[] = [];
    const items: GanttItem[] = [focus];
    for (let i = 0; i < 12; i++) {
      const id = `model.up${i}`;
      inboundIds.push(id);
      items.push(model(id, i * 10, i * 10 + 5));
    }
    const itemById = new Map(items.map((x) => [x.unique_id, x]));
    const bundleIndexById = new Map(items.map((x, i) => [x.unique_id, i]));

    const timelineAdjacency: Record<string, TimelineAdjacencyEntry> = {
      "model.focus": { inbound: inboundIds, outbound: [] },
    };

    const compact = getFocusTimelineEdges(
      "model.focus",
      timelineAdjacency,
      itemById,
      bundleIndexById,
      {
        includeDownstream: false,
        showAllUpstream: false,
        maxUpstreamEdges: 8,
        showAllDownstream: false,
        maxDownstreamEdges: TIMELINE_MAX_DOWNSTREAM_EDGES,
      },
    );
    expect(compact.filter((e) => e.tier !== "downstream")).toHaveLength(8);

    const full = getFocusTimelineEdges(
      "model.focus",
      timelineAdjacency,
      itemById,
      bundleIndexById,
      {
        includeDownstream: false,
        showAllUpstream: true,
        maxUpstreamEdges: 8,
        showAllDownstream: false,
        maxDownstreamEdges: TIMELINE_MAX_DOWNSTREAM_EDGES,
      },
    );
    expect(full.filter((e) => e.tier !== "downstream")).toHaveLength(12);
  });

  it("caps downstream edges in compact mode", () => {
    const focus = model("model.focus", 0, 100);
    const outboundIds: string[] = [];
    const items: GanttItem[] = [focus];
    for (let i = 0; i < 12; i++) {
      const id = `model.down${i}`;
      outboundIds.push(id);
      items.push(model(id, 500 + i * 10, 600 + i * 10));
    }
    const itemById = new Map(items.map((x) => [x.unique_id, x]));
    const bundleIndexById = new Map(items.map((x, i) => [x.unique_id, i]));

    const timelineAdjacency: Record<string, TimelineAdjacencyEntry> = {
      "model.focus": { inbound: [], outbound: outboundIds },
    };

    const compact = getFocusTimelineEdges(
      "model.focus",
      timelineAdjacency,
      itemById,
      bundleIndexById,
      {
        includeDownstream: true,
        showAllUpstream: true,
        maxUpstreamEdges: TIMELINE_MAX_UPSTREAM_EDGES,
        showAllDownstream: false,
        maxDownstreamEdges: 8,
      },
    );
    expect(compact.filter((e) => e.tier === "downstream")).toHaveLength(8);

    const full = getFocusTimelineEdges(
      "model.focus",
      timelineAdjacency,
      itemById,
      bundleIndexById,
      {
        includeDownstream: true,
        showAllUpstream: true,
        maxUpstreamEdges: TIMELINE_MAX_UPSTREAM_EDGES,
        showAllDownstream: true,
        maxDownstreamEdges: 8,
      },
    );
    expect(full.filter((e) => e.tier === "downstream")).toHaveLength(12);
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
