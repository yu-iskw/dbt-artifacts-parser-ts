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
import type { ExplorerTreeRow } from "@web/lib/analysis-workspace/explorerTree";
import {
  ExplorerBranchIcon,
  ResourceTypeIcon,
  formatResourceTypeLabel,
} from "./shared";

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
    <div className="resource-type-summary" aria-label="Resource type summary">
      {types.map(([type, { pass, fail }]) => (
        <span key={type} className="resource-type-summary__item">
          <span className="resource-type-summary__type">
            {formatResourceTypeLabel(type)}
          </span>
          {pass > 0 && (
            <span className="resource-type-summary__pass">✓{pass}</span>
          )}
          {fail > 0 && (
            <span className="resource-type-summary__fail">✗{fail}</span>
          )}
        </span>
      ))}
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

      <label className="workspace-search">
        <span>Search resources</span>
        <input
          value={resourceQuery}
          onChange={(event) => setResourceQuery(event.target.value)}
          placeholder="Filter tree by name, path, type, or id"
        />
      </label>

      <div className="explorer-filter-stack">
        <div className="explorer-filter-group">
          <span className="explorer-filter-group__label">Execution status</span>
          <div className="pill-row">
            {(
              [
                ["all", "All"],
                ["positive", "Success"],
                ["warning", "Warn"],
                ["danger", "Fail"],
                ["neutral", "Not executed"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={status === value ? PILL_ACTIVE : PILL_BASE}
                onClick={() => setStatus(value)}
              >
                {label}
              </button>
            ))}
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

      <ResourceTypeSummaryBar resources={filteredResources} />

      <div className="explorer-tree">
        {treeRows.length > 0 ? (
          treeRows.map(({ node, depth }) => {
            if (node.kind === "branch") {
              const isExpanded = expandedNodeIds.has(node.id);
              return (
                <button
                  key={node.id}
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
                  {node.testStats &&
                    node.testStats.pass +
                      node.testStats.fail +
                      node.testStats.error >
                      0 && (
                      <span className="explorer-tree__test-stats">
                        {node.testStats.pass > 0 && (
                          <span className="explorer-tree__test-stat explorer-tree__test-stat--pass">
                            ✓{node.testStats.pass}
                          </span>
                        )}
                        {(node.testStats.fail > 0 ||
                          node.testStats.error > 0) && (
                          <span className="explorer-tree__test-stat explorer-tree__test-stat--fail">
                            ✗{node.testStats.fail + node.testStats.error}
                          </span>
                        )}
                      </span>
                    )}
                  <span className="explorer-tree__count">{node.count}</span>
                </button>
              );
            }

            const resource = node.resource!;
            return (
              <button
                key={node.id}
                type="button"
                className={
                  resource.uniqueId === selectedResourceId
                    ? "explorer-tree__row explorer-tree__row--leaf explorer-tree__row--active"
                    : "explorer-tree__row explorer-tree__row--leaf"
                }
                style={{ paddingLeft: `${0.9 + depth * 1.05}rem` }}
                onClick={() => setSelectedResourceId(resource.uniqueId)}
                title={resource.uniqueId}
              >
                <span className="explorer-tree__leaf-icon" aria-hidden="true">
                  <ResourceTypeIcon resourceType={resource.resourceType} />
                </span>
                <span className="explorer-tree__resource-body">
                  <span className="explorer-tree__resource-text">
                    <span className="explorer-tree__label">
                      {resource.name}
                    </span>
                    {node.originLabel && (
                      <span className="explorer-tree__origin">
                        {node.originLabel}
                      </span>
                    )}
                  </span>
                  <span className="explorer-tree__resource-type">
                    {formatResourceTypeLabel(resource.resourceType)}
                  </span>
                </span>
                {node.testStats &&
                  node.testStats.pass +
                    node.testStats.fail +
                    node.testStats.error >
                    0 && (
                    <span className="explorer-tree__test-stats">
                      {node.testStats.pass > 0 && (
                        <span className="explorer-tree__test-stat explorer-tree__test-stat--pass">
                          ✓{node.testStats.pass}
                        </span>
                      )}
                      {(node.testStats.fail > 0 ||
                        node.testStats.error > 0) && (
                        <span className="explorer-tree__test-stat explorer-tree__test-stat--fail">
                          ✗{node.testStats.fail + node.testStats.error}
                        </span>
                      )}
                    </span>
                  )}
              </button>
            );
          })
        ) : (
          <EmptyState
            icon="🔍"
            headline="No resources found"
            subtext="Adjust the search query to find matching branches or assets."
          />
        )}
      </div>
    </aside>
  );
}
