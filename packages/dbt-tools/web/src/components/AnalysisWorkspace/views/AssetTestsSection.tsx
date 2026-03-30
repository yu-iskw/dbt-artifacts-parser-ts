import { useMemo, useState } from "react";
import type { AnalysisState, ResourceNode } from "@web/types";
import type {
  AssetViewState,
  WorkspaceView,
} from "@web/lib/analysis-workspace/types";
import { NOT_EXECUTED } from "@web/lib/analysis-workspace/catalogCopy";
import {
  formatSeconds,
  badgeClassName,
  displayResourcePath,
} from "@web/lib/analysis-workspace/utils";
import { buildSelectedAssetTestEvidence } from "@web/lib/analysis-workspace/explorerTree";
import {
  sortSelectedAssetTests,
  type AssetTestsSortDirection,
  type AssetTestsSortKey,
} from "@web/lib/analysis-workspace/selectedAssetTestsSort";
import { SectionCard, ResourceTypeBadge } from "../shared";

function selectedAssetQualityPosture(
  evidence: ReturnType<typeof buildSelectedAssetTestEvidence>,
): {
  label: string;
  tone: "positive" | "warning" | "neutral";
  detail: string;
} {
  if (evidence.total === 0) {
    return {
      label: "No attached tests",
      tone: "neutral",
      detail:
        "No quality evidence was linked to this asset in the current artifacts.",
    };
  }
  if (evidence.attention > 0) {
    return {
      label: "Attention needed",
      tone: "warning",
      detail: `${evidence.attention} attention item${evidence.attention === 1 ? "" : "s"} across ${evidence.total} attached tests.`,
    };
  }
  return {
    label: "All attached tests passing",
    tone: "positive",
    detail: `${evidence.passing} of ${evidence.total} attached tests passed in the current artifacts.`,
  };
}

function columnHeaderSortUi(
  sortedBy: AssetTestsSortKey,
  columnKey: AssetTestsSortKey,
  direction: AssetTestsSortDirection,
): {
  indicator: string;
  ariaSort: "none" | "ascending" | "descending";
} {
  if (sortedBy !== columnKey) {
    return { indicator: " ", ariaSort: "none" };
  }
  return direction === "asc"
    ? { indicator: "↑", ariaSort: "ascending" }
    : { indicator: "↓", ariaSort: "descending" };
}

function nextSortDirection(
  sortKey: AssetTestsSortKey,
  nextKey: AssetTestsSortKey,
  currentDirection: AssetTestsSortDirection,
): AssetTestsSortDirection {
  if (sortKey === nextKey) {
    return currentDirection === "asc" ? "desc" : "asc";
  }
  return nextKey === "status" || nextKey === "duration" ? "desc" : "asc";
}

const HEADER_COLUMNS = [
  { key: "test", label: "Test", alignEnd: false, testCell: true },
  { key: "status", label: "Status", alignEnd: false, testCell: false },
  { key: "type", label: "Type", alignEnd: false, testCell: false },
  { key: "duration", label: "Duration", alignEnd: true, testCell: false },
  { key: "location", label: "Location", alignEnd: false, testCell: false },
] satisfies ReadonlyArray<{
  key: AssetTestsSortKey;
  label: string;
  alignEnd: boolean;
  testCell: boolean;
}>;

export function AssetTestsSection({
  resource,
  analysis,
  onNavigateTo,
}: {
  resource: ResourceNode;
  analysis: AnalysisState;
  onNavigateTo: (
    view: WorkspaceView,
    options?: {
      resourceId?: string;
      executionId?: string;
      assetTab?: AssetViewState["activeTab"];
      rootResourceId?: string;
    },
  ) => void;
}) {
  const [sortKey, setSortKey] = useState<AssetTestsSortKey>("status");
  const [sortDirection, setSortDirection] =
    useState<AssetTestsSortDirection>("desc");
  const evidence = useMemo(
    () =>
      buildSelectedAssetTestEvidence(
        resource.uniqueId,
        analysis.resources,
        analysis.dependencyIndex,
      ),
    [analysis.dependencyIndex, analysis.resources, resource.uniqueId],
  );
  const qualityPosture = selectedAssetQualityPosture(evidence);
  const sortedTests = useMemo(
    () => sortSelectedAssetTests(evidence.tests, sortKey, sortDirection),
    [evidence.tests, sortDirection, sortKey],
  );

  const setSortFromHeader = (nextKey: AssetTestsSortKey) => {
    setSortDirection((currentDirection) =>
      nextSortDirection(sortKey, nextKey, currentDirection),
    );
    setSortKey(nextKey);
  };

  return (
    <SectionCard
      title="Tests"
      subtitle="Quality evidence and related dependency posture."
    >
      <div className="asset-tests-summary">
        <div className="asset-tests-summary__headline">
          <span className={`tone-badge tone-badge--${qualityPosture.tone}`}>
            {qualityPosture.label}
          </span>
          <p>{qualityPosture.detail}</p>
        </div>
        <div className="asset-tests-summary__metrics" aria-label="Test summary">
          <span className="asset-tests-summary__metric">
            <strong>{evidence.total}</strong>
            <span>Attached tests</span>
          </span>
          <span className="asset-tests-summary__metric">
            <strong>{evidence.passing}</strong>
            <span>Passing</span>
          </span>
          <span className="asset-tests-summary__metric">
            <strong>{evidence.attention}</strong>
            <span>Attention items</span>
          </span>
        </div>
      </div>
      {evidence.tests.length === 0 ? (
        <p className="resource-spotlight__description resource-spotlight__description--muted">
          No attached tests were found for this asset in the current artifacts.
        </p>
      ) : (
        <div className="asset-tests-table" aria-label="Attached tests evidence">
          <div className="asset-tests-table__toolbar">
            <p className="asset-tests-table__caption">
              Compare attached test evidence by status, duration, and source
              location.
            </p>
          </div>
          <div className="asset-tests-table__header" role="row">
            {HEADER_COLUMNS.map(({ key, label, alignEnd, testCell }) => {
              const sortUi = columnHeaderSortUi(sortKey, key, sortDirection);
              return (
                <div
                  key={key}
                  className={`asset-tests-table__cell${testCell ? " asset-tests-table__cell--test" : ""}${alignEnd ? " asset-tests-table__cell--align-end" : ""}`}
                  role="columnheader"
                  aria-sort={sortUi.ariaSort}
                >
                  <button
                    type="button"
                    className={`asset-tests-table__sort-button${alignEnd ? " asset-tests-table__sort-button--align-end" : ""}`}
                    onClick={() => setSortFromHeader(key)}
                  >
                    {label}
                    <span
                      className="asset-tests-table__sort-indicator"
                      aria-hidden="true"
                    >
                      {sortUi.indicator}
                    </span>
                  </button>
                </div>
              );
            })}
            <div
              className="asset-tests-table__cell asset-tests-table__cell--align-end"
              role="columnheader"
            >
              Action
            </div>
          </div>
          <div className="asset-tests-table__body">
            {sortedTests.map((test) => (
              <button
                key={test.uniqueId}
                type="button"
                className="asset-tests-table__row"
                onClick={() =>
                  onNavigateTo("runs", {
                    executionId: test.uniqueId,
                  })
                }
              >
                <div className="asset-tests-table__cell asset-tests-table__cell--test">
                  <strong title={test.name}>{test.name}</strong>
                  <span>{test.packageName || "workspace"}</span>
                </div>
                <div className="asset-tests-table__cell" data-label="Status">
                  <span className={badgeClassName(test.statusTone)}>
                    {test.status ?? NOT_EXECUTED}
                  </span>
                </div>
                <div className="asset-tests-table__cell" data-label="Type">
                  <ResourceTypeBadge resourceType={test.resourceType} />
                </div>
                <div
                  className="asset-tests-table__cell asset-tests-table__cell--align-end"
                  data-label="Duration"
                >
                  {formatSeconds(test.executionTime)}
                </div>
                <div
                  className="asset-tests-table__cell asset-tests-table__cell--location"
                  data-label="Location"
                >
                  {displayResourcePath(test) ?? "No path captured"}
                </div>
                <div
                  className="asset-tests-table__cell asset-tests-table__cell--align-end"
                  data-label="Action"
                >
                  <span className="asset-tests-table__link">Open in Runs</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
