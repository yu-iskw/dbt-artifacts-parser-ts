import {
  RESOURCE_TYPE_COLORS,
  STATUS_COLORS,
  getResourceTypeColor,
  getStatusColor,
} from "../constants/colors";

interface GanttLegendProps {
  /** Count per status key (lowercase). Only entries with count > 0 are shown. */
  statusCounts: Record<string, number>;
  /** Count per resource type. Only entries with count > 0 are shown. */
  typeCounts: Record<string, number>;
  /** Optional: when provided, clicking a swatch toggles the corresponding filter. */
  activeStatuses?: Set<string>;
  activeTypes?: Set<string>;
  onToggleStatus?: (status: string) => void;
  onToggleType?: (type: string) => void;
}

const SWATCH_STYLE: React.CSSProperties = {
  display: "inline-block",
  width: 10,
  height: 10,
  borderRadius: 2,
  flexShrink: 0,
};

export function GanttLegend({
  statusCounts,
  typeCounts,
  activeStatuses,
  activeTypes,
  onToggleStatus,
  onToggleType,
}: GanttLegendProps) {
  const visibleStatuses = Object.keys(STATUS_COLORS).filter(
    (s) => (statusCounts[s] ?? 0) > 0,
  );
  const visibleTypes = Object.keys(RESOURCE_TYPE_COLORS).filter(
    (t) => (typeCounts[t] ?? 0) > 0,
  );

  if (visibleStatuses.length === 0 && visibleTypes.length === 0) return null;

  return (
    <div className="gantt-legend">
      {visibleStatuses.length > 0 && (
        <div className="gantt-legend__group">
          <span className="gantt-legend__label">Status</span>
          {visibleStatuses.map((status) => {
            const isActive = activeStatuses?.has(status) ?? false;
            const color = getStatusColor(status);
            const count = statusCounts[status] ?? 0;
            return (
              <button
                key={status}
                type="button"
                className={`gantt-legend__item${isActive ? " gantt-legend__item--active" : ""}`}
                onClick={() => onToggleStatus?.(status)}
                title={`${status} (${count})`}
              >
                <span style={{ ...SWATCH_STYLE, background: color }} />
                <span className="gantt-legend__name">{status}</span>
                <span className="gantt-legend__count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {visibleTypes.length > 0 && (
        <div className="gantt-legend__group">
          <span className="gantt-legend__label">Type</span>
          {visibleTypes.map((type) => {
            const isActive = activeTypes?.has(type) ?? false;
            const color = getResourceTypeColor(type);
            const count = typeCounts[type] ?? 0;
            return (
              <button
                key={type}
                type="button"
                className={`gantt-legend__item${isActive ? " gantt-legend__item--active" : ""}`}
                onClick={() => onToggleType?.(type)}
                title={`${type} (${count})`}
              >
                <span
                  style={{
                    ...SWATCH_STYLE,
                    background: "#e2e8f0",
                    borderLeft: `3px solid ${color}`,
                    borderRadius: 0,
                  }}
                />
                <span className="gantt-legend__name">{type}</span>
                <span className="gantt-legend__count">{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
