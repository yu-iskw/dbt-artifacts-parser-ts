import { describe, expect, it } from "vitest";
import { getScrollToCenterSelectedNode } from "./lineageViewportScroll";

describe("getScrollToCenterSelectedNode", () => {
  it("centers the node when the viewport and canvas are large enough", () => {
    const { scrollLeft, scrollTop } = getScrollToCenterSelectedNode({
      layoutX: 100,
      layoutY: 80,
      nodeWidth: 40,
      nodeHeight: 30,
      zoom: 1,
      viewportClientWidth: 200,
      viewportClientHeight: 200,
      scrollWidth: 1000,
      scrollHeight: 800,
    });
    // center at (120, 95) -> scroll = center - half viewport; top clamps at 0
    expect(scrollLeft).toBe(20);
    expect(scrollTop).toBe(0);
  });

  it("clamps scroll to zero when the target is above/left of the canvas", () => {
    const { scrollLeft, scrollTop } = getScrollToCenterSelectedNode({
      layoutX: 10,
      layoutY: 10,
      nodeWidth: 20,
      nodeHeight: 20,
      zoom: 1,
      viewportClientWidth: 400,
      viewportClientHeight: 300,
      scrollWidth: 500,
      scrollHeight: 400,
    });
    expect(scrollLeft).toBe(0);
    expect(scrollTop).toBe(0);
  });

  it("clamps scroll to max when the target is past the bottom-right", () => {
    const { scrollLeft, scrollTop } = getScrollToCenterSelectedNode({
      layoutX: 900,
      layoutY: 700,
      nodeWidth: 40,
      nodeHeight: 40,
      zoom: 1,
      viewportClientWidth: 200,
      viewportClientHeight: 200,
      scrollWidth: 1000,
      scrollHeight: 800,
    });
    expect(scrollLeft).toBe(800);
    expect(scrollTop).toBe(600);
  });

  it("scales positions with zoom", () => {
    const { scrollLeft, scrollTop } = getScrollToCenterSelectedNode({
      layoutX: 50,
      layoutY: 50,
      nodeWidth: 20,
      nodeHeight: 20,
      zoom: 2,
      viewportClientWidth: 100,
      viewportClientHeight: 100,
      scrollWidth: 2000,
      scrollHeight: 2000,
    });
    // center at (60, 60) in layout * 2 = (120, 120)
    expect(scrollLeft).toBe(70);
    expect(scrollTop).toBe(70);
  });

  it("returns zeros when viewport client size is zero", () => {
    expect(
      getScrollToCenterSelectedNode({
        layoutX: 0,
        layoutY: 0,
        nodeWidth: 10,
        nodeHeight: 10,
        zoom: 1,
        viewportClientWidth: 0,
        viewportClientHeight: 100,
        scrollWidth: 500,
        scrollHeight: 500,
      }),
    ).toEqual({ scrollLeft: 0, scrollTop: 0 });
  });
});
