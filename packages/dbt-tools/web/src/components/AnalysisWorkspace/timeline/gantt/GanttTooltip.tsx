import type { ResourceTestStats } from "@web/types";
import { TOOLTIP_LABEL_STYLE } from "./constants";
import { formatMs, formatTimestamp } from "./formatting";
import type { HoverState } from "./hitTest";

function formatMaterializationLabel(raw: string): string {
  return raw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function GanttTooltip({
  hover,
  runStartedAt,
  canShowTimestamps,
  timeZone,
  testStats,
  dependencyEdgeHint,
}: {
  hover: HoverState;
  runStartedAt: number | null | undefined;
  canShowTimestamps: boolean;
  timeZone: string;
  testStats?: ResourceTestStats;
  /** Shown when compact upstream capping hides some direct dependencies. */
  dependencyEdgeHint?: string;
}) {
  return (
    <div
      className="chart-tooltip"
      style={{
        position: "absolute",
        left: hover.x + 16,
        top: hover.y,
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
      {hover.item.materialized ? (
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
      {testStats && testStats.pass + testStats.fail + testStats.error > 0 && (
        <div>
          <span style={TOOLTIP_LABEL_STYLE}>Tests: </span>✓{testStats.pass} · ✗
          {testStats.fail + testStats.error}
        </div>
      )}
      {dependencyEdgeHint && (
        <div style={{ marginTop: "0.35rem" }}>
          <span style={TOOLTIP_LABEL_STYLE}>{dependencyEdgeHint}</span>
        </div>
      )}
    </div>
  );
}
