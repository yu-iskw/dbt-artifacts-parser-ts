import type { BundleRow } from "@web/lib/analysis-workspace/bundleLayout";
import type { GanttItem } from "@web/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  drawGantt,
  fillRoundRect,
  findFirstVisible,
  findLastVisible,
} from "./canvasDraw";
import { ROW_H } from "./constants";
import { bundleRowHeight } from "./ganttChartHelpers";

function parent(id: string, overrides: Partial<GanttItem> = {}): GanttItem {
  return {
    unique_id: id,
    name: id,
    start: 0,
    end: 1000,
    duration: 1000,
    status: "success",
    resourceType: "model",
    packageName: "pkg",
    path: null,
    parentId: null,
    ...overrides,
  };
}

function testItem(id: string, parentId: string): GanttItem {
  return {
    unique_id: id,
    name: id,
    start: 100,
    end: 200,
    duration: 100,
    status: "pass",
    resourceType: "test",
    packageName: "pkg",
    path: null,
    parentId,
  };
}

function bundle(
  item: GanttItem,
  tests: GanttItem[],
  laneCount: number,
): BundleRow {
  const lanes = tests.map((t, i) => ({
    item: t,
    lane: i % Math.max(laneCount, 1),
  }));
  return { item, tests, lanes, laneCount };
}

/** Minimal 2D context stub so drawGantt can run without jsdom. */
function createMock2dContext(): CanvasRenderingContext2D {
  const store: Record<string, unknown> = {
    fillStyle: "",
    strokeStyle: "",
    font: "",
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    textAlign: "start",
    textBaseline: "alphabetic",
  };
  const fn = () => {};
  return new Proxy({} as CanvasRenderingContext2D, {
    get(_t, prop) {
      if (prop === "canvas") return null;
      if (typeof prop === "string" && prop in store) return store[prop];
      return fn;
    },
    set(_t, prop, value) {
      if (typeof prop === "string") store[prop] = value;
      return true;
    },
  });
}

function createCanvasStub(cssW: number, cssH: number): HTMLCanvasElement {
  const ctx = createMock2dContext();
  const el = {
    width: 0,
    height: 0,
    getBoundingClientRect: () =>
      ({
        width: cssW,
        height: cssH,
        top: 0,
        left: 0,
        bottom: cssH,
        right: cssW,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
    getContext: (type: string) => (type === "2d" ? ctx : null),
  };
  return el as unknown as HTMLCanvasElement;
}

describe("findFirstVisible", () => {
  it("returns 0 for empty offsets", () => {
    expect(findFirstVisible([], 0)).toBe(0);
  });

  it("returns 0 when first row starts at scrollTop", () => {
    expect(findFirstVisible([0, 50, 100], 0)).toBe(0);
  });

  it("selects first row at or above scrollTop then steps back one", () => {
    expect(findFirstVisible([0, 100, 200], 120)).toBe(1);
  });
});

describe("findLastVisible", () => {
  it("returns 0 when no row intersects viewport", () => {
    expect(findLastVisible([100, 200], [ROW_H, ROW_H], 0, 50)).toBe(0);
  });

  it("returns last intersecting index", () => {
    const offsets = [0, 50, 120];
    const heights = [ROW_H, ROW_H, ROW_H];
    expect(findLastVisible(offsets, heights, 0, 200)).toBe(2);
  });

  it("skips rows entirely above scrollTop", () => {
    const offsets = [0, 500];
    const heights = [ROW_H, ROW_H];
    expect(findLastVisible(offsets, heights, 400, 300)).toBe(1);
  });
});

describe("fillRoundRect", () => {
  it("invokes fill after building a path", () => {
    const calls: string[] = [];
    const ctx = {
      beginPath: () => calls.push("beginPath"),
      moveTo: () => calls.push("moveTo"),
      arcTo: () => calls.push("arcTo"),
      closePath: () => calls.push("closePath"),
      fill: () => calls.push("fill"),
    } as unknown as CanvasRenderingContext2D;

    fillRoundRect(ctx, 0, 0, 20, 10, 4);
    expect(calls).toContain("fill");
    expect(calls).toContain("closePath");
  });
});

describe("drawGantt", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws axis and rows when canvas has size", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });

    const canvas = createCanvasStub(500, 300);
    const p = parent("model.a");
    const t = testItem("test.a", "model.a");
    const bundles = [bundle(p, [t], 1)];

    const rowOffsets = [0];
    const rowHeights = [bundleRowHeight(bundles[0]!, true)];

    drawGantt(canvas, bundles, rowOffsets, rowHeights, {
      scrollTop: 0,
      rangeStart: 0,
      rangeEnd: 1000,
      displayMode: "duration",
      runStartedAt: null,
      focusIds: null,
      hoveredId: null,
      timeZone: "UTC",
      theme: "light",
      showTests: true,
    });

    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
  });

  it("returns early when canvas width is zero", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    const canvas = createCanvasStub(0, 100);

    drawGantt(canvas, [], [], [], {
      scrollTop: 0,
      rangeStart: 0,
      rangeEnd: 1,
      displayMode: "duration",
      runStartedAt: null,
      focusIds: null,
      hoveredId: null,
      timeZone: "UTC",
    });

    expect(canvas.width).toBe(0);
  });
});
