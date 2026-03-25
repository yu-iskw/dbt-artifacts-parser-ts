import type { Dispatch, SetStateAction } from "react";
import type { AnalysisState, ResourceNode } from "@web/types";
import type { AssetViewState } from "@web/lib/analysis-workspace/types";
import { AssetsView } from "./AssetsView";
import { EmptyState } from "../../EmptyState";

/**
 * Inventory — the "what exists, how is it organized, what should I inspect?" lens.
 *
 * Wraps the existing AssetsView in the new lens-aware layout with a proper
 * lens header. The 3-pane structure (ExplorerPane left | detail center | lineage)
 * is provided by AssetsView + the ExplorerPane rendered by AnalysisWorkspace.
 */
export function InventoryView({
  analysis,
  resource,
  onSelectResource,
  assetViewState,
  onAssetViewStateChange,
}: {
  analysis: AnalysisState;
  resource: ResourceNode | null;
  onSelectResource: (id: string) => void;
  assetViewState: AssetViewState;
  onAssetViewStateChange: Dispatch<SetStateAction<AssetViewState>>;
}) {
  return (
    <div className="workspace-view inventory-view">
      {/* ── Lens header ── */}
      <div className="lens-header">
        <div className="lens-header__title">
          <p className="eyebrow">Workspace lens</p>
          <h2>Inventory</h2>
          <p className="lens-header__desc">
            Browse, filter, and inspect all workspace assets.
          </p>
        </div>
        {analysis.resources.length > 0 && (
          <span className="lens-header__badge">
            {analysis.resources.length} assets
          </span>
        )}
      </div>

      {/* ── Asset detail ── */}
      {resource ? (
        <AssetsView
          analysis={analysis}
          resource={resource}
          onSelectResource={onSelectResource}
          assetViewState={assetViewState}
          onAssetViewStateChange={onAssetViewStateChange}
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
    </div>
  );
}
