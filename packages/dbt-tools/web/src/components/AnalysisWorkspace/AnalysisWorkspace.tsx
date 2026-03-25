import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AnalysisState, ResourceNode } from "@web/types";
import {
  type AnalysisWorkspaceProps,
  type AssetViewState,
  type RunsViewState,
  type OverviewFilterState,
  type ResultsFilterState,
  type TimelineFilterState,
  type WorkspaceView,
  type ExecutionViewState,
  type QualityFilterState,
  type DependenciesViewState,
  type SearchViewState,
} from "@web/lib/analysis-workspace/types";
import {
  deriveProjectName,
  getInvocationTimestamp,
  formatRunStartedAt,
  matchesAssetStatus,
  matchesAssetResourceType,
  matchesResource,
  isMainProjectResource,
} from "@web/lib/analysis-workspace/utils";
import {
  buildExplorerTree,
  collectBranchIds,
  collectLeafIds,
  findNodeByLeafResourceId,
  flattenExplorerTree,
  type ExplorerTreeNode,
} from "@web/lib/analysis-workspace/explorerTree";
import { ExplorerPane } from "./ExplorerPane";
import { OverviewView } from "./views/OverviewView";
import { HealthView } from "./views/HealthView";
import { InventoryView } from "./views/InventoryView";
import { ExecutionView } from "./views/ExecutionView";
import { QualityView } from "./views/QualityView";
import { DependenciesView } from "./views/DependenciesView";
import { SearchView } from "./views/SearchView";
import { AssetsView } from "./views/AssetsView";
import { ResultsView } from "./views/ResultsView";
import { TimelineView } from "./timeline/TimelineView";
import { useRunsResultsSource } from "@web/hooks/useRunsResultsSource";

interface WorkspaceContentProps {
  activeView: WorkspaceView;
  analysis: AnalysisState;
  selectedResource: ResourceNode | null;
  onSelectResource: (id: string) => void;
  analysisSource: "preload" | "upload" | null;
  overviewFilters: OverviewFilterState;
  onOverviewFiltersChange: Dispatch<SetStateAction<OverviewFilterState>>;
  resultsFilters: ResultsFilterState;
  onResultsFiltersChange: Dispatch<SetStateAction<ResultsFilterState>>;
  timelineFilters: TimelineFilterState;
  onTimelineFiltersChange: Dispatch<SetStateAction<TimelineFilterState>>;
  assetViewState: AssetViewState;
  onAssetViewStateChange: Dispatch<SetStateAction<AssetViewState>>;
  runsViewState: RunsViewState;
  executionViewState: ExecutionViewState;
  onExecutionViewStateChange: Dispatch<SetStateAction<ExecutionViewState>>;
  qualityFilters: QualityFilterState;
  onQualityFiltersChange: Dispatch<SetStateAction<QualityFilterState>>;
  dependenciesViewState: DependenciesViewState;
  onDependenciesViewStateChange: Dispatch<SetStateAction<DependenciesViewState>>;
  searchViewState: SearchViewState;
  onSearchViewStateChange: Dispatch<SetStateAction<SearchViewState>>;
  onNavigateTo: (view: WorkspaceView, resourceId?: string) => void;
  workspaceSignals: AnalysisWorkspaceProps["workspaceSignals"];
  projectName: string | null;
}

function WorkspaceContent({
  activeView,
  analysis,
  selectedResource,
  onSelectResource,
  analysisSource,
  overviewFilters,
  onOverviewFiltersChange,
  resultsFilters,
  onResultsFiltersChange,
  timelineFilters,
  onTimelineFiltersChange,
  assetViewState,
  onAssetViewStateChange,
  runsViewState,
  executionViewState,
  onExecutionViewStateChange,
  qualityFilters,
  onQualityFiltersChange,
  dependenciesViewState,
  onDependenciesViewStateChange,
  searchViewState,
  onSearchViewStateChange,
  onNavigateTo,
  workspaceSignals,
  projectName,
}: WorkspaceContentProps) {
  // Hook must be called unconditionally; only used for legacy "runs" view.
  const runsResults = useRunsResultsSource(
    analysis.executions,
    runsViewState.kind,
    resultsFilters,
    activeView === "runs" && runsViewState.tab === "results",
  );

  // ── New views ──

  if (activeView === "health") {
    return (
      <HealthView
        analysis={analysis}
        projectName={projectName}
        analysisSource={analysisSource}
        filters={overviewFilters}
        setFilters={onOverviewFiltersChange}
        workspaceSignals={workspaceSignals}
      />
    );
  }

  if (activeView === "inventory") {
    return (
      <InventoryView
        analysis={analysis}
        resource={selectedResource}
        onSelectResource={onSelectResource}
        assetViewState={assetViewState}
        onAssetViewStateChange={onAssetViewStateChange}
      />
    );
  }

  if (activeView === "execution") {
    return (
      <ExecutionView
        analysis={analysis}
        executionViewState={executionViewState}
        onExecutionViewStateChange={onExecutionViewStateChange}
        resultsFilters={resultsFilters}
        onResultsFiltersChange={onResultsFiltersChange}
        timelineFilters={timelineFilters}
        onTimelineFiltersChange={onTimelineFiltersChange}
      />
    );
  }

  if (activeView === "quality") {
    return (
      <QualityView
        analysis={analysis}
        filters={qualityFilters}
        setFilters={onQualityFiltersChange}
      />
    );
  }

  if (activeView === "dependencies") {
    return (
      <DependenciesView
        analysis={analysis}
        dependenciesViewState={dependenciesViewState}
        onDependenciesViewStateChange={onDependenciesViewStateChange}
        onNavigateTo={onNavigateTo}
      />
    );
  }

  if (activeView === "search") {
    return (
      <SearchView
        analysis={analysis}
        searchViewState={searchViewState}
        onSearchViewStateChange={onSearchViewStateChange}
        onNavigateTo={onNavigateTo}
      />
    );
  }

  // ── Legacy views (kept for backward compat / URL redirects) ──

  if (activeView === "overview") {
    return (
      <OverviewView
        analysis={analysis}
        projectName={projectName}
        analysisSource={analysisSource}
        filters={overviewFilters}
        setFilters={onOverviewFiltersChange}
      />
    );
  }

  if (activeView === "catalog") {
    return (
      <AssetsView
        analysis={analysis}
        resource={selectedResource}
        onSelectResource={onSelectResource}
        assetViewState={assetViewState}
        onAssetViewStateChange={onAssetViewStateChange}
      />
    );
  }

  // Legacy runs view
  if (runsViewState.tab === "timeline") {
    return (
      <TimelineView
        analysis={analysis}
        filters={timelineFilters}
        setFilters={onTimelineFiltersChange}
      />
    );
  }
  return (
    <ResultsView
      tab={runsViewState.kind}
      filters={resultsFilters}
      setFilters={onResultsFiltersChange}
      rows={runsResults.rows}
      totalMatches={runsResults.totalMatches}
      counts={runsResults.counts}
      totalVisible={runsResults.totalVisible}
      hasMore={runsResults.hasMore}
      isLoading={runsResults.isLoading}
      isIndexing={runsResults.isIndexing}
      error={runsResults.error}
      onLoadMore={runsResults.loadMore}
    />
  );
}

function collectDefaultExpandedBranchIds(
  nodes: ExplorerTreeNode[],
): Set<string> {
  const expanded = new Set<string>();
  const stack = [...nodes];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || node.kind !== "branch") continue;
    stack.push(...node.children);

    if (node.label.toLowerCase() !== "models") continue;
    expanded.add(node.id);
    for (const parentId of node.parentIds) {
      expanded.add(parentId);
    }
  }

  return expanded;
}

function WorkspaceHeaderMeta({
  analysis,
  projectName,
}: {
  analysis: AnalysisState;
  projectName: string | null;
}) {
  const invocationStartedAt = getInvocationTimestamp(analysis);
  if (
    projectName == null &&
    analysis.invocationId == null &&
    invocationStartedAt == null
  ) {
    return null;
  }
  return (
    <div className="workspace-header-meta">
      {projectName != null && (
        <span className="workspace-header-meta__project">{projectName}</span>
      )}
      {analysis.invocationId != null && (
        <span
          className="workspace-header-meta__invocation"
          title={analysis.invocationId}
        >
          Invocation {analysis.invocationId}
        </span>
      )}
      {invocationStartedAt != null && (
        <span className="workspace-header-meta__time">
          Invocation started {formatRunStartedAt(invocationStartedAt)}
        </span>
      )}
    </div>
  );
}

/** Whether the current view uses the catalog/inventory explorer pane. */
function usesExplorerPane(view: WorkspaceView): boolean {
  return view === "catalog" || view === "inventory";
}

export function AnalysisWorkspace({
  analysis,
  activeView,
  activeViewTitle,
  analysisSource,
  overviewFilters,
  onOverviewFiltersChange,
  resultsFilters,
  onResultsFiltersChange,
  timelineFilters,
  onTimelineFiltersChange,
  assetViewState,
  onAssetViewStateChange,
  runsViewState,
  executionViewState,
  onExecutionViewStateChange,
  qualityFilters,
  onQualityFiltersChange,
  dependenciesViewState,
  onDependenciesViewStateChange,
  searchViewState,
  onSearchViewStateChange,
  onNavigateTo,
  workspaceSignals,
}: AnalysisWorkspaceProps) {
  const deferredResourceQuery = useDeferredValue(assetViewState.resourceQuery);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const autoExpansionKeyRef = useRef<string | null>(null);

  const projectName =
    analysis.projectName ?? deriveProjectName(analysis.executions);

  useEffect(() => {
    onAssetViewStateChange((current) => ({
      ...current,
      selectedResourceId:
        analysis.selectedResourceId ?? current.selectedResourceId,
    }));
  }, [analysis.selectedResourceId, onAssetViewStateChange]);

  const scopedExplorerResources = useMemo(() => {
    if (assetViewState.explorerMode !== "project" || projectName == null) {
      return analysis.resources;
    }
    return analysis.resources.filter((resource) =>
      isMainProjectResource(resource, projectName),
    );
  }, [analysis.resources, assetViewState.explorerMode, projectName]);

  const availableAssetResourceTypes = useMemo(
    () =>
      Array.from(
        new Set(
          scopedExplorerResources.map((resource) => resource.resourceType),
        ),
      ).sort(),
    [scopedExplorerResources],
  );

  const explorerResources = scopedExplorerResources.filter(
    (resource) =>
      matchesAssetStatus(resource, assetViewState.status) &&
      matchesAssetResourceType(resource, assetViewState.resourceTypes) &&
      matchesResource(resource, deferredResourceQuery),
  );

  const explorerTree = useMemo(
    () =>
      buildExplorerTree(
        explorerResources,
        assetViewState.explorerMode,
        projectName,
        analysis.dependencyIndex,
      ),
    [
      assetViewState.explorerMode,
      explorerResources,
      projectName,
      analysis.dependencyIndex,
    ],
  );
  const selectedLeaf = useMemo(
    () =>
      findNodeByLeafResourceId(explorerTree, assetViewState.selectedResourceId),
    [assetViewState.selectedResourceId, explorerTree],
  );
  const autoExpandedIds = useMemo(() => {
    if (assetViewState.resourceQuery.trim()) {
      return collectBranchIds(explorerTree);
    }
    const expanded = collectDefaultExpandedBranchIds(explorerTree);
    for (const parentId of selectedLeaf?.parentIds ?? []) {
      expanded.add(parentId);
    }
    return expanded;
  }, [assetViewState.resourceQuery, explorerTree, selectedLeaf]);

  useEffect(() => {
    const autoExpansionKey = [
      assetViewState.explorerMode,
      assetViewState.resourceQuery.trim(),
      assetViewState.selectedResourceId ?? "",
    ].join("::");
    if (autoExpansionKeyRef.current === autoExpansionKey) return;
    autoExpansionKeyRef.current = autoExpansionKey;
    if (autoExpandedIds.size === 0) return;
    queueMicrotask(() => {
      setExpandedNodeIds((current) => {
        const next = new Set(current);
        let changed = false;
        for (const id of autoExpandedIds) {
          if (!next.has(id)) {
            next.add(id);
            changed = true;
          }
        }
        return changed ? next : current;
      });
    });
  }, [
    assetViewState.explorerMode,
    assetViewState.resourceQuery,
    assetViewState.selectedResourceId,
    autoExpandedIds,
  ]);

  const treeRows = useMemo(
    () => flattenExplorerTree(explorerTree, expandedNodeIds),
    [expandedNodeIds, explorerTree],
  );
  const visibleLeafIds = useMemo(
    () => collectLeafIds(explorerTree),
    [explorerTree],
  );
  useEffect(() => {
    if (visibleLeafIds.length === 0) {
      onAssetViewStateChange((current) => ({
        ...current,
        selectedResourceId: null,
      }));
      return;
    }
    if (assetViewState.selectedResourceId === null) return;
    const exists = visibleLeafIds.includes(assetViewState.selectedResourceId);
    if (!exists) {
      onAssetViewStateChange((current) => ({
        ...current,
        selectedResourceId: visibleLeafIds[0],
      }));
    }
  }, [
    assetViewState.selectedResourceId,
    onAssetViewStateChange,
    visibleLeafIds,
  ]);

  const selectedResource =
    analysis.resources.find(
      (resource) => resource.uniqueId === assetViewState.selectedResourceId,
    ) ?? null;

  const showExplorer = usesExplorerPane(activeView);

  return (
    <div
      className={`workspace-layout${showExplorer ? "" : " workspace-layout--full"}`}
    >
      {/* Explorer pane — visible in Catalog and Inventory */}
      {showExplorer && (
        <ExplorerPane
          treeRows={treeRows}
          filteredResources={explorerResources}
          totalResources={scopedExplorerResources.length}
          matchedResources={visibleLeafIds.length}
          explorerMode={assetViewState.explorerMode}
          setExplorerMode={(value) =>
            onAssetViewStateChange((current) => ({
              ...current,
              explorerMode: value,
            }))
          }
          status={assetViewState.status}
          setStatus={(value) =>
            onAssetViewStateChange((current) => ({
              ...current,
              status: value,
            }))
          }
          availableResourceTypes={availableAssetResourceTypes}
          activeResourceTypes={assetViewState.resourceTypes}
          toggleResourceType={(value) =>
            onAssetViewStateChange((current) => {
              const next = new Set(current.resourceTypes);
              if (next.has(value)) {
                next.delete(value);
              } else {
                next.add(value);
              }
              return {
                ...current,
                resourceTypes: next,
              };
            })
          }
          resourceQuery={assetViewState.resourceQuery}
          setResourceQuery={(value) =>
            onAssetViewStateChange((current) => ({
              ...current,
              resourceQuery: value,
            }))
          }
          selectedResourceId={assetViewState.selectedResourceId}
          expandedNodeIds={expandedNodeIds}
          toggleExpandedNode={(id) =>
            setExpandedNodeIds((current) => {
              const next = new Set(current);
              if (next.has(id)) {
                next.delete(id);
              } else {
                next.add(id);
              }
              return next;
            })
          }
          setSelectedResourceId={(value) =>
            onAssetViewStateChange((current) => ({
              ...current,
              selectedResourceId: value,
            }))
          }
        />
      )}

      <div className="workspace-main-panel">
        <div className="workspace-toolbar">
          <div>
            <p className="eyebrow">Analysis workspace</p>
            <h2>{activeViewTitle}</h2>
          </div>
          <WorkspaceHeaderMeta analysis={analysis} projectName={projectName} />
        </div>

        <WorkspaceContent
          activeView={activeView}
          analysis={analysis}
          selectedResource={selectedResource}
          onSelectResource={(id) =>
            onAssetViewStateChange((current) => ({
              ...current,
              selectedResourceId: id,
            }))
          }
          analysisSource={analysisSource}
          overviewFilters={overviewFilters}
          onOverviewFiltersChange={onOverviewFiltersChange}
          resultsFilters={resultsFilters}
          onResultsFiltersChange={onResultsFiltersChange}
          timelineFilters={timelineFilters}
          onTimelineFiltersChange={onTimelineFiltersChange}
          assetViewState={assetViewState}
          onAssetViewStateChange={onAssetViewStateChange}
          runsViewState={runsViewState}
          executionViewState={executionViewState}
          onExecutionViewStateChange={onExecutionViewStateChange}
          qualityFilters={qualityFilters}
          onQualityFiltersChange={onQualityFiltersChange}
          dependenciesViewState={dependenciesViewState}
          onDependenciesViewStateChange={onDependenciesViewStateChange}
          searchViewState={searchViewState}
          onSearchViewStateChange={onSearchViewStateChange}
          onNavigateTo={onNavigateTo}
          workspaceSignals={workspaceSignals}
          projectName={projectName}
        />
      </div>
    </div>
  );
}
