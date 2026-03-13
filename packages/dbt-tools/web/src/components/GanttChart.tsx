import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { GanttItem } from "../types";

interface GanttChartProps {
  data: GanttItem[];
}

const STATUS_COLORS: Record<string, string> = {
  success: "#22c55e",
  error: "#ef4444",
  skipped: "#94a3b8",
  "run error": "#ef4444",
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status.toLowerCase()] ?? "#64748b";
}

export function GanttChart({ data }: GanttChartProps) {
  if (data.length === 0) {
    return (
      <div className="empty-state empty-state--chart">
        No Gantt data (run_results may lack timing info)
      </div>
    );
  }

  const maxEnd = Math.max(...data.map((d) => d.end), 0);
  const chartData = data.map((item) => ({
    name: item.name || item.unique_id,
    start: item.start,
    duration: item.duration,
    status: item.status,
  }));

  return (
    <section className="chart-frame">
      <div
        className="chart-frame__viewport"
        style={{ height: Math.max(320, data.length * 24) }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 20, left: 120, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#d9dde4" />
            <XAxis
              type="number"
              tickFormatter={(v) => `${(v / 1000).toFixed(1)}s`}
              domain={[0, maxEnd]}
              tick={{ fill: "#566171", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fill: "#394251", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="chart-tooltip">
                    <div>
                      <strong>{d.name}</strong>
                    </div>
                    <div>Duration: {(d.duration / 1000).toFixed(2)}s</div>
                    <div>Status: {d.status}</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="start" stackId="a" barSize={18} fill="transparent" />
            <Bar dataKey="duration" stackId="a" barSize={18} fill="#3b82f6">
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={getStatusColor(entry.status)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
