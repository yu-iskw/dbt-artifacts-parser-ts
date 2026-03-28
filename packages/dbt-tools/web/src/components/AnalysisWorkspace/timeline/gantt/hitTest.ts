import type { MouseEvent } from "react";
import type { GanttItem } from "@web/types";
import type { BundleRow } from "@web/lib/analysis-workspace/bundleLayout";
import {
  AXIS_TOP,
  BUNDLE_HULL_PAD,
  ROW_H,
  TEST_BAR_H,
  TEST_LANE_H,
  X_PAD,
} from "./constants";

export interface HoverState {
  item: GanttItem;
  x: number;
  y: number;
}

/** Precomputed per-bundle layout used by hit-testing and drawing. */
export interface BundleLayout {
  rowOffsets: number[];
  rowHeights: number[];
  showTests: boolean;
}

/**
 * Find the bundle index that contains the given content-area Y offset
 * (i.e. `mouseY - AXIS_TOP + scrollTop`).
 * Returns -1 if no bundle contains the point.
 */
export function findBundleAtOffset(
  rowOffsets: number[],
  rowHeights: number[],
  contentY: number,
): number {
  if (rowOffsets.length === 0) return -1;
  let lo = 0,
    hi = rowOffsets.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const offset = rowOffsets[mid] ?? 0;
    const height = rowHeights[mid] ?? ROW_H;
    if (offset > contentY) {
      hi = mid - 1;
    } else if (offset + height <= contentY) {
      lo = mid + 1;
    } else {
      return mid;
    }
  }
  return -1;
}

/**
 * Hit-test the Gantt chart with bundles.
 *
 * Returns the bar (parent or test chip) under the cursor, or null.
 */
export function hitTestBundle(
  event: MouseEvent<HTMLDivElement>,
  bundles: BundleRow[],
  layout: BundleLayout,
  scrollTop: number,
  rangeStart: number,
  rangeEnd: number,
  effectiveLabelW: number,
  canvas: HTMLCanvasElement | null,
): { item: GanttItem; x: number; y: number } | null {
  const { rowOffsets, rowHeights, showTests } = layout;
  if (!canvas) return null;
  const rect = event.currentTarget.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  if (mouseY < AXIS_TOP || mouseX < 0) return null;

  const contentY = mouseY - AXIS_TOP + scrollTop;
  const bundleIdx = findBundleAtOffset(rowOffsets, rowHeights, contentY);
  if (bundleIdx < 0 || bundleIdx >= bundles.length) return null;

  const bundle = bundles[bundleIdx];
  if (!bundle) return null;
  const rangeDuration = Math.max(1, rangeEnd - rangeStart);

  const chartW = canvas.getBoundingClientRect().width - effectiveLabelW - X_PAD;
  const bundleRowY = AXIS_TOP + (rowOffsets[bundleIdx] ?? 0) - scrollTop;

  // Label column: select parent
  if (mouseX < effectiveLabelW) {
    return { item: bundle.item, x: mouseX, y: mouseY };
  }

  // Chart bounds used to clamp hitboxes so that bars extending outside the
  // visible window do not make items hittable in the label column or beyond.
  const chartLeft = effectiveLabelW;
  const chartRight = effectiveLabelW + chartW;

  // Check parent bar
  const rawBarStartX =
    effectiveLabelW +
    ((bundle.item.start - rangeStart) / rangeDuration) * chartW;
  const rawBarEndX =
    effectiveLabelW + ((bundle.item.end - rangeStart) / rangeDuration) * chartW;
  const barX = Math.max(chartLeft, Math.min(rawBarStartX, rawBarEndX));
  const barXEnd = Math.min(chartRight, Math.max(rawBarStartX, rawBarEndX));
  const barW = Math.max(2, barXEnd - barX);
  if (mouseX >= barX && mouseX <= barX + barW) {
    return { item: bundle.item, x: mouseX, y: mouseY };
  }

  if (showTests && bundle.lanes.length > 0) {
    for (const { item: test, lane } of bundle.lanes) {
      const rawChipStartX =
        effectiveLabelW + ((test.start - rangeStart) / rangeDuration) * chartW;
      const rawChipEndX =
        effectiveLabelW + ((test.end - rangeStart) / rangeDuration) * chartW;
      const chipX = Math.max(chartLeft, Math.min(rawChipStartX, rawChipEndX));
      const chipXEnd = Math.min(chartRight, Math.max(rawChipStartX, rawChipEndX));
      const chipW = Math.max(2, chipXEnd - chipX);
      const chipY = bundleRowY + ROW_H + BUNDLE_HULL_PAD + lane * TEST_LANE_H;

      if (
        mouseX >= chipX &&
        mouseX <= chipX + chipW &&
        mouseY >= chipY &&
        mouseY <= chipY + TEST_BAR_H
      ) {
        return { item: test, x: mouseX, y: mouseY };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Legacy flat-list hit-test (kept for any callers that have not migrated yet)
// ---------------------------------------------------------------------------

export function hitTestBar(
  event: MouseEvent<HTMLDivElement>,
  data: GanttItem[],
  scrollTop: number,
  maxEnd: number,
  effectiveLabelW: number,
  canvas: HTMLCanvasElement | null,
  minTime = 0,
): HoverState | null {
  if (!canvas) return null;
  const rect = event.currentTarget.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  if (mouseY < AXIS_TOP || mouseX < 0) return null;

  const rowIdx = Math.floor((mouseY - AXIS_TOP + scrollTop) / ROW_H);
  if (rowIdx < 0 || rowIdx >= data.length) return null;

  const chartW = canvas.getBoundingClientRect().width - effectiveLabelW - X_PAD;
  const item = data[rowIdx];
  if (!item) return null;
  const barX = effectiveLabelW + ((item.start - minTime) / maxEnd) * chartW;
  const barW = Math.max(2, (item.duration / maxEnd) * chartW);

  return mouseX >= barX && mouseX <= barX + barW
    ? { item, x: mouseX, y: mouseY }
    : null;
}
