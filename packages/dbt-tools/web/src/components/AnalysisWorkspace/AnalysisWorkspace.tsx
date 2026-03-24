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
} from "@web/lib/analysis-workspace/explorerTree";
import { ExplorerPane } from "./ExplorerPane";
import { OverviewView } from "./views/OverviewView";
import { AssetsView } from "./views/AssetsView";
import { ResultsView } from "./views/ResultsView";
import { TimelineView } from "./timeline/TimelineView";

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
}: WorkspaceContentProps) {
  if (activeView === "overview")
    return (
      <OverviewView
        analysis={analysis}
        projectName={
          analysis.projectName ?? deriveProjectName(analysis.executions)
        }
        analysisSource={analysisSource}
        filters={overviewFilters}
        setFilters={onOverviewFiltersChange}
      />
    );
  if (activeView === "catalog")
    return (
      <AssetsView
        analysis={analysis}
        resource={selectedResource}
        onSelectResource={onSelectResource}
        assetViewState={assetViewState}
        onAssetViewStateChange={onAssetViewStateChange}
      />
    );
  if (runsViewState.tab === "timeline")
    return (
      <TimelineView
        analysis={analysis}
        filters={timelineFilters}
        setFilters={onTimelineFiltersChange}
      />
    );
  return (
    <ResultsView
      allRows={analysis.executions}
      tab={runsViewState.kind}
      filters={resultsFilters}
      setFilters={onResultsFiltersChange}
    />
  );
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
}: AnalysisWorkspaceProps) {
  const deferredResourceQuery = useDeferredValue(assetViewState.resourceQuery);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const autoExpansionKeyRef = useRef<string | null>(null);

  // Prefer the authoritative name from manifest metadata; fall back to the
  // heuristic (most-common packageName among executed nodes).
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
    return new Set(selectedLeaf?.parentIds ?? []);
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
    // Only redirect when a previously selected resource is filtered out of
    // view. Don't auto-select on fresh load (selectedResourceId === null) —
    // the tree should start collapsed and the user picks a resource manually.
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

  return (
    <div
      className={`workspace-layout${activeView === "catalog" ? "" : " workspace-layout--full"}`}
    >
      {/* Explorer pane — only visible in Catalog */}
      {activeView === "catalog" && (
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
          {(projectName != null ||
            analysis.invocationId != null ||
            getInvocationTimestamp(analysis) != null) && (
            <div className="workspace-header-meta">
              {projectName != null && (
                <span className="workspace-header-meta__project">
                  {projectName}
                </span>
              )}
              {analysis.invocationId != null && (
                <span
                  className="workspace-header-meta__invocation"
                  title={analysis.invocationId}
                >
                  Invocation {analysis.invocationId}
                </span>
              )}
              {getInvocationTimestamp(analysis) != null && (
                <span className="workspace-header-meta__time">
                  Invocation started{" "}
                  {formatRunStartedAt(getInvocationTimestamp(analysis)!)}
                </span>
              )}
            </div>
          )}
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
        />
      </div>
    </div>
  );
}
