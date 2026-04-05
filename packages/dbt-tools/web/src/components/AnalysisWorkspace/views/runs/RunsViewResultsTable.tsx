import {
  type CSSProperties,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import type { AnalysisState } from "@web/types";
import type {
  InvestigationSelectionState,
  RunsViewState,
} from "@web/lib/analysis-workspace/types";
import type { RunsResultsSourceState } from "@web/hooks/useRunsResultsSource";
import {
  badgeClassName,
  formatSeconds,
} from "@web/lib/analysis-workspace/utils";
import type { RunsAdapterColumn } from "@web/lib/analysis-workspace/runsAdapterColumns";
import {
  getAdapterCellValue,
  getRunsTableTemplate,
} from "./runsViewTableUtils";
import { MaterializationSemanticsBadge } from "../../MaterializationSemanticsBadge";

type RunsResultsState = RunsResultsSourceState;

export function RunsResultsTable({
  analysis,
  runsResults,
  runsViewState,
  resultsBodyRef,
  virtualizer,
  adapterColumns,
  onRunsViewStateChange,
  onInvestigationSelectionChange,
}: {
  analysis: AnalysisState;
  runsResults: RunsResultsState;
  runsViewState: RunsViewState;
  resultsBodyRef: RefObject<HTMLDivElement | null>;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  adapterColumns: RunsAdapterColumn[];
  onRunsViewStateChange: Dispatch<SetStateAction<RunsViewState>>;
  onInvestigationSelectionChange: Dispatch<
    SetStateAction<InvestigationSelectionState>
  >;
}) {
  const tableStyle = {
    "--results-table-columns": getRunsTableTemplate(adapterColumns),
  } as CSSProperties;

  return (
    <div className="results-table" style={tableStyle}>
      <div className="results-table__header">
        <div className="results-table__cell results-table__cell--item">
          Item
        </div>
        <div className="results-table__cell">Type</div>
        <div className="results-table__cell">Materialization</div>
        <div className="results-table__cell">Status</div>
        <div className="results-table__cell results-table__cell--align-end">
          Duration
        </div>
        {adapterColumns.map((column) => (
          <div
            key={column.id}
            className={`results-table__cell${column.align === "end" ? " results-table__cell--align-end" : ""}`}
            title={column.label}
          >
            {column.label}
          </div>
        ))}
        <div className="results-table__cell">Thread</div>
      </div>
      <div
        ref={resultsBodyRef}
        className="results-table__body"
        style={{
          height: Math.min(560, Math.max(120, runsResults.rows.length * 76)),
          overflowY: "auto",
          position: "relative",
        }}
      >
        <div
          style={{ height: virtualizer.getTotalSize(), position: "relative" }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = runsResults.rows[virtualRow.index];
            if (!row) return null;
            const isActive = row.uniqueId === runsViewState.selectedExecutionId;
            return (
              <button
                key={row.uniqueId}
                type="button"
                className={`results-table__row${isActive ? " results-table__row--active" : ""}`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => {
                  const nextResource =
                    analysis.resources.find(
                      (resource) => resource.uniqueId === row.uniqueId,
                    ) ?? null;
                  onRunsViewStateChange((current) => ({
                    ...current,
                    selectedExecutionId: row.uniqueId,
                  }));
                  onInvestigationSelectionChange((current) => ({
                    ...current,
                    selectedExecutionId: row.uniqueId,
                    selectedResourceId: nextResource?.uniqueId ?? row.uniqueId,
                    sourceLens: "runs",
                  }));
                }}
              >
                <div
                  className="results-table__cell results-table__cell--item"
                  data-label="Item"
                  title={row.name}
                >
                  <strong>{row.name}</strong>
                </div>
                <div
                  className="results-table__cell"
                  data-label="Type"
                  title={row.resourceType}
                >
                  {row.resourceType}
                </div>
                <div
                  className="results-table__cell"
                  data-label="Materialization"
                >
                  {row.semantics ? (
                    <MaterializationSemanticsBadge
                      semantics={row.semantics}
                      variant="compact"
                    />
                  ) : (
                    "—"
                  )}
                </div>
                <div className="results-table__cell" data-label="Status">
                  <span className={badgeClassName(row.statusTone)}>
                    {row.status}
                  </span>
                </div>
                <div
                  className="results-table__cell results-table__cell--align-end"
                  data-label="Duration"
                >
                  {formatSeconds(row.executionTime)}
                </div>
                {adapterColumns.map((column) => {
                  const value = getAdapterCellValue(row, column);
                  return (
                    <div
                      key={column.id}
                      className={`results-table__cell${column.align === "end" ? " results-table__cell--align-end" : ""}`}
                      data-label={column.label}
                      title={value}
                    >
                      {value}
                    </div>
                  );
                })}
                <div
                  className="results-table__cell"
                  data-label="Thread"
                  title={row.threadId ?? "n/a"}
                >
                  {row.threadId ?? "n/a"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
