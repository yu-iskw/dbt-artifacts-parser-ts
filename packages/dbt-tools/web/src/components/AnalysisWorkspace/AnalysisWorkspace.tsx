import { useMemo } from "react";
import type {
  AnalysisWorkspaceProps,
  WorkspaceView,
} from "@web/lib/analysis-workspace/types";
import {
  deriveProjectName,
  isMainProjectResource,
  matchesAssetResourceType,
  matchesAssetStatus,
  matchesResource,
} from "@web/lib/analysis-workspace/utils";
import {
  buildExplorerTree,
  collectBranchIds,
  collectLeafIds,
  flattenExplorerTree,
} from "@web/lib/analysis-workspace/explorerTree";
import { ExplorerPane } from "./ExplorerPane";
import { HealthView } from "./views/HealthView";
import { InventoryView } from "./views/InventoryView";
import { TimelineView } from "./timeline/TimelineView";
import { RunsView } from "./views/RunsView";
import { LineageView } from "./views/LineageView";

function usesExplorerPane(view: WorkspaceView): boolean {
  return view === "inventory";
}

function preserveSelectedOrNull(
  visibleLeafIds: string[],
  selectedId: string | null,
) {
  if (!selectedId) return visibleLeafIds[0] ?? null;
  return selectedId;
}

export function AnalysisWorkspace({
  analysis,
  activeView,
  analysisSource,
  overviewFilters,
  onOverviewFiltersChange,
  timelineFilters,
  onTimelineFiltersChange,
  assetViewState,
  onAssetViewStateChange,
  runsViewState,
  onRunsViewStateChange,
  lineageViewState,
  onLineageViewStateChange,
  investigationSelection,
  onInvestigationSelectionChange,
  onNavigateTo,
  workspaceSignals,
}: AnalysisWorkspaceProps) {
  const projectName =
    analysis.projectName ?? deriveProjectName(analysis.executions);

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
      matchesResource(resource, assetViewState.resourceQuery),
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
      analysis.dependencyIndex,
      assetViewState.explorerMode,
      explorerResources,
      projectName,
    ],
  );
  const expandedNodeIds = useMemo(
    () => collectBranchIds(explorerTree),
    [explorerTree],
  );
  const treeRows = useMemo(
    () => flattenExplorerTree(explorerTree, expandedNodeIds),
    [expandedNodeIds, explorerTree],
  );
  const visibleLeafIds = useMemo(
    () => collectLeafIds(explorerTree),
    [explorerTree],
  );
  const selectedResourceId = preserveSelectedOrNull(
    visibleLeafIds,
    assetViewState.selectedResourceId,
  );
  const selectedResource =
    analysis.resources.find(
      (resource) => resource.uniqueId === selectedResourceId,
    ) ?? null;

  const explorerPane = usesExplorerPane(activeView) ? (
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
        onAssetViewStateChange((current) => ({ ...current, status: value }))
      }
      availableResourceTypes={availableAssetResourceTypes}
      activeResourceTypes={assetViewState.resourceTypes}
      toggleResourceType={(value) =>
        onAssetViewStateChange((current) => {
          const next = new Set(current.resourceTypes);
          if (next.has(value)) next.delete(value);
          else next.add(value);
          return { ...current, resourceTypes: next };
        })
      }
      resourceQuery={assetViewState.resourceQuery}
      setResourceQuery={(value) =>
        onAssetViewStateChange((current) => ({
          ...current,
          resourceQuery: value,
        }))
      }
      selectedResourceId={selectedResourceId}
      expandedNodeIds={expandedNodeIds}
      toggleExpandedNode={() => undefined}
      setSelectedResourceId={(value) => {
        onAssetViewStateChange((current) => ({
          ...current,
          selectedResourceId: value,
        }));
        onInvestigationSelectionChange((current) => ({
          ...current,
          selectedResourceId: value,
          sourceLens: "inventory",
        }));
      }}
    />
  ) : null;

  return (
    <div
      className={`workspace-layout${explorerPane ? "" : " workspace-layout--full"}`}
    >
      {explorerPane}
      <div className="workspace-main-panel">
        {activeView === "health" && (
          <HealthView
            analysis={analysis}
            projectName={projectName}
            analysisSource={analysisSource}
            filters={overviewFilters}
            setFilters={onOverviewFiltersChange}
            workspaceSignals={workspaceSignals}
            onNavigateTo={onNavigateTo}
          />
        )}
        {activeView === "inventory" && (
          <InventoryView
            analysis={analysis}
            resource={selectedResource}
            onSelectResource={(id) =>
              onAssetViewStateChange((current) => ({
                ...current,
                selectedResourceId: id,
              }))
            }
            assetViewState={{
              ...assetViewState,
              selectedResourceId,
            }}
            onAssetViewStateChange={onAssetViewStateChange}
            lineageViewState={lineageViewState}
            onLineageViewStateChange={onLineageViewStateChange}
            onInvestigationSelectionChange={onInvestigationSelectionChange}
            onNavigateTo={onNavigateTo}
          />
        )}
        {activeView === "runs" && (
          <RunsView
            analysis={analysis}
            runsViewState={runsViewState}
            onRunsViewStateChange={onRunsViewStateChange}
            onInvestigationSelectionChange={onInvestigationSelectionChange}
            onNavigateTo={onNavigateTo}
          />
        )}
        {activeView === "timeline" && (
          <TimelineView
            analysis={analysis}
            filters={timelineFilters}
            setFilters={onTimelineFiltersChange}
            onInvestigationSelectionChange={onInvestigationSelectionChange}
            onNavigateTo={onNavigateTo}
          />
        )}
        {activeView === "lineage" && (
          <LineageView
            analysis={analysis}
            lineageViewState={lineageViewState}
            onLineageViewStateChange={onLineageViewStateChange}
            investigationSelection={investigationSelection}
            onInvestigationSelectionChange={onInvestigationSelectionChange}
            onNavigateTo={onNavigateTo}
          />
        )}
      </div>
    </div>
  );
}
