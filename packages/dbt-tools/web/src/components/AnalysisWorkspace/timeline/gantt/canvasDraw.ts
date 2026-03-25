import { getResourceTypeColor, getStatusColor } from "@web/constants/colors";
import { type ThemeMode, getCanvasColors } from "@web/constants/themeColors";
import type { GanttItem, ResourceTestStats } from "@web/types";
import {
  AXIS_TOP,
  BAR_H,
  BAR_PAD,
  LABEL_W,
  NAME_Y,
  ROW_H,
  TIME_Y,
  X_PAD,
  type DisplayMode,
} from "./constants";
import {
  computeTicks,
  formatMs,
  formatTimestamp,
  isPositiveStatus,
} from "./formatting";

export function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

type CanvasPalette = ReturnType<typeof getCanvasColors>;

function drawRowBackground(
  ctx: CanvasRenderingContext2D,
  rowIndex: number,
  rowY: number,
  width: number,
  isFocused: boolean,
  isHovered: boolean,
  palette: CanvasPalette,
) {
  if (rowIndex % 2 !== 0) return;
  ctx.fillStyle = isHovered ? palette.rowStripeHover : palette.rowStripe;
  ctx.globalAlpha = isFocused ? 1 : 0.35;
  ctx.fillRect(0, rowY, width, ROW_H);
  ctx.globalAlpha = 1;
}

interface DrawRowLabelsParams {
  ctx: CanvasRenderingContext2D;
  item: GanttItem;
  rowY: number;
  labelW: number;
  displayMode: DisplayMode;
  runStartedAt: number | null | undefined;
  timeZone: string;
  emphasis: number;
  palette: CanvasPalette;
}

function drawRowLabels({
  ctx,
  item,
  rowY,
  labelW,
  displayMode,
  runStartedAt,
  timeZone,
  emphasis,
  palette,
}: DrawRowLabelsParams) {
  ctx.save();
  ctx.globalAlpha = emphasis;
  ctx.beginPath();
  ctx.rect(0, rowY, labelW - 10, ROW_H);
  ctx.clip();
  ctx.textAlign = "left";

  ctx.font = '12px "IBM Plex Sans", "Avenir Next", sans-serif';
  ctx.fillStyle = palette.labelText;
  ctx.fillText(item.name || item.unique_id, 2, rowY + NAME_Y);

  const startLabel =
    displayMode === "timestamps" && runStartedAt != null
      ? formatTimestamp(runStartedAt + item.start, timeZone)
      : `+${formatMs(item.start)}`;
  const endLabel =
    displayMode === "timestamps" && runStartedAt != null
      ? formatTimestamp(runStartedAt + item.end, timeZone)
      : `+${formatMs(item.end)}`;
  ctx.font = '10px "IBM Plex Mono", "Fira Mono", monospace';
  ctx.fillStyle = palette.metaText;
  ctx.fillText(`${startLabel} → ${endLabel}`, 2, rowY + TIME_Y);
  ctx.restore();
}

interface DrawRowBarParams {
  ctx: CanvasRenderingContext2D;
  item: GanttItem;
  rowY: number;
  maxEnd: number;
  chartW: number;
  labelW: number;
  emphasis: number;
  isHovered: boolean;
  attachedTestStats: ResourceTestStats | undefined;
  palette: CanvasPalette;
  theme: ThemeMode;
}

function drawRowBar({
  ctx,
  item,
  rowY,
  maxEnd,
  chartW,
  labelW,
  emphasis,
  isHovered,
  attachedTestStats,
  palette,
  theme,
}: DrawRowBarParams) {
  const barY = rowY + BAR_PAD;
  const barX = labelW + (item.start / maxEnd) * chartW;
  const barW = Math.max(2, (item.duration / maxEnd) * chartW);

  ctx.globalAlpha = emphasis;
  ctx.fillStyle = getStatusColor(item.status, theme);
  fillRoundRect(ctx, barX, barY, barW, BAR_H, 3);

  ctx.fillStyle = getResourceTypeColor(item.resourceType, theme);
  ctx.fillRect(barX, barY, 3, BAR_H);

  if (
    attachedTestStats &&
    attachedTestStats.fail + attachedTestStats.error > 0 &&
    isPositiveStatus(item.status)
  ) {
    ctx.fillStyle = palette.testFailStripe;
    fillRoundRect(ctx, barX, barY + BAR_H - 4, barW, 4, 2);
  }

  if (isHovered) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = palette.barHoverStroke;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX - 0.5, barY - 0.5, barW + 1, BAR_H + 1);
  }
  ctx.globalAlpha = 1;
}

export interface DrawGanttParams {
  scrollTop: number;
  maxEnd: number;
  displayMode: DisplayMode;
  runStartedAt: number | null | undefined;
  focusIds: Set<string> | null;
  hoveredId: string | null;
  labelW?: number;
  timeZone: string;
  testStatsById?: Map<string, ResourceTestStats>;
  /** Default `light` — pass from {@link useTheme} for canvas parity with CSS. */
  theme?: ThemeMode;
}

export function drawGantt(
  canvas: HTMLCanvasElement,
  data: GanttItem[],
  {
    scrollTop,
    maxEnd,
    displayMode,
    runStartedAt,
    focusIds,
    hoveredId,
    labelW = LABEL_W,
    timeZone,
    testStatsById,
    theme = "light",
  }: DrawGanttParams,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const palette = getCanvasColors(theme);

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = rect.width;
  const h = rect.height;
  if (w === 0 || h === 0) return;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const chartW = w - labelW - X_PAD;

  const ticks = computeTicks(maxEnd);
  ctx.font = "11px 'IBM Plex Mono', 'Fira Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = palette.axisTick;

  for (const tick of ticks) {
    const x = labelW + (tick.ms / maxEnd) * chartW;
    ctx.strokeStyle = palette.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, AXIS_TOP);
    ctx.lineTo(x, h);
    ctx.stroke();
    const label =
      displayMode === "timestamps" && runStartedAt != null
        ? formatTimestamp(runStartedAt + tick.ms, timeZone)
        : tick.label;
    ctx.fillText(label, x, AXIS_TOP / 2);
  }

  const visStart = Math.max(0, Math.floor(scrollTop / ROW_H));
  const visEnd = Math.min(
    data.length - 1,
    Math.ceil((scrollTop + h - AXIS_TOP) / ROW_H),
  );

  ctx.textBaseline = "middle";

  for (let i = visStart; i <= visEnd; i++) {
    const item = data[i];
    const rowY = AXIS_TOP + i * ROW_H - scrollTop;
    const isFocused = focusIds == null || focusIds.has(item.unique_id);
    const isHovered = hoveredId === item.unique_id;
    const emphasis = isFocused ? 1 : 0.18;

    drawRowBackground(ctx, i, rowY, w, isFocused, isHovered, palette);
    drawRowLabels({
      ctx,
      item,
      rowY,
      labelW,
      displayMode,
      runStartedAt,
      timeZone,
      emphasis,
      palette,
    });
    drawRowBar({
      ctx,
      item,
      rowY,
      maxEnd,
      chartW,
      labelW,
      emphasis,
      isHovered,
      attachedTestStats: testStatsById?.get(item.unique_id),
      palette,
      theme,
    });
  }
}
