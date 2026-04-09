import type { ExecutionRow, ResourceNode } from "@web/types";
import {
  formatAdapterMetricValue,
  getAdapterMetricValue,
  getAdapterResponseFieldsBeyondNormalized,
  getPresentAdapterMetricDescriptors,
} from "@dbt-tools/core/browser";
import { NOT_EXECUTED } from "@web/lib/analysis-workspace/catalogCopy";
import {
  displayResourcePath,
  formatRelationNameForDisplay,
  formatSeconds,
} from "@web/lib/analysis-workspace/utils";
import { ResourceMarkdownDescription } from "../ResourceMarkdownDescription";
import { SectionCard } from "../shared";

function warehouseRelationLabel(resource: ResourceNode): string {
  const rel = resource.semantics?.relationName?.trim();
  if (rel) return formatRelationNameForDisplay(rel);
  const db = resource.database?.trim();
  const sch = resource.schema?.trim();
  if (db && sch) return `${db}.${sch}`;
  if (sch) return sch;
  if (db) return db;
  return "n/a";
}

export function AssetSummarySection({
  resource,
  executionRow = null,
}: {
  resource: ResourceNode;
  /** When set, adapter fields fall back from the run row if missing on `resource`. */
  executionRow?: ExecutionRow | null;
}) {
  const adapterMetrics =
    resource.adapterMetrics ?? executionRow?.adapterMetrics;
  const adapterResponseFields =
    resource.adapterResponseFields ?? executionRow?.adapterResponseFields;
  const adapterMetricDescriptors =
    adapterMetrics != null
      ? getPresentAdapterMetricDescriptors([adapterMetrics])
      : [];

  const extraAdapterRawFields = getAdapterResponseFieldsBeyondNormalized(
    adapterMetrics,
    adapterResponseFields,
  );

  const showAdapter =
    extraAdapterRawFields.length > 0 || adapterMetricDescriptors.length > 0;

  return (
    <div className="asset-summary-stack">
      <SectionCard
        title="Resource"
        subtitle="Path, relation, and description from the project manifest."
      >
        <div className="detail-grid">
          <div className="detail-stat">
            <span>Project</span>
            <strong>{resource.packageName?.trim() || "n/a"}</strong>
          </div>
          <div className="detail-stat">
            <span>Path</span>
            <strong>{displayResourcePath(resource) ?? "n/a"}</strong>
          </div>
          <div className="detail-stat">
            <span>Relation</span>
            <strong>{warehouseRelationLabel(resource)}</strong>
          </div>
        </div>
        {resource.description ? (
          <ResourceMarkdownDescription
            markdown={resource.description}
            className="resource-spotlight__description"
          />
        ) : (
          <p className="resource-spotlight__description resource-spotlight__description--muted">
            No description was captured for this asset. Catalog-oriented
            metadata can surface here when present in the manifest.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="This run"
        subtitle="Status, timing, and warehouse feedback from the captured run."
      >
        <div className="asset-summary__groups">
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
          </div>
          {showAdapter ? (
            <div className="asset-summary__group">
              <p className="asset-summary__group-title">Adapter response</p>
              {adapterMetrics != null && adapterMetricDescriptors.length > 0 ? (
                <div className="detail-grid">
                  {adapterMetricDescriptors.map((descriptor) => {
                    const value = getAdapterMetricValue(
                      adapterMetrics,
                      descriptor.key,
                    );
                    return (
                      <div className="detail-stat" key={descriptor.key}>
                        <span>{descriptor.shortLabel}</span>
                        <strong>
                          {value !== undefined
                            ? formatAdapterMetricValue(descriptor, value)
                            : "—"}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {extraAdapterRawFields.length > 0 ? (
                <div
                  className="asset-summary__adapter-raw"
                  aria-label="Additional adapter response fields"
                >
                  {extraAdapterRawFields
                    .map((field) => `${field.label}: ${field.displayValue}`)
                    .join("\n")}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
