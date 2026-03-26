import type { CSSProperties } from "react";
import {
  STATUS_COLORS,
  getResourceTypeColor,
  getStatusColor,
} from "@web/constants/colors";
import {
  getResourceTypeSoftFill,
  getThemeHex,
} from "@web/constants/themeColors";
import { useSyncedDocumentTheme } from "@web/hooks/useTheme";

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
  /** Whether test chips are currently shown inside bundle rows. */
  showTests?: boolean;
  onToggleShowTests?: () => void;
  /** Whether the view is in failures-only mode. */
  failuresOnly?: boolean;
  onToggleFailuresOnly?: () => void;
  /** Explain bar fill (resource type) vs border (status). */
  showBarEncodingKey?: boolean;
  /** Show compile vs execute phase swatches when run_results include both phases. */
  showCompileExecuteLegend?: boolean;
}

const SWATCH_STYLE: CSSProperties = {
  display: "inline-block",
  width: 10,
  height: 10,
  borderRadius: 2,
  flexShrink: 0,
};

const LEGEND_ITEM_ACTIVE_CLASS = " gantt-legend__item--active";

type ThemeHex = ReturnType<typeof getThemeHex>;

function GanttBarEncodingKey({
  theme,
  themeHex,
  showCompileExecuteLegend,
}: {
  theme: "light" | "dark";
  themeHex: ThemeHex;
  showCompileExecuteLegend?: boolean;
}) {
  const typeFill = getResourceTypeSoftFill("model", theme);
  const statusStroke = getStatusColor("success", theme);
  return (
    <div className="gantt-legend__group gantt-legend__group--bar-key">
      <span className="gantt-legend__label">Bars</span>
      <div className="gantt-legend__bar-key-row">
        <span
          className="gantt-legend__bar-key-swatch"
          style={{
            background: typeFill,
            border: `2px solid ${themeHex.borderDefault}`,
            borderRadius: 3,
          }}
          title="Bar fill follows resource type"
          aria-hidden
        />
        <span className="gantt-legend__bar-key-caption">Fill = type</span>
        <span
          className="gantt-legend__bar-key-swatch"
          style={{
            background: themeHex.bgSoft,
            border: `2px solid ${statusStroke}`,
            borderRadius: 3,
          }}
          title="Bar outline follows run status"
          aria-hidden
        />
        <span className="gantt-legend__bar-key-caption">Border = status</span>
      </div>
      {showCompileExecuteLegend ? (
        <div className="gantt-legend__bar-key-row gantt-legend__bar-key-row--phases">
          <span
            className="gantt-legend__bar-key-swatch"
            style={{
              background:
                theme === "dark"
                  ? "rgba(0, 0, 0, 0.24)"
                  : "rgba(0, 0, 0, 0.12)",
              border: `1px solid ${themeHex.borderDefault}`,
              borderRadius: 2,
            }}
            aria-hidden
          />
          <span className="gantt-legend__bar-key-caption">
            Compile (darker)
          </span>
          <span
            className="gantt-legend__bar-key-swatch"
            style={{
              background: typeFill,
              border: `1px solid ${themeHex.borderDefault}`,
              borderRadius: 2,
            }}
            aria-hidden
          />
          <span className="gantt-legend__bar-key-caption">Execute</span>
        </div>
      ) : null}
    </div>
  );
}

function GanttLegendActionRow({
  themeHex,
  showTests,
  onToggleShowTests,
  failuresOnly,
  onToggleFailuresOnly,
}: {
  themeHex: ThemeHex;
  showTests?: boolean;
  onToggleShowTests?: () => void;
  failuresOnly?: boolean;
  onToggleFailuresOnly?: () => void;
}) {
  if (onToggleShowTests == null && onToggleFailuresOnly == null) {
    return null;
  }

  return (
    <div className="gantt-legend__group gantt-legend__group--actions">
      {onToggleShowTests != null && (
        <button
          type="button"
          className={`gantt-legend__item${showTests ? LEGEND_ITEM_ACTIVE_CLASS : ""}`}
          onClick={onToggleShowTests}
          title={showTests ? "Hide test chips" : "Show test chips"}
          aria-pressed={showTests ?? false}
        >
          <span
            style={{
              ...SWATCH_STYLE,
              background: themeHex.mint,
              borderRadius: 50,
            }}
            aria-hidden
          />
          <span className="gantt-legend__name">Tests</span>
        </button>
      )}
      {onToggleFailuresOnly != null && (
        <button
          type="button"
          className={`gantt-legend__item${failuresOnly ? LEGEND_ITEM_ACTIVE_CLASS : ""}`}
          onClick={onToggleFailuresOnly}
          title={
            failuresOnly
              ? "Show all parent rows"
              : "Show only parents with errors or failing tests"
          }
          aria-pressed={failuresOnly ?? false}
        >
          <span
            style={{
              ...SWATCH_STYLE,
              background: themeHex.rose,
              borderRadius: 50,
            }}
            aria-hidden
          />
          <span className="gantt-legend__name">Failures only</span>
        </button>
      )}
    </div>
  );
}

export function GanttLegend({
  statusCounts,
  typeCounts,
  activeStatuses,
  activeTypes,
  onToggleStatus,
  onToggleType,
  showTests,
  onToggleShowTests,
  failuresOnly,
  onToggleFailuresOnly,
  showBarEncodingKey = true,
  showCompileExecuteLegend = false,
}: GanttLegendProps) {
  const theme = useSyncedDocumentTheme();
  const themeHex = getThemeHex(theme);
  const visibleStatuses = Object.keys(STATUS_COLORS).filter(
    (s) => (statusCounts[s] ?? 0) > 0,
  );
  const visibleTypes = Object.keys(typeCounts)
    .filter((t) => (typeCounts[t] ?? 0) > 0)
    .sort((a, b) => a.localeCompare(b));

  const hasAnything =
    visibleStatuses.length > 0 ||
    visibleTypes.length > 0 ||
    onToggleShowTests != null ||
    onToggleFailuresOnly != null;

  if (!hasAnything) return null;

  return (
    <div className="gantt-legend">
      {showBarEncodingKey ? (
        <GanttBarEncodingKey
          theme={theme}
          themeHex={themeHex}
          showCompileExecuteLegend={showCompileExecuteLegend}
        />
      ) : null}
      {visibleStatuses.length > 0 && (
        <div className="gantt-legend__group">
          <span className="gantt-legend__label">Status</span>
          {visibleStatuses.map((status) => {
            const isActive = activeStatuses?.has(status) ?? false;
            const color = getStatusColor(status, theme);
            const count = statusCounts[status] ?? 0;
            return (
              <button
                key={status}
                type="button"
                className={`gantt-legend__item${isActive ? LEGEND_ITEM_ACTIVE_CLASS : ""}`}
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
            const color = getResourceTypeColor(type, theme);
            const count = typeCounts[type] ?? 0;
            return (
              <button
                key={type}
                type="button"
                className={`gantt-legend__item${isActive ? LEGEND_ITEM_ACTIVE_CLASS : ""}`}
                onClick={() => onToggleType?.(type)}
                title={`${type} (${count})`}
              >
                <span
                  style={{
                    ...SWATCH_STYLE,
                    background: themeHex.bgSoft,
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

      <GanttLegendActionRow
        themeHex={themeHex}
        showTests={showTests}
        onToggleShowTests={onToggleShowTests}
        failuresOnly={failuresOnly}
        onToggleFailuresOnly={onToggleFailuresOnly}
      />
    </div>
  );
}
