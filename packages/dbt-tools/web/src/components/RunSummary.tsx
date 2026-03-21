import type {
  ExecutionSummary,
  BottleneckResult,
} from "@dbt-tools/core/browser";

interface RunSummaryProps {
  summary: ExecutionSummary;
  bottlenecks: BottleneckResult | undefined;
}

const CARD_BG = "#f8fafc";
const CARD_BORDER = "1px solid #e2e8f0";
const CELL_PADDING = "0.5rem 0.75rem";

const CARD_STYLE = {
  padding: "1rem",
  background: CARD_BG,
  borderRadius: 8,
  border: CARD_BORDER,
};

const TH_STYLE = { padding: CELL_PADDING, fontWeight: 600 };

function formatSeconds(s: number): string {
  return `${s.toFixed(2)}s`;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={CARD_STYLE}>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function BottleneckTable({ bottlenecks }: { bottlenecks: BottleneckResult }) {
  const cellStyle = { padding: CELL_PADDING };
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 14,
        background: "#fff",
        border: CARD_BORDER,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <thead>
        <tr style={{ background: CARD_BG }}>
          <th style={{ ...TH_STYLE, textAlign: "left" }}>#</th>
          <th style={{ ...TH_STYLE, textAlign: "left" }}>Node</th>
          <th style={{ ...TH_STYLE, textAlign: "right" }}>Time</th>
          <th style={{ ...TH_STYLE, textAlign: "right" }}>% of Total</th>
        </tr>
      </thead>
      <tbody>
        {bottlenecks.nodes.map((node) => (
          <tr key={node.unique_id} style={{ borderTop: CARD_BORDER }}>
            <td style={cellStyle}>{node.rank}</td>
            <td style={cellStyle}>{node.name ?? node.unique_id}</td>
            <td style={{ ...cellStyle, textAlign: "right" }}>
              {formatSeconds(node.execution_time)}
            </td>
            <td style={{ ...cellStyle, textAlign: "right" }}>
              {node.pct_of_total}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RunSummary({ summary, bottlenecks }: RunSummaryProps) {
  const statusEntries = Object.entries(summary.nodes_by_status);

  return (
    <section style={{ marginBottom: "2rem" }}>
      <h2 style={{ marginBottom: "1rem", fontSize: "1.25rem" }}>Run Summary</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "1rem",
        }}
      >
        <StatCard
          label="Total Time"
          value={formatSeconds(summary.total_execution_time)}
        />
        <StatCard label="Total Nodes" value={summary.total_nodes} />
        {statusEntries.map(([status, count]) => (
          <StatCard key={status} label={status} value={count} />
        ))}
      </div>

      {bottlenecks && bottlenecks.nodes.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
            Top Bottlenecks
          </h3>
          <BottleneckTable bottlenecks={bottlenecks} />
        </div>
      )}
    </section>
  );
}
