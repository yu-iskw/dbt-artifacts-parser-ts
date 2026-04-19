/**
 * Output types for the shared discovery layer.
 * Consumed by both the CLI `discover` command and the web search worker.
 */

export type DiscoveryConfidence = "high" | "medium" | "low";

export interface DiscoveryRelated {
  unique_id: string;
  /** Structural relationship from the queried node's perspective. */
  relation: "upstream" | "downstream" | "test" | "exposure";
}

export interface DiscoveryMatch {
  resource_type: string;
  unique_id: string;
  display_name: string;
  /** Normalized 0–100 score relative to the best match in this result set. */
  score: number;
  confidence: DiscoveryConfidence;
  /** Machine-readable codes explaining why this node ranked here. */
  reasons: string[];
  /** Other close candidates (score within 20 pts of top); shallow — no nested disambiguation. */
  disambiguation: Omit<
    DiscoveryMatch,
    "disambiguation" | "related" | "next_actions"
  >[];
  /** Depth-1 neighbors and related tests/exposures. */
  related: DiscoveryRelated[];
  /** Suggested follow-up operations based on resource type. */
  next_actions: string[];
}

export interface DiscoveryOutput {
  query: string;
  total: number;
  matches: DiscoveryMatch[];
}

export interface DiscoveryOptions {
  /** Filter to a single resource type (e.g. "model", "source"). */
  type?: string;
  /** Maximum number of matches to return (default 10). */
  limit?: number;
}
