import { type CSSProperties, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import type { ExecutionRow, StatusBreakdownItem, StatusTone } from "@web/types";
import { STATUS_COLORS } from "@web/lib/analysis-workspace/constants";
import {
  buildStatusBreakdownForRows,
  type TypeStatusBreakdown,
} from "@web/lib/analysis-workspace/overviewState";
import { formatSeconds } from "@web/lib/analysis-workspace/utils";
import { formatResourceTypeLabel } from "../../shared";
import { TOGGLE_WRAPPER_STYLE, type HealthViewMode } from "./constants";

function buildTypeStatusBreakdowns(
  executions: ExecutionRow[],
): TypeStatusBreakdown[] {
  const rowsByType = new Map<string, ExecutionRow[]>();
  for (const row of executions) {
    const current = rowsByType.get(row.resourceType) ?? [];
    current.push(row);
    rowsByType.set(row.resourceType, current);
  }

  return [...rowsByType.entries()]
    .map(([resourceType, rows]) => ({
      resourceType,
      count: rows.length,
      duration: rows.reduce((sum, row) => sum + row.executionTime, 0),
      statusBreakdown: buildStatusBreakdownForRows(rows),
    }))
    .sort((a, b) => b.count - a.count);
}

export function TypeStatusDonutCard({ group }: { group: TypeStatusBreakdown }) {
  const statusData = group.statusBreakdown.map((entry) => ({
    name: entry.status,
    value: entry.count,
    tone: entry.tone,
  }));
  const accentTone = group.statusBreakdown[0]?.tone ?? "neutral";

  return (
    <article
      className="type-donut-card"
      style={{ "--type-accent": STATUS_COLORS[accentTone] } as CSSProperties}
    >
      <div className="type-donut-card__title">
        <strong>{formatResourceTypeLabel(group.resourceType)}</strong>
        <span className="type-donut-card__count">{group.count} runs</span>
      </div>
      <div className="type-donut-card__meta">
        <span>{formatSeconds(group.duration)} runtime</span>
      </div>
      <div className="type-donut-card__chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={statusData}
              dataKey="value"
              nameKey="name"
              innerRadius={26}
              outerRadius={42}
              paddingAngle={2}
              strokeWidth={0}
            >
              {statusData.map((entry) => (
                <Cell
                  key={`${group.resourceType}-${entry.name}`}
                  fill={STATUS_COLORS[entry.tone as StatusTone]}
                />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(value: number) => [`${value} runs`, "Count"]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid rgba(35, 42, 52, 0.12)",
                boxShadow: "0 20px 40px rgba(26, 34, 43, 0.14)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="type-donut-card__legend">
        {group.statusBreakdown.map((entry) => (
          <div
            key={`${group.resourceType}-${entry.status}`}
            className="type-donut-card__legend-row"
          >
            <div className="type-donut-card__legend-label">
              <span
                className="legend-row__swatch"
                style={{ background: STATUS_COLORS[entry.tone] }}
              />
              <span>{entry.status}</span>
            </div>
            <div className="type-donut-card__legend-metric">
              <strong>{entry.count}</strong>
              <span>{(entry.share * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export function TypeStatusDonutGrid({
  executions,
}: {
  executions: ExecutionRow[];
}) {
  const groups = buildTypeStatusBreakdowns(executions);

  if (groups.length === 0) {
    return <div className="empty-state">No execution data.</div>;
  }

  return (
    <div className="type-donut-grid">
      {groups.map((group) => (
        <TypeStatusDonutCard key={group.resourceType} group={group} />
      ))}
    </div>
  );
}

export function StatusDonutChart({
  statusData,
  statusBreakdown,
}: {
  statusData: Array<{ name: string; value: number; tone: string }>;
  statusBreakdown: StatusBreakdownItem[];
}) {
  const renderStatusLabel = ({
    cx,
    cy,
    midAngle,
    outerRadius,
    percent,
    name,
  }: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    outerRadius?: number;
    percent?: number;
    name?: string;
  }) => {
    if (
      cx == null ||
      cy == null ||
      midAngle == null ||
      outerRadius == null ||
      percent == null ||
      name == null ||
      percent < 0.08
    ) {
      return null;
    }
    const radians = Math.PI / 180;
    const lineStartRadius = outerRadius + 6;
    const lineEndRadius = outerRadius + 18;
    const x1 = cx + lineStartRadius * Math.cos(-midAngle * radians);
    const y1 = cy + lineStartRadius * Math.sin(-midAngle * radians);
    const x2 = cx + lineEndRadius * Math.cos(-midAngle * radians);
    const y2 = cy + lineEndRadius * Math.sin(-midAngle * radians);
    const toRight = x2 >= cx;
    const x3 = x2 + (toRight ? 12 : -12);

    return (
      <g className="status-donut__callout">
        <path d={`M${x1},${y1} L${x2},${y2} L${x3},${y2}`} />
        <text
          x={x3 + (toRight ? 4 : -4)}
          y={y2}
          textAnchor={toRight ? "start" : "end"}
          dominantBaseline="central"
        >
          {name}
        </text>
      </g>
    );
  };

  return (
    <div className="status-donut">
      <div className="status-donut__chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={statusData}
              dataKey="value"
              nameKey="name"
              innerRadius={56}
              outerRadius={82}
              paddingAngle={3}
              strokeWidth={0}
              labelLine={false}
              label={renderStatusLabel}
            >
              {statusData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={STATUS_COLORS[entry.tone as StatusTone]}
                />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(value: number) => [`${value} runs`, "Count"]}
              contentStyle={{
                borderRadius: 14,
                border: "1px solid rgba(35, 42, 52, 0.12)",
                boxShadow: "0 20px 40px rgba(26, 34, 43, 0.14)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="status-donut__legend">
        {statusBreakdown.map((entry) => (
          <div key={entry.status} className="legend-row">
            <div className="legend-row__label">
              <span
                className="legend-row__swatch"
                style={{ background: STATUS_COLORS[entry.tone] }}
              />
              {entry.status}
            </div>
            <div className="legend-row__value">
              {entry.count} · {formatSeconds(entry.duration)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatusDonutWithData({
  statusBreakdown,
  executions,
}: {
  statusBreakdown: StatusBreakdownItem[];
  executions: ExecutionRow[];
}) {
  const [viewMode, setViewMode] = useState<HealthViewMode>("status");

  const statusData = statusBreakdown.map((entry) => ({
    name: entry.status,
    value: entry.count,
    tone: entry.tone,
  }));

  const toggleButton = (
    <div className="health-toggle">
      <button
        type="button"
        className={viewMode === "status" ? "active" : ""}
        onClick={() => setViewMode("status")}
      >
        By status
      </button>
      <button
        type="button"
        className={viewMode === "type" ? "active" : ""}
        onClick={() => setViewMode("type")}
      >
        By type
      </button>
    </div>
  );

  if (viewMode === "type") {
    return (
      <div>
        <div style={TOGGLE_WRAPPER_STYLE}>{toggleButton}</div>
        <TypeStatusDonutGrid executions={executions} />
      </div>
    );
  }

  if (statusData.length === 0) {
    return (
      <div>
        <div style={TOGGLE_WRAPPER_STYLE}>{toggleButton}</div>
        <div className="empty-state">No execution statuses were recorded.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={TOGGLE_WRAPPER_STYLE}>{toggleButton}</div>
      <StatusDonutChart
        statusData={statusData}
        statusBreakdown={statusBreakdown}
      />
    </div>
  );
}
