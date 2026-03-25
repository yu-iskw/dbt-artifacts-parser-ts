import type { Dispatch, SetStateAction } from "react";
import type { AnalysisState } from "@web/types";
import type {
  InvestigationSelectionState,
  LineageViewState,
  WorkspaceView,
} from "@web/lib/analysis-workspace/types";
import { EntityInspector, WorkspaceScaffold } from "../shared";
import { LineagePanel } from "../lineage/LineagePanel";

export function LineageView({
  analysis,
  lineageViewState,
  onLineageViewStateChange,
  investigationSelection,
  onInvestigationSelectionChange,
  onNavigateTo,
}: {
  analysis: AnalysisState;
  lineageViewState: LineageViewState;
  onLineageViewStateChange: Dispatch<SetStateAction<LineageViewState>>;
  investigationSelection: InvestigationSelectionState;
  onInvestigationSelectionChange: Dispatch<
    SetStateAction<InvestigationSelectionState>
  >;
  onNavigateTo: (
    view: WorkspaceView,
    options?: {
      resourceId?: string;
      executionId?: string;
      assetTab?: "summary" | "lineage" | "sql" | "runtime" | "tests";
      rootResourceId?: string;
    },
  ) => void;
}) {
  const resourceById = new Map(
    analysis.resources.map((resource) => [resource.uniqueId, resource]),
  );
  const rootResourceId =
    lineageViewState.rootResourceId ??
    investigationSelection.selectedResourceId;
  const resource = rootResourceId
    ? (resourceById.get(rootResourceId) ?? null)
    : null;
  const selectedNode =
    lineageViewState.selectedResourceId != null
      ? (resourceById.get(lineageViewState.selectedResourceId) ?? null)
      : resource;
  const dependencySummary = resource
    ? analysis.dependencyIndex[resource.uniqueId]
    : undefined;

  const inspector = (
    <EntityInspector
      title={selectedNode?.name ?? null}
      typeLabel={selectedNode?.resourceType ?? null}
      status={
        selectedNode?.status ? (
          <span className={`badge badge--${selectedNode.statusTone}`}>
            {selectedNode.status}
          </span>
        ) : undefined
      }
      stats={[
        { label: "Package", value: selectedNode?.packageName ?? "workspace" },
        { label: "Upstream", value: dependencySummary?.upstreamCount ?? 0 },
        { label: "Downstream", value: dependencySummary?.downstreamCount ?? 0 },
      ]}
      sections={[
        { label: "Path", value: selectedNode?.path ?? "n/a" },
        { label: "Unique ID", value: selectedNode?.uniqueId ?? "n/a" },
      ]}
      actions={
        selectedNode
          ? [
              {
                label: "Open asset",
                onClick: () =>
                  onNavigateTo("inventory", {
                    resourceId: selectedNode.uniqueId,
                    assetTab: "summary",
                  }),
              },
              {
                label: "Open related runs",
                onClick: () =>
                  onNavigateTo("runs", {
                    resourceId: selectedNode.uniqueId,
                  }),
              },
              {
                label: "Set as root",
                onClick: () =>
                  onLineageViewStateChange((current) => ({
                    ...current,
                    rootResourceId: selectedNode.uniqueId,
                  })),
              },
            ]
          : undefined
      }
      emptyMessage="Select a node to inspect lineage context"
    />
  );

  const toolbar = (
    <div className="runs-toolbar">
      <label className="workspace-search workspace-search--compact">
        <span>Root asset</span>
        <select
          value={rootResourceId ?? ""}
          onChange={(e) =>
            onLineageViewStateChange((current) => ({
              ...current,
              rootResourceId: e.target.value || null,
              selectedResourceId: e.target.value || null,
            }))
          }
        >
          <option value="">Select asset</option>
          {analysis.resources.slice(0, 100).map((entry) => (
            <option key={entry.uniqueId} value={entry.uniqueId}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <WorkspaceScaffold
      title="Lineage"
      description="Explore upstream and downstream relationships, blast radius, and graph context."
      toolbar={toolbar}
      inspector={inspector}
      className="lineage-view"
    >
      {resource ? (
        <LineagePanel
          resource={resource}
          dependencySummary={dependencySummary}
          dependencyIndex={analysis.dependencyIndex}
          resourceById={resourceById}
          upstreamDepth={lineageViewState.upstreamDepth}
          downstreamDepth={lineageViewState.downstreamDepth}
          allDepsMode={lineageViewState.allDepsMode}
          lensMode={lineageViewState.lensMode}
          activeLegendKeys={lineageViewState.activeLegendKeys}
          setUpstreamDepth={(value) =>
            onLineageViewStateChange((current) => ({
              ...current,
              upstreamDepth:
                typeof value === "function"
                  ? value(current.upstreamDepth)
                  : value,
            }))
          }
          setDownstreamDepth={(value) =>
            onLineageViewStateChange((current) => ({
              ...current,
              downstreamDepth:
                typeof value === "function"
                  ? value(current.downstreamDepth)
                  : value,
            }))
          }
          setAllDepsMode={(value) =>
            onLineageViewStateChange((current) => ({
              ...current,
              allDepsMode:
                typeof value === "function"
                  ? value(current.allDepsMode)
                  : value,
            }))
          }
          setLensMode={(mode) =>
            onLineageViewStateChange((current) => ({
              ...current,
              lensMode: mode,
            }))
          }
          setActiveLegendKeys={(value) =>
            onLineageViewStateChange((current) => ({
              ...current,
              activeLegendKeys:
                typeof value === "function"
                  ? value(current.activeLegendKeys)
                  : value,
            }))
          }
          onSelectResource={(id) => {
            onLineageViewStateChange((current) => ({
              ...current,
              selectedResourceId: id,
            }));
            onInvestigationSelectionChange((current) => ({
              ...current,
              selectedResourceId: id,
              sourceLens: "lineage",
            }));
          }}
          displayMode="focused"
        />
      ) : (
        <div className="dependencies-empty-state">
          Select a root asset to explore lineage.
        </div>
      )}
    </WorkspaceScaffold>
  );
}
