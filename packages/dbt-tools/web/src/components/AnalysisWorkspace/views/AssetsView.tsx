import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useMemo,
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
  LensMode,
} from "@web/lib/analysis-workspace/types";
import { SectionCard, ResourceTypeBadge } from "../shared";
import { LineagePanel } from "../LineageGraphSurface";
import {
  formatSeconds,
  displayResourcePath,
} from "@web/lib/analysis-workspace/utils";

/** Catalog copy when a field is missing from artifacts (sonarjs/no-duplicate-string). */
const NOT_CAPTURED = "Not captured";

// ---------------------------------------------------------------------------
// SQL syntax highlighting — zero-dependency tokenizer
// ---------------------------------------------------------------------------
const SQL_KEYWORDS = new Set(
  "SELECT FROM WHERE WITH AS JOIN ON GROUP BY ORDER LIMIT HAVING UNION CASE WHEN THEN ELSE END LEFT RIGHT INNER OUTER CROSS DISTINCT NULL AND OR NOT IN IS BETWEEN LIKE EXISTS INSERT INTO UPDATE SET DELETE CREATE TABLE VIEW REPLACE IF ASC DESC USING AT ZONE INTERVAL QUALIFY WINDOW ROWS RANGE UNBOUNDED PRECEDING FOLLOWING CURRENT ROW PARTITION OVER".split(
    " ",
  ),
);
const SQL_FUNCTIONS = new Set(
  "SUM COUNT AVG MAX MIN COALESCE CAST IFF IF ROW_NUMBER RANK DENSE_RANK NTILE LEAD LAG FIRST_VALUE LAST_VALUE NVL NVL2 NULLIF GREATEST LEAST TRIM LTRIM RTRIM UPPER LOWER LENGTH SUBSTR SUBSTRING REPLACE SPLIT CONCAT DATE YEAR MONTH DAY HOUR MINUTE SECOND DATEDIFF DATEADD CURRENT_DATE CURRENT_TIMESTAMP TO_DATE TO_TIMESTAMP TO_NUMBER TO_VARCHAR TRY_CAST CONVERT FLOOR CEIL ROUND ABS MOD SQRT LOG EXP ARRAY_AGG LISTAGG STRING_AGG GROUP_CONCAT FLATTEN UNNEST GENERATE_SERIES".split(
    " ",
  ),
);

interface SqlToken {
  type: string;
  value: string;
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- SQL lexer branches
function tokenizeSQL(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let pos = 0;
  const len = sql.length;

  while (pos < len) {
    // Block comment
    if (sql.startsWith("/*", pos)) {
      const end = sql.indexOf("*/", pos + 2);
      const value = end === -1 ? sql.slice(pos) : sql.slice(pos, end + 2);
      tokens.push({ type: "comment", value });
      pos += value.length;
      continue;
    }
    // Line comment
    if (sql.startsWith("--", pos)) {
      const end = sql.indexOf("\n", pos);
      const value = end === -1 ? sql.slice(pos) : sql.slice(pos, end + 1);
      tokens.push({ type: "comment", value });
      pos += value.length;
      continue;
    }
    // Single-quoted string
    if (sql[pos] === "'") {
      let i = pos + 1;
      while (i < len) {
        if (sql[i] === "'" && sql[i - 1] !== "\\") {
          i++;
          break;
        }
        i++;
      }
      tokens.push({ type: "string", value: sql.slice(pos, i) });
      pos = i;
      continue;
    }
    // Number
    const numMatch = /^[0-9]+(\.[0-9]+)?/.exec(sql.slice(pos));
    if (numMatch && (pos === 0 || !/[a-zA-Z_]/.test(sql[pos - 1]))) {
      tokens.push({ type: "number", value: numMatch[0] });
      pos += numMatch[0].length;
      continue;
    }
    // Word (keyword, function, or identifier)
    const wordMatch = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(sql.slice(pos));
    if (wordMatch) {
      const word = wordMatch[0];
      const upper = word.toUpperCase();
      const type = SQL_KEYWORDS.has(upper)
        ? "keyword"
        : SQL_FUNCTIONS.has(upper)
          ? "function"
          : "identifier";
      tokens.push({ type, value: word });
      pos += word.length;
      continue;
    }
    // Operator
    if (/[=<>!|+\-*/%^&~]/.test(sql[pos])) {
      tokens.push({ type: "operator", value: sql[pos] });
      pos++;
      continue;
    }
    // Punctuation
    if (/[(),;.[\]{}]/.test(sql[pos])) {
      tokens.push({ type: "punctuation", value: sql[pos] });
      pos++;
      continue;
    }
    // Whitespace / anything else — keep as-is
    tokens.push({ type: "plain", value: sql[pos] });
    pos++;
  }
  return tokens;
}

export function SqlPanel({ sql }: { sql: string }) {
  const tokens = tokenizeSQL(sql);
  return (
    <pre className="sql-panel">
      <code>
        {tokens.map((token, i) =>
          token.type === "plain" || token.type === "identifier" ? (
            token.value
          ) : (
            <span key={i} className={`sql-token-${token.type}`}>
              {token.value}
            </span>
          ),
        )}
      </code>
    </pre>
  );
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

function AssetSqlOrDefinitionCard({
  resource,
  showsDefinition,
  definition,
  sqlText,
}: {
  resource: ResourceNode;
  showsDefinition: boolean;
  definition: ResourceNode["definition"];
  sqlText: string | undefined;
}) {
  return (
    <SectionCard
      title={showsDefinition ? "Definition" : "SQL"}
      subtitle={
        showsDefinition
          ? definition?.kind === "metric"
            ? "Structured metric definition captured from the manifest."
            : "Structured semantic model definition captured from the manifest."
          : resource.compiledCode
            ? "Compiled SQL for the selected resource."
            : "Raw SQL captured from the manifest."
      }
    >
      {showsDefinition && definition ? (
        definition.kind === "metric" ? (
          renderMetricDefinition(definition)
        ) : (
          renderSemanticModelDefinition(definition)
        )
      ) : sqlText ? (
        <SqlPanel sql={sqlText} />
      ) : (
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
}: {
  resource: ResourceNode | null;
  analysis: AnalysisState;
  onSelectResource: (id: string) => void;
  assetViewState: AssetViewState;
  onAssetViewStateChange: Dispatch<SetStateAction<AssetViewState>>;
}) {
  const resourceById = useMemo(
    () => new Map(analysis.resources.map((entry) => [entry.uniqueId, entry])),
    [analysis.resources],
  );

  const upstreamDepth = assetViewState.upstreamDepth;
  const downstreamDepth = assetViewState.downstreamDepth;
  const allDepsMode = assetViewState.allDepsMode;
  const lensMode = assetViewState.lensMode;
  const activeLegendKeys = assetViewState.activeLegendKeys;

  const setUpstreamDepth: Dispatch<SetStateAction<number>> = (v) =>
    onAssetViewStateChange((cur) => ({
      ...cur,
      upstreamDepth: typeof v === "function" ? v(cur.upstreamDepth) : v,
    }));
  const setDownstreamDepth: Dispatch<SetStateAction<number>> = (v) =>
    onAssetViewStateChange((cur) => ({
      ...cur,
      downstreamDepth: typeof v === "function" ? v(cur.downstreamDepth) : v,
    }));
  const setAllDepsMode: Dispatch<SetStateAction<boolean>> = (v) =>
    onAssetViewStateChange((cur) => ({
      ...cur,
      allDepsMode: typeof v === "function" ? v(cur.allDepsMode) : v,
    }));
  const setLensMode = (mode: LensMode) =>
    onAssetViewStateChange((cur) => ({
      ...cur,
      lensMode: mode,
      activeLegendKeys: new Set(),
    }));
  const setActiveLegendKeys: Dispatch<SetStateAction<Set<string>>> = (value) =>
    onAssetViewStateChange((cur) => ({
      ...cur,
      activeLegendKeys:
        typeof value === "function" ? value(cur.activeLegendKeys) : value,
    }));

  // Reset lineage settings when a new resource is selected.
  useEffect(() => {
    onAssetViewStateChange((cur) => {
      if (
        cur.upstreamDepth === 2 &&
        cur.downstreamDepth === 2 &&
        !cur.allDepsMode
      ) {
        return cur;
      }
      return {
        ...cur,
        upstreamDepth: 2,
        downstreamDepth: 2,
        allDepsMode: false,
        activeLegendKeys: new Set(),
      };
    });
  }, [resource?.uniqueId, onAssetViewStateChange]);

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
  const sqlText = resource.compiledCode ?? resource.rawCode;
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
    onSelectResource,
  } as const;

  return (
    <div className="workspace-view">
      <section className="catalog-detail-hero">
        <div>
          <p className="eyebrow">Catalog asset</p>
          <h3>{resource.name}</h3>
          {detailSubtitle}
        </div>
      </section>

      <SectionCard
        title="Asset summary"
        subtitle="Core execution and discovery context for the selected asset."
      >
        <div className="detail-grid">
          <div className="detail-stat">
            <span>Status</span>
            <strong>{resource.status ?? "Not executed"}</strong>
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
            <span>Upstream</span>
            <strong>{dependencySummary?.upstream.length ?? 0}</strong>
          </div>
          <div className="detail-stat">
            <span>Downstream</span>
            <strong>{dependencySummary?.downstream.length ?? 0}</strong>
          </div>
          <div className="detail-stat">
            <span>Owner</span>
            <strong>{NOT_CAPTURED}</strong>
          </div>
          <div className="detail-stat">
            <span>Health</span>
            <strong>{resource.status ?? "Unknown"}</strong>
          </div>
        </div>
        {resource.description ? (
          <p className="resource-spotlight__description">
            {resource.description}
          </p>
        ) : (
          <p className="resource-spotlight__description resource-spotlight__description--muted">
            No description was captured for this asset. Catalog-oriented
            metadata can surface here when present in the manifest.
          </p>
        )}
      </SectionCard>

      <LineagePanel {...lineagePanelProps} displayMode="summary" />

      <AssetSqlOrDefinitionCard
        resource={resource}
        showsDefinition={showsDefinition}
        definition={definition}
        sqlText={sqlText}
      />
    </div>
  );
}
