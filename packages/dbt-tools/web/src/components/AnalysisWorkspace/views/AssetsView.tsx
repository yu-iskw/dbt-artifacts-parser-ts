import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { EmptyState } from "../../EmptyState";
import type {
  AnalysisState,
  MetricDefinition,
  ResourceNode,
  SemanticModelDefinition,
} from "@web/types";
import type {
  AssetViewState,
  LineageViewState,
  WorkspaceView,
} from "@web/lib/analysis-workspace/types";
import {
  NOT_CAPTURED,
  NOT_EXECUTED,
} from "@web/lib/analysis-workspace/catalogCopy";
import {
  displayResourcePath,
  formatSeconds,
} from "@web/lib/analysis-workspace/utils";
import { SectionCard, ResourceTypeBadge } from "../shared";
import { LineagePanel } from "../lineage/LineagePanel";
import { SqlPanel } from "./AssetsViewSqlPanel";
import { AssetTestsSection } from "./AssetTestsSection";
import { useResourceCode } from "@web/hooks/useResourceCode";
import { Spinner } from "../../ui/Spinner";

type AssetSectionId = Exclude<AssetViewState["activeTab"], "runtime">;

function normalizeAssetSectionId(
  activeTab: AssetViewState["activeTab"],
): AssetSectionId {
  return activeTab === "runtime" ? "summary" : activeTab;
}

function DefinitionList({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  if (values.length === 0) return null;
  return (
    <div className="definition-list">
      <span>{label}</span>
      <div className="definition-list__values">
        {values.map((value) => (
          <span key={value} className="definition-pill">
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function renderMetricDefinition(definition: MetricDefinition): ReactNode {
  return (
    <div className="definition-panel">
      <div className="detail-grid">
        <div className="detail-stat">
          <span>Label</span>
          <strong>{definition.label ?? NOT_CAPTURED}</strong>
        </div>
        <div className="detail-stat">
          <span>Metric type</span>
          <strong>{definition.metricType ?? NOT_CAPTURED}</strong>
        </div>
        <div className="detail-stat">
          <span>Source</span>
          <strong>{definition.sourceReference ?? NOT_CAPTURED}</strong>
        </div>
        <div className="detail-stat">
          <span>Time granularity</span>
          <strong>{definition.timeGranularity ?? NOT_CAPTURED}</strong>
        </div>
      </div>
      {definition.expression && (
        <div className="definition-block">
          <span>Expression</span>
          <pre>{definition.expression}</pre>
        </div>
      )}
      {definition.description && (
        <div className="definition-block">
          <span>Description</span>
          <p>{definition.description}</p>
        </div>
      )}
      <DefinitionList label="Measures" values={definition.measures} />
      <DefinitionList label="Referenced metrics" values={definition.metrics} />
      <DefinitionList label="Filters" values={definition.filters} />
    </div>
  );
}

function renderSemanticModelDefinition(
  definition: SemanticModelDefinition,
): ReactNode {
  return (
    <div className="definition-panel">
      <div className="detail-grid">
        <div className="detail-stat">
          <span>Label</span>
          <strong>{definition.label ?? NOT_CAPTURED}</strong>
        </div>
        <div className="detail-stat">
          <span>Source model</span>
          <strong>{definition.sourceReference ?? NOT_CAPTURED}</strong>
        </div>
        <div className="detail-stat">
          <span>Default time dimension</span>
          <strong>{definition.defaultTimeDimension ?? NOT_CAPTURED}</strong>
        </div>
      </div>
      <DefinitionList label="Entities" values={definition.entities} />
      <DefinitionList label="Measures" values={definition.measures} />
      <DefinitionList label="Dimensions" values={definition.dimensions} />
      {definition.description && (
        <div className="definition-block">
          <span>Description</span>
          <p>{definition.description}</p>
        </div>
      )}
    </div>
  );
}

function assetSqlOrDefinitionBody({
  showsDefinition,
  definition,
  sqlText,
  codeLoading,
  codeError,
}: {
  showsDefinition: boolean;
  definition: ResourceNode["definition"];
  sqlText: string | undefined;
  codeLoading: boolean;
  codeError: string | null;
}): ReactNode {
  if (showsDefinition && definition) {
    return definition.kind === "metric"
      ? renderMetricDefinition(definition)
      : renderSemanticModelDefinition(definition);
  }
  if (codeLoading) {
    return (
      <div className="asset-sql-loading" aria-busy="true">
        <Spinner size={28} label="Loading SQL" />
        <span className="asset-sql-loading__label">Loading SQL…</span>
      </div>
    );
  }
  if (codeError) {
    return (
      <EmptyState icon="⚠" headline="Could not load SQL" subtext={codeError} />
    );
  }
  if (sqlText) {
    return <SqlPanel sql={sqlText} />;
  }
  return (
    <EmptyState
      icon="⌘"
      headline={
        showsDefinition ? "No definition available" : "No SQL available"
      }
      subtext={
        showsDefinition
          ? "This resource does not expose enough definition metadata in the current artifacts."
          : "This resource does not expose compiled or raw SQL in the current artifacts."
      }
    />
  );
}

function AssetSqlOrDefinitionCard({
  showsDefinition,
  definition,
  sqlText,
  codeLoading,
  codeError,
  hasCompiledSql,
}: {
  showsDefinition: boolean;
  definition: ResourceNode["definition"];
  sqlText: string | undefined;
  codeLoading: boolean;
  codeError: string | null;
  hasCompiledSql: boolean;
}) {
  return (
    <SectionCard
      title={showsDefinition ? "Definition" : "SQL"}
      subtitle={
        showsDefinition
          ? definition?.kind === "metric"
            ? "Structured metric definition captured from the manifest."
            : "Structured semantic model definition captured from the manifest."
          : hasCompiledSql
            ? "Compiled SQL for the selected resource."
            : "Raw SQL captured from the manifest."
      }
    >
      {assetSqlOrDefinitionBody({
        showsDefinition,
        definition,
        sqlText,
        codeLoading,
        codeError,
      })}
    </SectionCard>
  );
}

function AssetSummarySection({
  resource,
  dependencySummary,
}: {
  resource: ResourceNode;
  dependencySummary: AnalysisState["dependencyIndex"][string] | undefined;
}) {
  return (
    <SectionCard
      title="Asset summary"
      subtitle="Core execution and discovery context for the selected asset."
    >
      <div className="detail-grid">
        <div className="detail-stat">
          <span>Status</span>
          <strong>{resource.status ?? NOT_EXECUTED}</strong>
        </div>
        <div className="detail-stat">
          <span>Execution time</span>
          <strong>{formatSeconds(resource.executionTime)}</strong>
        </div>
        <div className="detail-stat">
          <span>Thread</span>
          <strong>{resource.threadId ?? "n/a"}</strong>
        </div>
        <div className="detail-stat">
          <span>Path</span>
          <strong>{displayResourcePath(resource) ?? "n/a"}</strong>
        </div>
        <div className="detail-stat">
          <span>Direct upstream</span>
          <strong>{dependencySummary?.upstreamCount ?? 0}</strong>
        </div>
        <div className="detail-stat">
          <span>Direct downstream</span>
          <strong>{dependencySummary?.downstreamCount ?? 0}</strong>
        </div>
      </div>
      {resource.description ? (
        <p className="resource-spotlight__description">
          {resource.description}
        </p>
      ) : (
        <p className="resource-spotlight__description resource-spotlight__description--muted">
          No description was captured for this asset. Catalog-oriented metadata
          can surface here when present in the manifest.
        </p>
      )}
    </SectionCard>
  );
}

export function AssetsView({
  resource,
  analysis,
  onSelectResource,
  assetViewState,
  onAssetViewStateChange,
  lineageViewState,
  onLineageViewStateChange,
  onNavigateTo,
}: {
  resource: ResourceNode | null;
  analysis: AnalysisState;
  onSelectResource: (id: string) => void;
  assetViewState: AssetViewState;
  onAssetViewStateChange: Dispatch<SetStateAction<AssetViewState>>;
  lineageViewState: LineageViewState;
  onLineageViewStateChange: Dispatch<SetStateAction<LineageViewState>>;
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
  const resourceById = useMemo(
    () => new Map(analysis.resources.map((entry) => [entry.uniqueId, entry])),
    [analysis.resources],
  );

  const upstreamDepth = lineageViewState.upstreamDepth;
  const downstreamDepth = lineageViewState.downstreamDepth;
  const allDepsMode = lineageViewState.allDepsMode;
  const lensMode = lineageViewState.lensMode;
  const activeLegendKeys = lineageViewState.activeLegendKeys;

  const setUpstreamDepth: Dispatch<SetStateAction<number>> = (v) =>
    onLineageViewStateChange((cur) => ({
      ...cur,
      upstreamDepth: typeof v === "function" ? v(cur.upstreamDepth) : v,
    }));
  const setDownstreamDepth: Dispatch<SetStateAction<number>> = (v) =>
    onLineageViewStateChange((cur) => ({
      ...cur,
      downstreamDepth: typeof v === "function" ? v(cur.downstreamDepth) : v,
    }));
  const setAllDepsMode: Dispatch<SetStateAction<boolean>> = (v) =>
    onLineageViewStateChange((cur) => ({
      ...cur,
      allDepsMode: typeof v === "function" ? v(cur.allDepsMode) : v,
    }));
  const setLensMode = (mode: LineageViewState["lensMode"]) =>
    onLineageViewStateChange((cur) => ({
      ...cur,
      lensMode: mode,
      activeLegendKeys: new Set(),
    }));
  const setActiveLegendKeys: Dispatch<SetStateAction<Set<string>>> = (value) =>
    onLineageViewStateChange((cur) => ({
      ...cur,
      activeLegendKeys:
        typeof value === "function" ? value(cur.activeLegendKeys) : value,
    }));
  const activeSectionId = normalizeAssetSectionId(assetViewState.activeTab);
  const [isLineageDialogOpen, setLineageDialogOpen] = useState(false);
  const sectionRefs = useRef<Record<AssetSectionId, HTMLElement | null>>({
    summary: null,
    lineage: null,
    sql: null,
    tests: null,
  });

  useEffect(() => {
    if (!resource) return;
    const section = sectionRefs.current[activeSectionId];
    if (!section) return;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    section.scrollIntoView({
      block: "start",
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [activeSectionId, resource]);

  const {
    compiledCode: loadedCompiled,
    rawCode: loadedRaw,
    loading: codeLoading,
    error: codeError,
  } = useResourceCode(resource?.uniqueId ?? null, analysis);

  if (!resource) {
    return (
      <div className="workspace-card">
        <EmptyState
          icon="🔍"
          headline="No resource selected"
          subtext="Adjust the explorer filters or search to find the resource you're looking for."
        />
      </div>
    );
  }

  const dependencySummary = analysis.dependencyIndex[resource.uniqueId];
  const sqlText = loadedCompiled ?? loadedRaw ?? undefined;
  const hasCompiledSql = loadedCompiled != null && loadedCompiled !== "";
  const definition = resource.definition ?? null;
  const showsDefinition =
    definition?.kind === "metric" || definition?.kind === "semantic_model";
  const detailSubtitle = (
    <div className="resource-detail__subtitle">
      <ResourceTypeBadge resourceType={resource.resourceType} />
      <span className="resource-detail__package">
        {resource.packageName || "workspace"}
      </span>
    </div>
  );
  const lineagePanelProps = {
    resource,
    dependencySummary,
    dependencyIndex: analysis.dependencyIndex,
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
    onSelectResource: (id: string) => {
      onSelectResource(id);
      onLineageViewStateChange((current) => ({
        ...current,
        selectedResourceId: id,
      }));
      onAssetViewStateChange((current) => ({
        ...current,
        selectedResourceId: id,
        activeTab: "lineage",
      }));
    },
  } as const;

  return (
    <div className="workspace-view asset-workspace">
      <section className="catalog-detail-hero">
        <div className="catalog-detail-hero__content">
          <p className="eyebrow">Selected asset</p>
          <h3>{resource.name}</h3>
          {detailSubtitle}
        </div>
        <div className="asset-hero__actions" aria-label="Asset actions">
          <button
            type="button"
            className="workspace-pill"
            onClick={() =>
              onNavigateTo("timeline", {
                resourceId: resource.uniqueId,
                executionId: resource.uniqueId,
              })
            }
          >
            Open in Timeline
          </button>
        </div>
      </section>
      <div className="asset-workspace__body">
        <div className="asset-workspace__sections">
          <section
            id="asset-section-summary"
            ref={(node) => {
              sectionRefs.current.summary = node;
            }}
            className="asset-workspace__section"
          >
            <AssetSummarySection
              resource={resource}
              dependencySummary={dependencySummary}
            />
          </section>

          <section
            id="asset-section-lineage"
            ref={(node) => {
              sectionRefs.current.lineage = node;
            }}
            className="asset-workspace__section"
          >
            <LineagePanel
              {...lineagePanelProps}
              displayMode="summary"
              openFullscreen={isLineageDialogOpen}
              onFullscreenChange={setLineageDialogOpen}
            />
          </section>

          <section
            id="asset-section-tests"
            ref={(node) => {
              sectionRefs.current.tests = node;
            }}
            className="asset-workspace__section"
          >
            <AssetTestsSection
              resource={resource}
              analysis={analysis}
              onNavigateTo={onNavigateTo}
            />
          </section>

          <section
            id="asset-section-sql"
            ref={(node) => {
              sectionRefs.current.sql = node;
            }}
            className="asset-workspace__section"
          >
            <AssetSqlOrDefinitionCard
              showsDefinition={showsDefinition}
              definition={definition}
              sqlText={sqlText}
              codeLoading={codeLoading}
              codeError={codeError}
              hasCompiledSql={hasCompiledSql}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
