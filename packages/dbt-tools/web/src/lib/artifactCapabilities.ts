/**
 * Feature capability model: maps dbt optional artifacts to the workspace
 * features that depend on them.  Used to warn users when an artifact is
 * absent and to disable only the features that are actually affected.
 */

import {
  DBT_CATALOG_JSON,
  DBT_SOURCES_JSON,
} from "@dbt-tools/core";

export type ArtifactCapabilityKey =
  | "field-level-lineage"
  | "column-metadata"
  | "source-freshness";

export interface ArtifactCapability {
  key: ArtifactCapabilityKey;
  label: string;
  /** The optional artifact that must be present for this capability. */
  requiredArtifact: typeof DBT_CATALOG_JSON | typeof DBT_SOURCES_JSON;
}

export const ARTIFACT_CAPABILITIES: ArtifactCapability[] = [
  {
    key: "field-level-lineage",
    label: "Field-level lineage",
    requiredArtifact: DBT_CATALOG_JSON,
  },
  {
    key: "column-metadata",
    label: "Column metadata",
    requiredArtifact: DBT_CATALOG_JSON,
  },
  {
    key: "source-freshness",
    label: "Source freshness data",
    requiredArtifact: DBT_SOURCES_JSON,
  },
];

/**
 * Returns the capabilities that will be unavailable given the set of missing
 * optional artifact names (e.g. ["catalog.json"]).
 */
export function getDisabledCapabilities(
  missingOptional: string[],
): ArtifactCapability[] {
  const missing = new Set(missingOptional);
  return ARTIFACT_CAPABILITIES.filter((cap) =>
    missing.has(cap.requiredArtifact),
  );
}
