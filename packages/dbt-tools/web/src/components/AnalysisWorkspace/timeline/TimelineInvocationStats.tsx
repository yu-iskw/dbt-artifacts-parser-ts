import { useMemo } from "react";
import type { AnalysisState } from "@web/types";
import { buildInvocationResourceComparison } from "@web/lib/analysis-workspace/invocationResourceStats";
import {
  deriveProjectName,
  formatResourceTypeLabel,
} from "@web/lib/analysis-workspace/utils";

export function TimelineInvocationStats({
  analysis,
}: {
  analysis: AnalysisState;
}) {
  const projectName =
    analysis.projectName ?? deriveProjectName(analysis.executions);

  const rows = useMemo(
    () => buildInvocationResourceComparison(analysis, projectName),
    [analysis, projectName],
  );

  if (rows.length === 0) return null;

  return (
    <div
      className="timeline-invocation-stats"
      role="region"
      aria-label="Invocation resource counts by type"
    >
      <p className="timeline-invocation-stats__title">
        Resource counts (manifest graph vs this run vs timeline rows)
      </p>
      <table className="timeline-invocation-stats__table">
        <thead>
          <tr>
            <th scope="col">Type</th>
            <th scope="col" className="timeline-invocation-stats__num">
              Manifest graph
            </th>
            <th scope="col" className="timeline-invocation-stats__num">
              This run
            </th>
            <th scope="col" className="timeline-invocation-stats__num">
              Timeline
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.resourceType}>
              <th scope="row">{formatResourceTypeLabel(row.resourceType)}</th>
              <td className="timeline-invocation-stats__num">
                {row.graphCount.toLocaleString()}
              </td>
              <td className="timeline-invocation-stats__num">
                {row.runCount.toLocaleString()}
              </td>
              <td className="timeline-invocation-stats__num">
                {row.timelineCount.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="timeline-invocation-stats__note">
        Timeline counts use the same package scope as the type legend. Synthetic
        source rows are described in ADR-0032 (
        <code>
          docs/adr/0032-timeline-includes-dbt-sources-via-snapshot-synthesis.md
        </code>
        ).
      </p>
    </div>
  );
}
