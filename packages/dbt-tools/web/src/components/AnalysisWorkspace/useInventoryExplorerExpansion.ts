import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AssetViewState } from "@web/lib/analysis-workspace/types";
import {
  collectAncestorBranchIdsForResource,
  type ExplorerTreeNode,
} from "@web/lib/analysis-workspace/explorerTree";

/**
 * Expands ancestors for the selected resource (deep links / clicks) and, in
 * project mode with no selection, expands only the project root branch.
 */
export function useInventoryExplorerExpansion(
  explorerTree: ExplorerTreeNode[],
  allBranchIds: Set<string>,
  expandedNodeIds: Set<string>,
  projectName: string | null,
  assetExplorerMode: AssetViewState["explorerMode"],
  assetSelectedResourceId: string | null,
  effectiveSelectedResourceId: string | null,
  onAssetViewStateChange: Dispatch<SetStateAction<AssetViewState>>,
): void {
  useEffect(() => {
    if (explorerTree.length === 0 || effectiveSelectedResourceId == null) {
      return;
    }
    const needed = collectAncestorBranchIdsForResource(
      explorerTree,
      effectiveSelectedResourceId,
    );
    if (needed.size === 0) return;

    onAssetViewStateChange((current) => {
      const missing = [...needed].filter(
        (id) => !current.expandedNodeIds.has(id),
      );
      if (missing.length === 0) return current;
      return {
        ...current,
        expandedNodeIds: new Set([...current.expandedNodeIds, ...needed]),
      };
    });
  }, [explorerTree, onAssetViewStateChange, effectiveSelectedResourceId]);

  useEffect(() => {
    if (assetExplorerMode !== "project") return;
    if (assetSelectedResourceId != null) return;
    if (explorerTree.length === 0) return;
    if (expandedNodeIds.size > 0) return;
    const rootLabel = projectName ?? "Workspace";
    const rootId = `project:branch:${rootLabel}`;
    if (!allBranchIds.has(rootId)) return;

    onAssetViewStateChange((current) => {
      if (current.explorerMode !== "project") return current;
      if (current.selectedResourceId != null) return current;
      if (current.expandedNodeIds.has(rootId)) return current;
      return {
        ...current,
        expandedNodeIds: new Set([...current.expandedNodeIds, rootId]),
      };
    });
  }, [
    allBranchIds,
    assetExplorerMode,
    assetSelectedResourceId,
    expandedNodeIds.size,
    explorerTree.length,
    onAssetViewStateChange,
    projectName,
  ]);
}
