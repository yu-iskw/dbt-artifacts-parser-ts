import { useLayoutEffect, useRef, useState } from "react";
import type { ResourceTestStats } from "@web/types";
import { TOOLTIP_LABEL_STYLE } from "./constants";
import { formatMs, formatTimestamp } from "./formatting";
import type { HoverState } from "./hitTest";
import { buildMaterializationTooltipText } from "@web/lib/analysis-workspace/materializationSemanticsUi";

const TOOLTIP_OFFSET_X = 16;
const TOOLTIP_OFFSET_Y = 0;
const TOOLTIP_FRAME_MARGIN = 12;

function formatMaterializationLabel(raw: string): string {
  return raw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function computeTooltipPlacement({
  hoverX,
  hoverY,
  frameWidth,
  frameHeight,
  tooltipWidth,
  tooltipHeight,
  offsetX = TOOLTIP_OFFSET_X,
  offsetY = TOOLTIP_OFFSET_Y,
  margin = TOOLTIP_FRAME_MARGIN,
}: {
  hoverX: number;
  hoverY: number;
  frameWidth: number;
  frameHeight: number;
  tooltipWidth: number;
  tooltipHeight: number;
  offsetX?: number;
  offsetY?: number;
  margin?: number;
}) {
  const usableFrameWidth = Math.max(frameWidth, tooltipWidth + margin * 2);
  const usableFrameHeight = Math.max(frameHeight, tooltipHeight + margin * 2);

  let left = hoverX + offsetX;
  if (left + tooltipWidth > usableFrameWidth - margin) {
    left = hoverX - tooltipWidth - offsetX;
  }

  let top = hoverY + offsetY;
  if (top + tooltipHeight > usableFrameHeight - margin) {
    top = usableFrameHeight - tooltipHeight - margin;
  }

  left = Math.min(
    Math.max(margin, left),
    Math.max(margin, usableFrameWidth - tooltipWidth - margin),
  );
  top = Math.min(
    Math.max(margin, top),
    Math.max(margin, usableFrameHeight - tooltipHeight - margin),
  );

  return { left, top };
}

export function GanttTooltip({
  hover,
  frameWidth,
  frameHeight,
  runStartedAt,
  canShowTimestamps,
  timeZone,
  testStats,
}: {
  hover: HoverState;
  frameWidth: number;
  frameHeight: number;
  runStartedAt: number | null | undefined;
  canShowTimestamps: boolean;
  timeZone: string;
  testStats?: ResourceTestStats;
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(() =>
    computeTooltipPlacement({
      hoverX: hover.x,
      hoverY: hover.y,
      frameWidth,
      frameHeight,
      tooltipWidth: 220,
      tooltipHeight: 160,
    }),
  );

  useLayoutEffect(() => {
    const tooltipEl = tooltipRef.current;
    if (!tooltipEl) return;
    const next = computeTooltipPlacement({
      hoverX: hover.x,
      hoverY: hover.y,
      frameWidth,
      frameHeight,
      tooltipWidth: tooltipEl.offsetWidth,
      tooltipHeight: tooltipEl.offsetHeight,
    });
    setPosition((current) =>
      current.left === next.left && current.top === next.top ? current : next,
    );
  }, [frameHeight, frameWidth, hover.x, hover.y, hover.item.unique_id]);

  return (
    <div
      ref={tooltipRef}
      className="chart-tooltip"
      style={{
        position: "absolute",
        left: position.left,
        top: position.top,
        pointerEvents: "none",
        zIndex: 20,
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: "0.3rem" }}>
        {hover.item.name || hover.item.unique_id}
      </div>
      <div>
        <span style={TOOLTIP_LABEL_STYLE}>Status: </span>
        {hover.item.status}
      </div>
      {hover.item.resourceType && (
        <div>
          <span style={TOOLTIP_LABEL_STYLE}>Type: </span>
          {hover.item.resourceType}
        </div>
      )}
      {hover.item.semantics ? (
        <div style={{ marginTop: "0.25rem", maxWidth: 340 }}>
          <div>
            <span style={TOOLTIP_LABEL_STYLE}>Semantics: </span>
          </div>
          <div
            style={{
              whiteSpace: "pre-wrap",
              fontSize: "0.82rem",
              lineHeight: 1.35,
            }}
          >
            {buildMaterializationTooltipText(hover.item.semantics)}
          </div>
        </div>
      ) : hover.item.materialized ? (
        <div>
          <span style={TOOLTIP_LABEL_STYLE}>Materialization: </span>
          {formatMaterializationLabel(hover.item.materialized)}
        </div>
      ) : null}
      {canShowTimestamps && runStartedAt != null ? (
        <>
          <div>
            <span style={TOOLTIP_LABEL_STYLE}>Start: </span>
            {formatTimestamp(runStartedAt + hover.item.start, timeZone)}
          </div>
          <div>
            <span style={TOOLTIP_LABEL_STYLE}>End: </span>
            {formatTimestamp(runStartedAt + hover.item.end, timeZone)}
          </div>
        </>
      ) : (
        <>
          <div>
            <span style={TOOLTIP_LABEL_STYLE}>Start: </span>+
            {formatMs(hover.item.start)}
          </div>
          <div>
            <span style={TOOLTIP_LABEL_STYLE}>End: </span>+
            {formatMs(hover.item.end)}
          </div>
        </>
      )}
      <div>
        <span style={TOOLTIP_LABEL_STYLE}>Duration: </span>
        {formatMs(hover.item.duration)}
      </div>
      {hover.item.compileStart != null &&
        hover.item.compileEnd != null &&
        hover.item.compileEnd > hover.item.compileStart && (
          <div>
            <span style={TOOLTIP_LABEL_STYLE}>Compile: </span>
            {formatMs(hover.item.compileEnd - hover.item.compileStart)}
          </div>
        )}
      {hover.item.executeStart != null &&
        hover.item.executeEnd != null &&
        hover.item.executeEnd > hover.item.executeStart && (
          <div>
            <span style={TOOLTIP_LABEL_STYLE}>Execute: </span>
            {formatMs(hover.item.executeEnd - hover.item.executeStart)}
          </div>
        )}
      {testStats &&
        testStats.pass +
          testStats.fail +
          testStats.error +
          testStats.warn +
          testStats.skipped >
          0 && (
          <div>
            <span style={TOOLTIP_LABEL_STYLE}>Tests: </span>
            {[
              testStats.pass > 0 ? `✓${testStats.pass}` : null,
              testStats.error > 0 ? `✗${testStats.error}` : null,
              testStats.warn > 0 ? `!${testStats.warn}` : null,
              testStats.skipped > 0 ? `−${testStats.skipped}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}
    </div>
  );
}
