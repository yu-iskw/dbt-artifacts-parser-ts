/**
 * Scroll coordinates for the lineage viewport (canvas uses scale(zoom) from top-left).
 * Node center in scroll space: ((layoutX + dx) + nodeWidth/2) * zoom
 */
export interface ScrollToCenterSelectedNodeParams {
  layoutX: number;
  layoutY: number;
  nodeWidth: number;
  nodeHeight: number;
  zoom: number;
  viewportClientWidth: number;
  viewportClientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
}

export function getScrollToCenterSelectedNode(
  params: ScrollToCenterSelectedNodeParams,
): { scrollLeft: number; scrollTop: number } {
  const {
    layoutX,
    layoutY,
    nodeWidth,
    nodeHeight,
    zoom,
    viewportClientWidth,
    viewportClientHeight,
    scrollWidth,
    scrollHeight,
  } = params;

  if (
    viewportClientWidth <= 0 ||
    viewportClientHeight <= 0 ||
    !Number.isFinite(layoutX) ||
    !Number.isFinite(layoutY)
  ) {
    return { scrollLeft: 0, scrollTop: 0 };
  }

  const centerX = (layoutX + nodeWidth / 2) * zoom;
  const centerY = (layoutY + nodeHeight / 2) * zoom;

  const maxScrollLeft = Math.max(0, scrollWidth - viewportClientWidth);
  const maxScrollTop = Math.max(0, scrollHeight - viewportClientHeight);

  const targetLeft = centerX - viewportClientWidth / 2;
  const targetTop = centerY - viewportClientHeight / 2;

  return {
    scrollLeft: Math.min(maxScrollLeft, Math.max(0, targetLeft)),
    scrollTop: Math.min(maxScrollTop, Math.max(0, targetTop)),
  };
}
