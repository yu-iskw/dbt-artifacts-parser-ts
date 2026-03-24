import type { ResourceTestStats } from "@web/types";
import { TOOLTIP_LABEL_STYLE } from "./constants";
import { formatMs, formatTimestamp } from "./formatting";
import type { HoverState } from "./hitTest";

export function GanttTooltip({
  hover,
  runStartedAt,
  canShowTimestamps,
  timeZone,
  testStats,
}: {
  hover: HoverState;
  runStartedAt: number | null | undefined;
  canShowTimestamps: boolean;
  timeZone: string;
  testStats?: ResourceTestStats;
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
      {testStats && testStats.pass + testStats.fail + testStats.error > 0 && (
        <div>
          <span style={TOOLTIP_LABEL_STYLE}>Tests: </span>✓{testStats.pass} · ✗
          {testStats.fail + testStats.error}
        </div>
      )}
    </div>
  );
}
