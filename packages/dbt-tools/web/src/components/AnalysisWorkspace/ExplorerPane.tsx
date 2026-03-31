import { useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useRef, useState } from "react";
import { EmptyState } from "../EmptyState";
import type { ResourceNode } from "@web/types";
import {
  PILL_ACTIVE,
  PILL_BASE,
  EXPLORER_MODE_LABELS,
  TEST_RESOURCE_TYPES,
} from "@web/lib/analysis-workspace/constants";
import type {
  AssetExplorerMode,
  DashboardStatusFilter,
} from "@web/lib/analysis-workspace/types";
import {
  getResourceOriginLabel,
  testStatsHasAttention,
  type ExplorerTreeRow,
  type TestStats,
} from "@web/lib/analysis-workspace/explorerTree";
import {
  ExplorerBranchIcon,
  ResourceTypeIcon,
  formatResourceTypeLabel,
} from "./shared";

function explorerLeafAriaLabel(resource: ResourceNode): string {
  const typeLabel = formatResourceTypeLabel(resource.resourceType);
  const fileName = getResourceOriginLabel(resource);
  return fileName
    ? `${resource.name}, ${typeLabel}, file ${fileName}`
    : `${resource.name}, ${typeLabel}`;
}

export interface ExplorerPaneProps {
  treeRows: ExplorerTreeRow[];
  filteredResources: ResourceNode[];
  totalResources: number;
  matchedResources: number;
  explorerMode: AssetExplorerMode;
  setExplorerMode: (value: AssetExplorerMode) => void;
  status: DashboardStatusFilter;
  setStatus: (value: DashboardStatusFilter) => void;
  availableResourceTypes: string[];
  activeResourceTypes: Set<string>;
  toggleResourceType: (value: string) => void;
  resourceQuery: string;
  setResourceQuery: (value: string) => void;
  selectedResourceId: string | null;
  expandedNodeIds: Set<string>;
  toggleExpandedNode: (id: string) => void;
  setSelectedResourceId: (id: string | null) => void;
}

const EXPLORER_FILTERS_STORAGE_KEY = "dbt-tools.explorerFiltersExpanded";

/** User-facing copy for explorer metrics; exported for unit tests. */
export const EXPLORER_UI_COPY = {
  resourceTypeSummaryAriaLabel:
    "Run outcomes for executed dbt assets (non-test resources such as models and sources), grouped by resource type. Counts are how many assets succeeded versus had warnings or failures. These are not dbt test pass or fail totals.",
  resourceTypeSummaryTitle:
    "Run outcomes for executed dbt assets by type (excludes tests). Not dbt test pass or fail totals.",
  resourceTypeSummaryItemTitle(typeLabel: string): string {
    return `${typeLabel}: executed asset run outcomes for this type, not dbt test totals.`;
  },
  treeTestStatsTitle:
    "Attention-only rollup of executed dbt test outcomes for this folder or row: failed or errored, warning, and dbt-skipped. Passing tests and tests with no run result (not executed) are not shown here. A test that depends on multiple resources may be counted more than once in folder totals.",
  treeTestStatsBranchAriaLabel:
    "Dbt test attention rollup for resources in this folder: failed or error, warning, and skipped counts only. Passing tests and not-executed tests are not shown. Tests with multiple upstream dependencies may be counted more than once when summed at higher folders.",
  treeTestStatsLeafAriaLabel:
    "Dbt test attention outcomes for this resource: failed or error, warning, and skipped only. Passing tests and not-executed tests are not shown.",
  treeTestStatErrorTitle(count: number): string {
    return `Failed or errored dbt test attachments: ${count}`;
  },
  treeTestStatWarnTitle(count: number): string {
    return `Warning dbt test attachments: ${count}`;
  },
  treeTestStatSkippedTitle(count: number): string {
    return `Dbt skipped or no-op test attachments: ${count}. Folder rollups may count one test multiple times when it depends on several resources.`;
  },
  treeEmptyHeadline: "No resources found",
  treeEmptyDefaultSubtext:
    "Adjust filters or search to find matching branches or assets.",
  treeEmptySearchSubtext: "Try clearing or changing the resource search box.",
  treeEmptyResourceTypesSubtext:
    "One or more dbt resource types are narrowed; add types or reset type filters to see more assets.",
  treeEmptyExecutionFilterSubtext(status: DashboardStatusFilter): string {
    switch (status) {
      case "danger":
        return "Execution status is Fail: only assets with a failed or errored result in this run are shown. Assets without a run row are treated as Not executed, not Fail. For models whose run succeeded but dbt tests failed, use Issues. Try Execution status All, or confirm run results are loaded for this workspace.";
      case "issues":
        return "Execution status is Issues: assets with a failed or errored run result, or with failed, warned, or skipped dbt test attachments in this run. Fail shows execution failures only.";
      case "neutral":
        return "Execution status is Not executed: only assets without a matching run result (or unknown status) are shown. Try All or confirm run results are loaded.";
      case "positive":
        return "Execution status is Success: only successful runs are shown. Try All or adjust other filters.";
      case "warning":
        return "Execution status is Warn: only warned runs are shown. Try All or adjust other filters.";
      case "skipped":
        return "Execution status is Skipped: only skipped runs are shown. Try All or adjust other filters.";
      default:
        return "";
    }
  },
  /** Section heading above run-outcome and problems rows. */
  executionStatusSectionTitle: "Filter by run & tests",
  /** Subheading for the primary run-outcome pill row. */
  executionStatusRunOutcomeSubLabel: "Run outcome",
  /** Subheading for the issues pill (run failure or test attention). */
  executionStatusProblemsSubLabel: "Run + dbt tests",
} as const;

/** Short button labels for execution status filters (filter values unchanged). */
export function executionStatusPillLabel(
  status: DashboardStatusFilter,
): string {
  switch (status) {
    case "all":
      return "All";
    case "positive":
      return "Success";
    case "warning":
      return "Warn";
    case "danger":
      return "Fail (run)";
    case "skipped":
      return "Skipped";
    case "neutral":
      return "Not executed";
    case "issues":
      return "Issues (run or tests)";
    default:
      return status;
  }
}

/** `title` / `aria-description` text aligned with empty-state filter explanations. */
export function executionStatusFilterButtonTitle(
  status: DashboardStatusFilter,
): string {
  if (status === "all") {
    return "Show all assets regardless of run outcome or attached dbt test results.";
  }
  return EXPLORER_UI_COPY.treeEmptyExecutionFilterSubtext(status);
}

/** Composes explorer tree empty copy when filters or search yield zero rows. Exported for unit tests. */
export function buildExplorerTreeEmptySubtext(options: {
  status: DashboardStatusFilter;
  resourceQuery: string;
  activeResourceTypeCount: number;
}): string {
  const parts: string[] = [];
  if (options.status !== "all") {
    parts.push(
      EXPLORER_UI_COPY.treeEmptyExecutionFilterSubtext(options.status),
    );
  }
  if (options.resourceQuery.trim()) {
    parts.push(EXPLORER_UI_COPY.treeEmptySearchSubtext);
  }
  if (options.activeResourceTypeCount > 0) {
    parts.push(EXPLORER_UI_COPY.treeEmptyResourceTypesSubtext);
  }
  if (parts.length === 0) {
    return EXPLORER_UI_COPY.treeEmptyDefaultSubtext;
  }
  return parts.join(" ");
}

export function ExplorerTreeTestStatsGroup({
  testStats,
  variant,
}: {
  testStats: TestStats;
  variant: "branch" | "leaf";
}) {
  if (!testStatsHasAttention(testStats)) return null;
  const ariaLabel =
    variant === "branch"
      ? EXPLORER_UI_COPY.treeTestStatsBranchAriaLabel
      : EXPLORER_UI_COPY.treeTestStatsLeafAriaLabel;
  return (
    <span
      className="explorer-tree__test-stats-wrap"
      role="group"
      aria-label={ariaLabel}
      title={EXPLORER_UI_COPY.treeTestStatsTitle}
    >
      <span className="explorer-tree__test-stats-label" aria-hidden="true">
        Test issues
      </span>
      <span className="explorer-tree__test-stats">
        {testStats.error > 0 && (
          <span
            className="explorer-tree__test-stat explorer-tree__test-stat--fail"
            title={EXPLORER_UI_COPY.treeTestStatErrorTitle(testStats.error)}
          >
            ✗{testStats.error}
          </span>
        )}
        {testStats.warn > 0 && (
          <span
            className="explorer-tree__test-stat explorer-tree__test-stat--warn"
            title={EXPLORER_UI_COPY.treeTestStatWarnTitle(testStats.warn)}
          >
            !{testStats.warn}
          </span>
        )}
        {testStats.skipped > 0 && (
          <span
            className="explorer-tree__test-stat explorer-tree__test-stat--skipped"
            title={EXPLORER_UI_COPY.treeTestStatSkippedTitle(testStats.skipped)}
          >
            −{testStats.skipped}
          </span>
        )}
      </span>
    </span>
  );
}

function getInitialFiltersExpanded(): boolean {
  try {
    const stored = window.localStorage.getItem(EXPLORER_FILTERS_STORAGE_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    // ignore localStorage failures
  }
  return false;
}

function VirtualExplorerRow({
  virtualRow,
  measureRow,
  children,
}: {
  virtualRow: { index: number; start: number };
  measureRow: (el: HTMLDivElement | null) => void;
  children: ReactNode;
}) {
  return (
    <div
      data-index={virtualRow.index}
      ref={measureRow}
      className="explorer-tree__virtual-row"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        transform: `translateY(${virtualRow.start}px)`,
      }}
    >
      {children}
    </div>
  );
}

export function ExplorerModeIcon({ mode }: { mode: AssetExplorerMode }) {
  if (mode === "project") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M3.5 7.5h6l1.8 2h8.7v7.8a1.2 1.2 0 0 1-1.2 1.2H4.7a1.2 1.2 0 0 1-1.2-1.2V8.7a1.2 1.2 0 0 1 1.2-1.2Z" />
      </svg>
    );
  }
  if (mode === "database") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <ellipse cx="12" cy="6.2" rx="6.5" ry="2.7" />
        <path d="M5.5 6.2v5.6c0 1.5 2.9 2.7 6.5 2.7s6.5-1.2 6.5-2.7V6.2" />
        <path d="M5.5 11.8v5.8c0 1.5 2.9 2.7 6.5 2.7s6.5-1.2 6.5-2.7v-5.8" />
      </svg>
    );
  }

  return null;
}

export function ResourceTypeSummaryBar({
  resources,
}: {
  resources: ResourceNode[];
}) {
  const relevant = resources.filter(
    (r) =>
      !TEST_RESOURCE_TYPES.has(r.resourceType) && r.statusTone !== "neutral",
  );
  if (relevant.length === 0) return null;

  const byType = new Map<string, { pass: number; fail: number }>();
  for (const r of relevant) {
    const entry = byType.get(r.resourceType) ?? { pass: 0, fail: 0 };
    if (r.statusTone === "positive") entry.pass++;
    else if (r.statusTone === "danger" || r.statusTone === "warning")
      entry.fail++;
    byType.set(r.resourceType, entry);
  }

  const types = Array.from(byType.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <div
      className="resource-type-summary"
      aria-label={EXPLORER_UI_COPY.resourceTypeSummaryAriaLabel}
      title={EXPLORER_UI_COPY.resourceTypeSummaryTitle}
    >
      {types.map(([type, { pass, fail }]) => {
        const typeLabel = formatResourceTypeLabel(type);
        return (
          <span
            key={type}
            className="resource-type-summary__item"
            title={EXPLORER_UI_COPY.resourceTypeSummaryItemTitle(typeLabel)}
          >
            <span className="resource-type-summary__type">{typeLabel}</span>
            {pass > 0 && (
              <span className="resource-type-summary__pass">✓{pass}</span>
            )}
            {fail > 0 && (
              <span className="resource-type-summary__fail">✗{fail}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function ExplorerTreeList({
  treeRows,
  explorerMode,
  expandedNodeIds,
  toggleExpandedNode,
  selectedResourceId,
  setSelectedResourceId,
  treeEmptyDisplay,
}: {
  treeRows: ExplorerTreeRow[];
  explorerMode: AssetExplorerMode;
  expandedNodeIds: Set<string>;
  toggleExpandedNode: (id: string) => void;
  selectedResourceId: string | null;
  setSelectedResourceId: (id: string | null) => void;
  /** When the tree has no rows, shown instead of the generic search-only message. */
  treeEmptyDisplay?: { headline: string; subtext: string };
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  /** Initial row height guess before `measureElement` runs (see `.explorer-tree__row` in workspace.css). */
  const explorerTreeRowEstimatePx = 46;

  // eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-virtual useVirtualizer
  const virtualizer = useVirtualizer({
    count: treeRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => explorerTreeRowEstimatePx,
    overscan: 16,
  });
  const measureRow = virtualizer.measureElement;

  if (treeRows.length === 0) {
    const headline =
      treeEmptyDisplay?.headline ?? EXPLORER_UI_COPY.treeEmptyHeadline;
    const subtext =
      treeEmptyDisplay?.subtext ?? EXPLORER_UI_COPY.treeEmptyDefaultSubtext;
    return (
      <div ref={scrollRef} className="explorer-tree">
        <EmptyState icon="🔍" headline={headline} subtext={subtext} />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="explorer-tree">
      <div
        className="explorer-tree__virtual-spacer"
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = treeRows[virtualRow.index];
          if (!row) return null;
          const { node, depth } = row;

          if (node.kind === "branch") {
            const isExpanded = expandedNodeIds.has(node.id);
            return (
              <VirtualExplorerRow
                key={virtualRow.key}
                virtualRow={virtualRow}
                measureRow={measureRow}
              >
                <button
                  type="button"
                  className="explorer-tree__row explorer-tree__row--branch"
                  style={{ paddingLeft: `${0.9 + depth * 1.05}rem` }}
                  onClick={() => toggleExpandedNode(node.id)}
                >
                  <span
                    className={`explorer-tree__chevron${isExpanded ? " explorer-tree__chevron--expanded" : ""}`}
                    aria-hidden="true"
                  >
                    ▸
                  </span>
                  <span className="explorer-tree__folder" aria-hidden="true">
                    <ExplorerBranchIcon mode={explorerMode} depth={depth} />
                  </span>
                  <span className="explorer-tree__label">{node.label}</span>
                  {node.testStats && (
                    <ExplorerTreeTestStatsGroup
                      testStats={node.testStats}
                      variant="branch"
                    />
                  )}
                </button>
              </VirtualExplorerRow>
            );
          }

          const resource = node.resource!;
          return (
            <VirtualExplorerRow
              key={virtualRow.key}
              virtualRow={virtualRow}
              measureRow={measureRow}
            >
              <button
                type="button"
                className={
                  resource.uniqueId === selectedResourceId
                    ? "explorer-tree__row explorer-tree__row--leaf explorer-tree__row--active"
                    : "explorer-tree__row explorer-tree__row--leaf"
                }
                style={{ paddingLeft: `${0.9 + depth * 1.05}rem` }}
                onClick={() => setSelectedResourceId(resource.uniqueId)}
                title={resource.uniqueId}
                aria-label={explorerLeafAriaLabel(resource)}
              >
                <span className="explorer-tree__leaf-icon" aria-hidden="true">
                  <ResourceTypeIcon resourceType={resource.resourceType} />
                </span>
                <span className="explorer-tree__resource-body">
                  <span className="explorer-tree__label">{resource.name}</span>
                </span>
                {node.testStats && (
                  <ExplorerTreeTestStatsGroup
                    testStats={node.testStats}
                    variant="leaf"
                  />
                )}
              </button>
            </VirtualExplorerRow>
          );
        })}
      </div>
    </div>
  );
}

export function ExplorerPane({
  treeRows,
  filteredResources,
  totalResources,
  matchedResources,
  explorerMode,
  setExplorerMode,
  status,
  setStatus,
  availableResourceTypes,
  activeResourceTypes,
  toggleResourceType,
  resourceQuery,
  setResourceQuery,
  selectedResourceId,
  expandedNodeIds,
  toggleExpandedNode,
  setSelectedResourceId,
}: ExplorerPaneProps) {
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(
    getInitialFiltersExpanded,
  );
  const setFiltersExpandedPersisted = (next: boolean) => {
    setFiltersExpanded(next);
    try {
      window.localStorage.setItem(EXPLORER_FILTERS_STORAGE_KEY, String(next));
    } catch {
      // ignore localStorage failures
    }
  };
  const activeFilterCount =
    (resourceQuery.trim() ? 1 : 0) +
    (status !== "all" ? 1 : 0) +
    (activeResourceTypes.size > 0 ? 1 : 0);
  const filterSummary =
    activeFilterCount > 0
      ? `${activeFilterCount} active`
      : "Search, status, and type";

  return (
    <aside className="explorer-pane">
      <div className="explorer-pane__header">
        <div>
          <p className="eyebrow">Asset explorer</p>
          <h2>Workspace inventory</h2>
        </div>
        <div className="explorer-pane__count">
          {matchedResources}
          {matchedResources !== totalResources && (
            <span className="explorer-pane__count-subtext">
              of {totalResources}
            </span>
          )}
        </div>
      </div>

      <div
        className="explorer-mode-tabs"
        role="tablist"
        aria-label="Explorer modes"
      >
        {(["project", "database"] as AssetExplorerMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={explorerMode === mode}
            className={
              explorerMode === mode
                ? "explorer-mode-tab explorer-mode-tab--active"
                : "explorer-mode-tab"
            }
            onClick={() => setExplorerMode(mode)}
          >
            <span className="explorer-mode-tab__icon" aria-hidden="true">
              <ExplorerModeIcon mode={mode} />
            </span>
            {EXPLORER_MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      <section className="explorer-filters" aria-label="Explorer filters">
        <button
          type="button"
          className="explorer-filters__toggle"
          aria-expanded={filtersExpanded}
          onClick={() => setFiltersExpandedPersisted(!filtersExpanded)}
        >
          <span className="explorer-filters__toggle-copy">
            <span className="explorer-filters__toggle-label">Filters</span>
            <span className="explorer-filters__toggle-summary">
              {filterSummary}
            </span>
          </span>
          <span className="explorer-filters__toggle-meta">
            {activeFilterCount > 0 && (
              <span className="explorer-filters__badge">
                {activeFilterCount}
              </span>
            )}
            <span
              className={`explorer-filters__chevron${filtersExpanded ? " explorer-filters__chevron--expanded" : ""}`}
              aria-hidden="true"
            >
              ▾
            </span>
          </span>
        </button>

        {filtersExpanded && (
          <div className="explorer-filter-stack">
            <label className="workspace-search">
              <span>Search resources</span>
              <input
                value={resourceQuery}
                onChange={(event) => setResourceQuery(event.target.value)}
                placeholder="Filter tree by name, path, type, or id"
              />
            </label>

            <div className="explorer-filter-group">
              <span className="explorer-filter-group__label">
                {EXPLORER_UI_COPY.executionStatusSectionTitle}
              </span>
              <div className="explorer-status-filters">
                <div className="explorer-status-filters__block">
                  <span
                    className="explorer-status-filters__sublabel"
                    id="explorer-status-run-outcome-label"
                  >
                    {EXPLORER_UI_COPY.executionStatusRunOutcomeSubLabel}
                  </span>
                  <div
                    className="pill-row"
                    role="group"
                    aria-labelledby="explorer-status-run-outcome-label"
                  >
                    {(
                      [
                        "all",
                        "positive",
                        "warning",
                        "danger",
                        "skipped",
                        "neutral",
                      ] as const satisfies readonly DashboardStatusFilter[]
                    ).map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={status === value ? PILL_ACTIVE : PILL_BASE}
                        title={executionStatusFilterButtonTitle(value)}
                        aria-label={`${executionStatusPillLabel(value)}. ${executionStatusFilterButtonTitle(value)}`}
                        onClick={() => setStatus(value)}
                      >
                        {executionStatusPillLabel(value)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="explorer-status-filters__block explorer-status-filters__block--problems">
                  <span
                    className="explorer-status-filters__sublabel"
                    id="explorer-status-problems-label"
                  >
                    {EXPLORER_UI_COPY.executionStatusProblemsSubLabel}
                  </span>
                  <div
                    className="pill-row"
                    role="group"
                    aria-labelledby="explorer-status-problems-label"
                  >
                    <button
                      type="button"
                      className={status === "issues" ? PILL_ACTIVE : PILL_BASE}
                      title={executionStatusFilterButtonTitle("issues")}
                      aria-label={`${executionStatusPillLabel("issues")}. ${executionStatusFilterButtonTitle("issues")}`}
                      onClick={() => setStatus("issues")}
                    >
                      {executionStatusPillLabel("issues")}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {availableResourceTypes.length > 0 && (
              <div className="explorer-filter-group">
                <span className="explorer-filter-group__label">
                  dbt resource type
                </span>
                <div className="pill-row">
                  {availableResourceTypes.map((type) => {
                    const active =
                      activeResourceTypes.size === 0 ||
                      activeResourceTypes.has(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        className={active ? PILL_ACTIVE : PILL_BASE}
                        onClick={() => toggleResourceType(type)}
                      >
                        {formatResourceTypeLabel(type)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <ResourceTypeSummaryBar resources={filteredResources} />

      <ExplorerTreeList
        treeRows={treeRows}
        explorerMode={explorerMode}
        expandedNodeIds={expandedNodeIds}
        toggleExpandedNode={toggleExpandedNode}
        selectedResourceId={selectedResourceId}
        setSelectedResourceId={setSelectedResourceId}
        treeEmptyDisplay={
          treeRows.length === 0
            ? {
                headline: EXPLORER_UI_COPY.treeEmptyHeadline,
                subtext: buildExplorerTreeEmptySubtext({
                  status,
                  resourceQuery,
                  activeResourceTypeCount: activeResourceTypes.size,
                }),
              }
            : undefined
        }
      />
    </aside>
  );
}
