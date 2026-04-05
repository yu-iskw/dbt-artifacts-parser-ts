import type { ResourceNode } from "@web/types";
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

export function AssetSummarySection({ resource }: { resource: ResourceNode }) {
  return (
    <SectionCard
      title="Asset summary"
      subtitle="Manifest metadata and execution details from the captured run."
    >
      <div className="asset-summary__groups">
        <div className="asset-summary__group">
          <p className="asset-summary__group-title">Resource</p>
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
        </div>
        <div className="asset-summary__group">
          <p className="asset-summary__group-title">This run</p>
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
        </div>
      </div>
      {resource.description ? (
        <ResourceMarkdownDescription
          markdown={resource.description}
          className="resource-spotlight__description"
        />
      ) : (
        <p className="resource-spotlight__description resource-spotlight__description--muted">
          No description was captured for this asset. Catalog-oriented metadata
          can surface here when present in the manifest.
        </p>
      )}
    </SectionCard>
  );
}
