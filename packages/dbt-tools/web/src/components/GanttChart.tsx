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
      <div
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "#666",
          background: "#f8fafc",
          borderRadius: 8,
        }}
      >
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
    <section style={{ marginTop: "2rem" }}>
      <h2 style={{ marginBottom: "1rem", fontSize: "1.25rem" }}>
        Execution Timeline
      </h2>
      <div style={{ height: Math.max(300, data.length * 24), minHeight: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              type="number"
              tickFormatter={(v) => `${(v / 1000).toFixed(1)}s`}
              domain={[0, maxEnd]}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div
                    style={{
                      background: "white",
                      padding: "0.5rem 0.75rem",
                      border: "1px solid #e2e8f0",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
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
