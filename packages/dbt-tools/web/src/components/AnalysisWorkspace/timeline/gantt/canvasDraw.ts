import { getResourceTypeColor, getStatusColor } from "@web/constants/colors";
import { type ThemeMode, getCanvasColors } from "@web/constants/themeColors";
import type { GanttItem, ResourceTestStats } from "@web/types";
import type { BundleRow } from "@web/lib/analysis-workspace/bundleLayout";
import {
  AXIS_TOP,
  BAR_H,
  BAR_PAD,
  BUNDLE_HULL_PAD,
  LABEL_W,
  MIN_CHIP_W,
  NAME_Y,
  ROW_H,
  TEST_BAR_H,
  TEST_LANE_H,
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

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Trace a rounded-rectangle path (no fill/stroke — caller decides). */
function roundRectPath(
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
}

/** Trace + fill a rounded rectangle. */
export function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
}

type CanvasPalette = ReturnType<typeof getCanvasColors>;

// ---------------------------------------------------------------------------
// Row background
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Row labels
// ---------------------------------------------------------------------------

interface DrawRowLabelsParams {
  ctx: CanvasRenderingContext2D;
  item: GanttItem;
  rowY: number;
  labelW: number;
  xOffset: number;
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
  xOffset,
  displayMode,
  runStartedAt,
  timeZone,
  emphasis,
  palette,
}: DrawRowLabelsParams) {
  ctx.save();
  ctx.globalAlpha = emphasis;
  ctx.beginPath();
  ctx.rect(xOffset, rowY, labelW - 10 - xOffset, ROW_H);
  ctx.clip();
  ctx.textAlign = "left";

  ctx.font = '12px "IBM Plex Sans", "Avenir Next", sans-serif';
  ctx.fillStyle = palette.labelText;
  ctx.fillText(item.name || item.unique_id, xOffset + 2, rowY + NAME_Y);

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
  ctx.fillText(`${startLabel} → ${endLabel}`, xOffset + 2, rowY + TIME_Y);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Parent bar
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Test chip
// ---------------------------------------------------------------------------

interface DrawTestChipParams {
  ctx: CanvasRenderingContext2D;
  test: GanttItem;
  chipY: number;
  maxEnd: number;
  chartW: number;
  labelW: number;
  palette: CanvasPalette;
  theme: ThemeMode;
  emphasis: number;
  isHovered: boolean;
}

function drawTestChip({
  ctx,
  test,
  chipY,
  maxEnd,
  chartW,
  labelW,
  palette,
  theme,
  emphasis,
  isHovered,
}: DrawTestChipParams) {
  const chipX = labelW + (test.start / maxEnd) * chartW;
  const chipW = Math.max(MIN_CHIP_W, (test.duration / maxEnd) * chartW);
  const chipH = TEST_BAR_H;

  ctx.globalAlpha = emphasis;
  ctx.fillStyle = getStatusColor(test.status, theme);
  fillRoundRect(ctx, chipX, chipY, chipW, chipH, 2);

  // Label inside chip when wide enough
  if (chipW >= 40) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(chipX + 2, chipY, chipW - 4, chipH);
    ctx.clip();
    ctx.font = '9px "IBM Plex Sans", "Avenir Next", sans-serif';
    ctx.fillStyle = palette.labelText;
    ctx.textAlign = "left";
    ctx.fillText(test.name, chipX + 2, chipY + chipH / 2);
    ctx.restore();
  }

  if (isHovered) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = palette.barHoverStroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(chipX - 0.5, chipY - 0.5, chipW + 1, chipH + 1);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// drawGantt helpers (keeps main entry shallow for complexity limits)
// ---------------------------------------------------------------------------

function initGanttCanvas(
  canvas: HTMLCanvasElement,
  labelW: number,
): {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  chartW: number;
} | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = rect.width;
  const h = rect.height;
  if (w === 0 || h === 0) return null;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const chartW = w - labelW - X_PAD;
  return { ctx, w, h, chartW };
}

interface DrawGanttAxisTicksParams {
  ctx: CanvasRenderingContext2D;
  labelW: number;
  chartW: number;
  h: number;
  maxEnd: number;
  displayMode: DisplayMode;
  runStartedAt: number | null | undefined;
  timeZone: string;
  palette: CanvasPalette;
}

function drawGanttAxisTicks({
  ctx,
  labelW,
  chartW,
  h,
  maxEnd,
  displayMode,
  runStartedAt,
  timeZone,
  palette,
}: DrawGanttAxisTicksParams): void {
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
}

interface DrawGanttVisibleRowParams {
  ctx: CanvasRenderingContext2D;
  bundle: BundleRow;
  rowIndex: number;
  rowY: number;
  w: number;
  labelW: number;
  chartW: number;
  maxEnd: number;
  focusIds: Set<string> | null;
  hoveredId: string | null;
  displayMode: DisplayMode;
  runStartedAt: number | null | undefined;
  timeZone: string;
  theme: ThemeMode;
  palette: CanvasPalette;
  testStatsById?: Map<string, ResourceTestStats>;
  showTests: boolean;
}

function drawGanttVisibleRow(p: DrawGanttVisibleRowParams): void {
  const {
    ctx,
    bundle,
    rowIndex,
    rowY,
    w,
    labelW,
    chartW,
    maxEnd,
    focusIds,
    hoveredId,
    displayMode,
    runStartedAt,
    timeZone,
    theme,
    palette,
    testStatsById,
    showTests,
  } = p;

  const rowHasFocus =
    focusIds == null ||
    focusIds.has(bundle.item.unique_id) ||
    bundle.lanes.some((l) => focusIds.has(l.item.unique_id));
  const isFocused = focusIds == null || focusIds.has(bundle.item.unique_id);
  const isHovered = hoveredId === bundle.item.unique_id;
  const emphasis = isFocused ? 1 : 0.18;

  drawRowBackground(ctx, rowIndex, rowY, w, rowHasFocus, isHovered, palette);

  drawRowLabels({
    ctx,
    item: bundle.item,
    rowY,
    labelW,
    xOffset: 0,
    displayMode,
    runStartedAt,
    timeZone,
    emphasis,
    palette,
  });

  drawRowBar({
    ctx,
    item: bundle.item,
    rowY,
    maxEnd,
    chartW,
    labelW,
    emphasis,
    isHovered,
    attachedTestStats: testStatsById?.get(bundle.item.unique_id),
    palette,
    theme,
  });

  if (!showTests || bundle.lanes.length === 0) return;

  for (const { item: test, lane } of bundle.lanes) {
    const chipY = rowY + ROW_H + BUNDLE_HULL_PAD + lane * TEST_LANE_H;
    const testHovered = hoveredId === test.unique_id;
    const testFocused = focusIds == null || focusIds.has(test.unique_id);
    drawTestChip({
      ctx,
      test,
      chipY,
      maxEnd,
      chartW,
      labelW,
      palette,
      theme,
      emphasis: testFocused ? 1 : 0.18,
      isHovered: testHovered,
    });
  }
}

// ---------------------------------------------------------------------------
// Main drawGantt entry point
// ---------------------------------------------------------------------------

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
  /** Whether to render test chips inside bundles. */
  showTests?: boolean;
}

export function drawGantt(
  canvas: HTMLCanvasElement,
  bundles: BundleRow[],
  rowOffsets: number[],
  rowHeights: number[],
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
    showTests = true,
  }: DrawGanttParams,
) {
  const prepared = initGanttCanvas(canvas, labelW);
  if (!prepared) return;

  const { ctx, w, h, chartW } = prepared;
  const palette = getCanvasColors(theme);

  drawGanttAxisTicks({
    ctx,
    labelW,
    chartW,
    h,
    maxEnd,
    displayMode,
    runStartedAt,
    timeZone,
    palette,
  });

  if (bundles.length === 0) return;

  const contentH = h - AXIS_TOP;
  const visStart = findFirstVisible(rowOffsets, scrollTop);
  const visEnd = findLastVisible(rowOffsets, rowHeights, scrollTop, contentH);

  ctx.textBaseline = "middle";

  for (let i = visStart; i <= visEnd; i++) {
    const bundle = bundles[i];
    if (!bundle) continue;
    const rowY = AXIS_TOP + (rowOffsets[i] ?? 0) - scrollTop;
    drawGanttVisibleRow({
      ctx,
      bundle,
      rowIndex: i,
      rowY,
      w,
      labelW,
      chartW,
      maxEnd,
      focusIds,
      hoveredId,
      displayMode,
      runStartedAt,
      timeZone,
      theme,
      palette,
      testStatsById,
      showTests,
    });
  }
}

// ---------------------------------------------------------------------------
// Visibility helpers
// ---------------------------------------------------------------------------

/** Find the index of the first bundle whose row is within the viewport. */
export function findFirstVisible(
  rowOffsets: number[],
  scrollTop: number,
): number {
  if (rowOffsets.length === 0) return 0;
  let lo = 0,
    hi = rowOffsets.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if ((rowOffsets[mid] ?? 0) < scrollTop) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  // Back up one step — the bundle just above the viewport may still be visible
  return Math.max(0, lo - 1);
}

/** Find the index of the last bundle whose row is at least partially visible. */
export function findLastVisible(
  rowOffsets: number[],
  rowHeights: number[],
  scrollTop: number,
  contentH: number,
): number {
  const bottom = scrollTop + contentH;
  let result = 0;
  for (let i = 0; i < rowOffsets.length; i++) {
    const offset = rowOffsets[i] ?? 0;
    const rowEnd = offset + (rowHeights[i] ?? ROW_H);
    if (rowEnd <= scrollTop) continue; // entirely above viewport
    if (offset >= bottom) break; // entirely below viewport
    result = i;
  }
  return result;
}
