import type { MouseEvent } from "react";
import type { GanttItem } from "@web/types";
import { AXIS_TOP, ROW_H, X_PAD } from "./constants";

export interface HoverState {
  item: GanttItem;
  x: number;
  y: number;
}

export function hitTestBar(
  event: MouseEvent<HTMLDivElement>,
  data: GanttItem[],
  scrollTop: number,
  maxEnd: number,
  effectiveLabelW: number,
  canvas: HTMLCanvasElement | null,
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
  const barX = effectiveLabelW + (item.start / maxEnd) * chartW;
  const barW = Math.max(2, (item.duration / maxEnd) * chartW);

  return mouseX >= barX && mouseX <= barX + barW
    ? { item, x: mouseX, y: mouseY }
    : null;
}
