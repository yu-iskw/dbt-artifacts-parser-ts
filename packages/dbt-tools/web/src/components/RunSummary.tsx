import type {
  ExecutionSummary,
  BottleneckResult,
} from "@dbt-tools/core/browser";
import { getThemeHex } from "@web/constants/themeColors";
import { useSyncedDocumentTheme } from "@web/hooks/useTheme";

interface RunSummaryProps {
  summary: ExecutionSummary;
  bottlenecks: BottleneckResult | undefined;
}

const CELL_PADDING = "0.5rem 0.75rem";

const TH_STYLE = { padding: CELL_PADDING, fontWeight: 600 };

function formatSeconds(s: number): string {
  return `${s.toFixed(2)}s`;
}

type ThemeHex = ReturnType<typeof getThemeHex>;

function StatCard({
  label,
  value,
  t,
}: {
  label: string;
  value: string | number;
  t: ThemeHex;
}) {
  const cardStyle = {
    padding: "1rem",
    background: t.bg,
    borderRadius: 8,
    border: `1px solid ${t.borderDefault}`,
  };
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 12, color: t.textSoft, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: "1.25rem", fontWeight: 600, color: t.text }}>
        {value}
      </div>
    </div>
  );
}

function BottleneckTable({
  bottlenecks,
  t,
}: {
  bottlenecks: BottleneckResult;
  t: ThemeHex;
}) {
  const cardBorder = `1px solid ${t.borderDefault}`;
  const cellStyle = { padding: CELL_PADDING };
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 14,
        background: t.bgSoft,
        border: cardBorder,
        borderRadius: 8,
        overflow: "hidden",
        color: t.text,
      }}
    >
      <thead>
        <tr style={{ background: t.bg }}>
          <th style={{ ...TH_STYLE, textAlign: "left" }}>#</th>
          <th style={{ ...TH_STYLE, textAlign: "left" }}>Node</th>
          <th style={{ ...TH_STYLE, textAlign: "right" }}>Time</th>
          <th style={{ ...TH_STYLE, textAlign: "right" }}>% of Total</th>
        </tr>
      </thead>
      <tbody>
        {bottlenecks.nodes.map((node) => (
          <tr key={node.unique_id} style={{ borderTop: cardBorder }}>
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
  const theme = useSyncedDocumentTheme();
  const t = getThemeHex(theme);
  const statusEntries = Object.entries(summary.nodes_by_status);

  return (
    <section style={{ marginBottom: "2rem", color: t.text }}>
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
          t={t}
        />
        <StatCard label="Total Nodes" value={summary.total_nodes} t={t} />
        {statusEntries.map(([status, count]) => (
          <StatCard key={status} label={status} value={count} t={t} />
        ))}
      </div>

      {bottlenecks && bottlenecks.nodes.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
            Top Bottlenecks
          </h3>
          <BottleneckTable bottlenecks={bottlenecks} t={t} />
        </div>
      )}
    </section>
  );
}
