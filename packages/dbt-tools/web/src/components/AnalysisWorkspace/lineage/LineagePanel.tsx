import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import type { AnalysisState, ResourceNode } from "@web/types";
import { PILL_BASE } from "@web/lib/analysis-workspace/constants";
import {
  type LineageDisplayMode,
  buildLineageGraphModel,
} from "@web/lib/analysis-workspace/lineageModel";
import type { LensMode } from "@web/lib/analysis-workspace/types";
import { SectionCard, formatResourceTypeLabel } from "../shared";
import { DepthStepper, SharedDepthSelector } from "./LineageDepthControls";
import { LensSelector } from "./LensSelector";
import { LineageGraphSurface } from "./LineageGraphSurface";

export function LineagePanel({
  resource,
  dependencySummary,
  dependencyIndex,
  resourceById,
  upstreamDepth,
  downstreamDepth,
  allDepsMode,
  lensMode,
  activeLegendKeys,
  setUpstreamDepth,
  setDownstreamDepth,
  setAllDepsMode,
  setLensMode,
  setActiveLegendKeys,
  onSelectResource,
  displayMode = "focused",
}: {
  resource: ResourceNode;
  dependencySummary: AnalysisState["dependencyIndex"][string] | undefined;
  dependencyIndex: AnalysisState["dependencyIndex"];
  resourceById: Map<string, ResourceNode>;
  upstreamDepth: number;
  downstreamDepth: number;
  allDepsMode: boolean;
  lensMode: LensMode;
  activeLegendKeys: Set<string>;
  setUpstreamDepth: Dispatch<SetStateAction<number>>;
  setDownstreamDepth: Dispatch<SetStateAction<number>>;
  setAllDepsMode: Dispatch<SetStateAction<boolean>>;
  setLensMode: (mode: LensMode) => void;
  setActiveLegendKeys: Dispatch<SetStateAction<Set<string>>>;
  onSelectResource: (id: string) => void;
  displayMode?: LineageDisplayMode;
}) {
  const [isFullscreenOpen, setFullscreenOpen] = useState(false);
  const ALL_DEPS_DEPTH = 20;

  const toggleLegendKey = (key: string) => {
    setActiveLegendKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const graphModel = useMemo(
    () =>
      buildLineageGraphModel({
        resource,
        dependencySummary,
        dependencyIndex,
        resourceById,
        upstreamDepth: allDepsMode ? ALL_DEPS_DEPTH : upstreamDepth,
        downstreamDepth: allDepsMode ? ALL_DEPS_DEPTH : downstreamDepth,
        displayMode,
      }),
    [
      allDepsMode,
      dependencyIndex,
      dependencySummary,
      displayMode,
      downstreamDepth,
      resource,
      resourceById,
      upstreamDepth,
    ],
  );

  const depthToolbar = (withClose = false) => (
    <div className="lineage-toolbar">
      <LensSelector lensMode={lensMode} setLensMode={setLensMode} />
      <SharedDepthSelector
        upstreamDepth={upstreamDepth}
        downstreamDepth={downstreamDepth}
        allDepsMode={allDepsMode}
        setUpstreamDepth={setUpstreamDepth}
        setDownstreamDepth={setDownstreamDepth}
        setAllDepsMode={setAllDepsMode}
      />
      <DepthStepper
        label="Upstream"
        value={upstreamDepth}
        setValue={setUpstreamDepth}
        disabled={allDepsMode}
      />
      <DepthStepper
        label="Downstream"
        value={downstreamDepth}
        setValue={setDownstreamDepth}
        disabled={allDepsMode}
      />
      {activeLegendKeys.size > 0 && (
        <button
          type="button"
          className={PILL_BASE}
          onClick={() => setActiveLegendKeys(new Set())}
        >
          Clear filters
        </button>
      )}
      {withClose ? (
        <button
          type="button"
          className="workspace-pill"
          onClick={() => setFullscreenOpen(false)}
        >
          Close
        </button>
      ) : (
        displayMode === "focused" && (
          <button
            type="button"
            className="workspace-pill"
            onClick={() => setFullscreenOpen(true)}
          >
            Expand
          </button>
        )
      )}
    </div>
  );

  return (
    <>
      <SectionCard
        title={displayMode === "summary" ? "Lineage graph" : "Lineage"}
        subtitle={
          displayMode === "summary"
            ? undefined
            : `Exact upstream and downstream lineage for ${resource.name}.`
        }
        headerRight={displayMode === "focused" ? depthToolbar() : undefined}
      >
        <div className={`lineage-summary lineage-summary--${displayMode}`}>
          <div className="lineage-summary__stats">
            <div className="lineage-summary__stat">
              <span>Selected resource</span>
              <strong>{formatResourceTypeLabel(resource.resourceType)}</strong>
            </div>
            <div className="lineage-summary__stat">
              <span>Upstream</span>
              <strong>{dependencySummary?.upstreamCount ?? 0}</strong>
            </div>
            <div className="lineage-summary__stat">
              <span>Downstream</span>
              <strong>{dependencySummary?.downstreamCount ?? 0}</strong>
            </div>
          </div>
          <LineageGraphSurface
            model={graphModel}
            onSelectResource={onSelectResource}
            lensMode={lensMode}
            activeLegendKeys={activeLegendKeys}
            onToggleLegendKey={toggleLegendKey}
            displayMode={displayMode}
          />
        </div>
      </SectionCard>

      {isFullscreenOpen && (
        <div className="lineage-dialog" role="dialog" aria-modal="true">
          <button
            type="button"
            className="lineage-dialog__backdrop"
            aria-label="Close lineage graph"
            onClick={() => setFullscreenOpen(false)}
          />
          <section className="lineage-dialog__panel">
            <div className="lineage-dialog__header">
              <div>
                <p className="eyebrow">Lineage</p>
                <h3>{resource.name}</h3>
                <p className="lineage-dialog__subtitle">
                  Exact dependency graph with staged upstream and downstream
                  columns.
                </p>
              </div>
              {depthToolbar(true)}
            </div>
            <LineageGraphSurface
              model={graphModel}
              onSelectResource={onSelectResource}
              lensMode={lensMode}
              activeLegendKeys={activeLegendKeys}
              onToggleLegendKey={toggleLegendKey}
              displayMode="focused"
              fullscreen
            />
          </section>
        </div>
      )}
    </>
  );
}
