import type { AnalysisState, ResourceNode } from "@web/types";
import { NOT_EXECUTED } from "@web/lib/analysis-workspace/catalogCopy";
import {
  displayResourcePath,
  formatSeconds,
} from "@web/lib/analysis-workspace/utils";
import { ResourceMarkdownDescription } from "../ResourceMarkdownDescription";
import { SectionCard } from "../shared";

export function AssetSummarySection({
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
