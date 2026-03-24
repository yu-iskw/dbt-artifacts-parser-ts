import type { AnalysisState } from "@web/types";
import type { OverviewDerivedState } from "@web/lib/analysis-workspace/overviewState";
import { formatSeconds } from "@web/lib/analysis-workspace/utils";
import { EmptyState } from "../../../EmptyState";

export function OverviewExecutionContextBand({
  derived,
  analysis,
  workerThreadCount,
  modelsCount,
  testsCount,
}: {
  derived: OverviewDerivedState;
  analysis: AnalysisState;
  workerThreadCount: number;
  modelsCount: number;
  testsCount: number;
}) {
  const criticalPathLength = analysis.summary.critical_path?.path.length ?? 0;

  return (
    <div className="overview-band overview-band--context">
      <section className="overview-module overview-module--threads">
        <div className="overview-module__header">
          <h3>Thread distribution</h3>
          <p>The busiest worker lanes in the current execution slice.</p>
        </div>
        {derived.filteredThreadStats.length > 0 ? (
          <div className="thread-list">
            {derived.filteredThreadStats.slice(0, 6).map((entry) => (
              <div key={entry.threadId} className="thread-list__row">
                <div>
                  <strong>{entry.threadId}</strong>
                  <span>{entry.count} nodes</span>
                </div>
                <div>{formatSeconds(entry.totalExecutionTime)}</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="⋯"
            headline="No thread data in slice"
            subtext="No matching executions were found for the current dashboard filters."
          />
        )}
      </section>

      <section className="overview-module overview-module--footprint">
        <div className="overview-module__header">
          <h3>Footprint</h3>
          <p>Filtered execution volume, duration, and worker scale.</p>
        </div>
        <div className="footprint-card">
          <div className="footprint-card__stats">
            <div className="footprint-card__stat">
              <span>Executed</span>
              <strong>{derived.filteredExecutions.length}</strong>
            </div>
            <div className="footprint-card__stat">
              <span>Runtime</span>
              <strong>{formatSeconds(derived.filteredExecutionTime)}</strong>
            </div>
            <div className="footprint-card__stat">
              <span>Worker lanes</span>
              <strong>{workerThreadCount}</strong>
            </div>
            <div className="footprint-card__stat">
              <span>Models</span>
              <strong>{modelsCount}</strong>
            </div>
            <div className="footprint-card__stat">
              <span>Tests</span>
              <strong>{testsCount}</strong>
            </div>
          </div>
          <p className="footprint-card__detail">
            Graph totals remain workspace-wide:{" "}
            {analysis.graphSummary.totalNodes} nodes,{" "}
            {analysis.graphSummary.totalEdges} edges, {criticalPathLength}{" "}
            critical-path nodes.
          </p>
        </div>
      </section>
    </div>
  );
}
