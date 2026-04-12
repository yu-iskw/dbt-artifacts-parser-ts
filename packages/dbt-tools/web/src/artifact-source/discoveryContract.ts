/**
 * Shared types for the directory/prefix-based artifact discovery and activation API.
 * These types cross the server→browser boundary; keep this module free of Node and fetch.
 */

/** Artifact source kind for runtime-specified locations. */
export type ArtifactSourceType = "local" | "s3" | "gcs";

/** Request body for POST /api/artifact-source/discover */
export interface DiscoverArtifactsRequest {
  /** Source type determines how the server accesses the location. */
  sourceType: ArtifactSourceType;
  /**
   * Location to scan for dbt artifacts.
   * - local: absolute or relative directory path (e.g. "/dbt/target" or "./target")
   * - s3/gcs: "bucket/prefix" (e.g. "my-bucket/dbt/runs")
   */
  location: string;
}

/**
 * Summary of a single discovered artifact candidate set.
 * Only candidates that include both manifest.json and run_results.json are returned.
 */
export interface ArtifactCandidateSummary {
  /** Identifies this candidate within the location (runId from discovery). */
  candidateId: string;
  /** Human-readable label for the candidate. */
  label: string;
  /** Max mtime of the required artifact pair, in milliseconds. */
  updatedAtMs: number;
  /** Always true (filtered out otherwise). */
  hasManifest: boolean;
  /** Always true (filtered out otherwise). */
  hasRunResults: boolean;
  hasCatalog: boolean;
  hasSources: boolean;
  /**
   * Names of optional artifacts that are absent from this candidate.
   * Features that depend on these will be unavailable.
   */
  missingOptional: string[];
}

/** Response body for POST /api/artifact-source/discover */
export interface DiscoverArtifactsResponse {
  sourceType: ArtifactSourceType;
  location: string;
  /**
   * Valid candidate sets found at the location.
   * Empty (with error set) when no complete required pair exists.
   */
  candidates: ArtifactCandidateSummary[];
  /** Set when discovery fails (access error, missing required pair, etc.). */
  error?: string;
}

/** Request body for POST /api/artifact-source/activate */
export interface ActivateArtifactRequest {
  sourceType: ArtifactSourceType;
  /** Same location string used in the preceding discover request. */
  location: string;
  /** candidateId from the chosen ArtifactCandidateSummary. */
  candidateId: string;
}
