import type { Dispatch, SetStateAction } from "react";
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
          <EmptyState
            icon="◱"
            headline="Select an asset to inspect"
            subtext="Use the browser panel on the left to find and select a model, source, seed, or other asset."
          />
        </div>
      )}
    </WorkspaceScaffold>
  );
}
