import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import type { AnalysisState, ResourceNode } from "@web/types";
import type {
  AssetViewState,
  LineageViewState,
  WorkspaceView,
} from "@web/lib/analysis-workspace/types";
import { AssetsView } from "./AssetsView";
import { EmptyState } from "../../EmptyState";
import { WorkspaceScaffold } from "../shared";

export function InventoryView({
  analysis,
  resource,
  onSelectResource,
  assetViewState,
  onAssetViewStateChange,
  lineageViewState,
  onLineageViewStateChange,
  onInvestigationSelectionChange,
  onNavigateTo,
}: {
  analysis: AnalysisState;
  resource: ResourceNode | null;
  onSelectResource: (id: string) => void;
  assetViewState: AssetViewState;
  onAssetViewStateChange: Dispatch<SetStateAction<AssetViewState>>;
  lineageViewState: LineageViewState;
  onLineageViewStateChange: Dispatch<SetStateAction<LineageViewState>>;
  onInvestigationSelectionChange: Dispatch<
    SetStateAction<{
      selectedResourceId: string | null;
      selectedExecutionId: string | null;
      sourceLens: WorkspaceView | null;
    }>
  >;
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
  const sortedResources = useMemo(
    () => [...analysis.resources].sort((a, b) => a.name.localeCompare(b.name)),
    [analysis.resources],
  );
  const [quickResourceId, setQuickResourceId] = useState("");

  const openLineageForResource = (id: string) => {
    if (!id) return;
    onAssetViewStateChange((c) => ({
      ...c,
      selectedResourceId: id,
      activeTab: "lineage",
    }));
    onLineageViewStateChange((c) => ({
      ...c,
      rootResourceId: id,
      selectedResourceId: id,
    }));
    onInvestigationSelectionChange((c) => ({
      ...c,
      selectedResourceId: id,
      sourceLens: "inventory",
    }));
  };

  return (
    <WorkspaceScaffold
      title="Inventory"
      description="Browse, filter, and inspect all workspace assets."
      className="inventory-view"
      suppressHeader={resource != null}
    >
      {resource ? (
        <AssetsView
          analysis={analysis}
          resource={resource}
          onSelectResource={(id) => {
            onSelectResource(id);
            onInvestigationSelectionChange((current) => ({
              ...current,
              selectedResourceId: id,
              sourceLens: "inventory",
            }));
          }}
          assetViewState={assetViewState}
          onAssetViewStateChange={onAssetViewStateChange}
          lineageViewState={lineageViewState}
          onLineageViewStateChange={onLineageViewStateChange}
          onNavigateTo={onNavigateTo}
        />
      ) : (
        <div className="inventory-empty-state">
          <div className="inventory-empty-state__inner">
            <EmptyState
              icon="◱"
              headline="Select an asset to inspect"
              subtext="Use the browser panel on the left to find and select a model, source, seed, or other asset."
            />
            <div
              className="inventory-empty-state__lineage-pick"
              role="group"
              aria-label="Jump to lineage for an asset"
            >
              <label
                className="inventory-empty-state__lineage-label"
                htmlFor="inventory-lineage-root"
              >
                Or open the lineage graph for an asset
              </label>
              <select
                id="inventory-lineage-root"
                className="inventory-empty-state__lineage-select"
                value={quickResourceId}
                onChange={(e) => setQuickResourceId(e.target.value)}
              >
                <option value="">Choose an asset…</option>
                {sortedResources.map((entry) => (
                  <option key={entry.uniqueId} value={entry.uniqueId}>
                    {entry.name} ({entry.resourceType})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="workspace-pill"
                disabled={!quickResourceId}
                onClick={() => openLineageForResource(quickResourceId)}
              >
                Open lineage graph
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceScaffold>
  );
}
