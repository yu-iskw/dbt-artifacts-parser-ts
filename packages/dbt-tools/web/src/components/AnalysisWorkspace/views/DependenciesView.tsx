import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";
import type { AnalysisState } from "@web/types";
import type {
  DependenciesViewState,
  WorkspaceView,
} from "@web/lib/analysis-workspace/types";
import { LineagePanel } from "../lineage/LineagePanel";
import { EmptyState } from "../../EmptyState";

/**
 * Dependencies — first-class lineage exploration lens.
 *
 * Elevates the lineage graph from an embedded widget in the Assets/Inventory
 * view to a dedicated workspace for blast-radius and dependency investigation.
 *
 * When no resource is selected, prompts the user to navigate to Inventory and
 * select an asset first.
 */
export function DependenciesView({
  analysis,
  dependenciesViewState,
  onDependenciesViewStateChange,
  onNavigateTo: _onNavigateTo,
}: {
  analysis: AnalysisState;
  dependenciesViewState: DependenciesViewState;
  onDependenciesViewStateChange: Dispatch<SetStateAction<DependenciesViewState>>;
  onNavigateTo: (view: WorkspaceView, resourceId?: string) => void;
}) {
  const resourceById = useMemo(
    () => new Map(analysis.resources.map((r) => [r.uniqueId, r])),
    [analysis.resources],
  );

  const selectedResource =
    dependenciesViewState.selectedResourceId != null
      ? (resourceById.get(dependenciesViewState.selectedResourceId) ?? null)
      : null;

  const dependencySummary =
    selectedResource != null
      ? analysis.dependencyIndex[selectedResource.uniqueId]
      : undefined;

  const setUpstreamDepth: Dispatch<SetStateAction<number>> = (v) =>
    onDependenciesViewStateChange((cur) => ({
      ...cur,
      upstreamDepth:
        typeof v === "function" ? v(cur.upstreamDepth) : v,
    }));

  const setDownstreamDepth: Dispatch<SetStateAction<number>> = (v) =>
    onDependenciesViewStateChange((cur) => ({
      ...cur,
      downstreamDepth:
        typeof v === "function" ? v(cur.downstreamDepth) : v,
    }));

  const setAllDepsMode: Dispatch<SetStateAction<boolean>> = (v) =>
    onDependenciesViewStateChange((cur) => ({
      ...cur,
      allDepsMode: typeof v === "function" ? v(cur.allDepsMode) : v,
    }));

  const setLensMode = (mode: DependenciesViewState["lensMode"]) =>
    onDependenciesViewStateChange((cur) => ({ ...cur, lensMode: mode }));

  const setActiveLegendKeys: Dispatch<SetStateAction<Set<string>>> = (v) =>
    onDependenciesViewStateChange((cur) => ({
      ...cur,
      activeLegendKeys:
        typeof v === "function" ? v(cur.activeLegendKeys) : v,
    }));

  const handleSelectResource = (id: string) =>
    onDependenciesViewStateChange((cur) => ({
      ...cur,
      selectedResourceId: id,
    }));

  return (
    <div className="workspace-view dependencies-view">
      {/* ── Lens header ── */}
      <div className="lens-header">
        <div className="lens-header__title">
          <p className="eyebrow">Workspace lens</p>
          <h2>Dependencies</h2>
          <p className="lens-header__desc">
            Explore upstream and downstream lineage, blast radius, and dependency paths.
          </p>
        </div>
        {selectedResource && (
          <span className="lens-header__badge">
            {selectedResource.name}
          </span>
        )}
      </div>

      {/* ── Content ── */}
      {selectedResource ? (
        <LineagePanel
          resource={selectedResource}
          dependencySummary={dependencySummary}
          dependencyIndex={analysis.dependencyIndex}
          resourceById={resourceById}
          upstreamDepth={dependenciesViewState.upstreamDepth}
          downstreamDepth={dependenciesViewState.downstreamDepth}
          allDepsMode={dependenciesViewState.allDepsMode}
          lensMode={dependenciesViewState.lensMode}
          activeLegendKeys={dependenciesViewState.activeLegendKeys}
          setUpstreamDepth={setUpstreamDepth}
          setDownstreamDepth={setDownstreamDepth}
          setAllDepsMode={setAllDepsMode}
          setLensMode={setLensMode}
          setActiveLegendKeys={setActiveLegendKeys}
          onSelectResource={handleSelectResource}
          displayMode="focused"
        />
      ) : (
        <div className="dependencies-empty-state">
          <EmptyState
            icon="⬡"
            headline="No asset selected"
            subtext="Go to Inventory, select an asset, and use 'Explore dependencies' to open it here — or select from below."
          />
          {analysis.resources.length > 0 && (
            <div className="dependencies-recent-assets">
              <p className="eyebrow">Recent assets</p>
              <div className="dependencies-asset-list">
                {analysis.resources.slice(0, 8).map((r) => (
                  <button
                    key={r.uniqueId}
                    type="button"
                    className="dependencies-asset-btn"
                    onClick={() => handleSelectResource(r.uniqueId)}
                  >
                    <span className="dependencies-asset-btn__type">
                      {r.resourceType}
                    </span>
                    <span className="dependencies-asset-btn__name">
                      {r.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
