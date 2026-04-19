/**
 * Shared discovery layer — weighted ranking, fuzzy matching, disambiguation,
 * related-resource suggestions, and next-action hints.
 *
 * Browser-safe: no Node.js fs/path imports.
 */
import type { ManifestGraph } from "../analysis/manifest-graph";
import type { GraphNodeAttributes } from "../types";
import type {
  DiscoveryConfidence,
  DiscoveryMatch,
  DiscoveryOptions,
  DiscoveryOutput,
  DiscoveryRelated,
} from "./discovery-types";

// ---------------------------------------------------------------------------
// Internal scoring reason codes
// ---------------------------------------------------------------------------
type ReasonCode =
  | "exact_name_match"
  | "name_prefix_match"
  | "name_contains"
  | "unique_id_match"
  | "unique_id_contains"
  | "tag_match"
  | "tag_contains"
  | "path_match"
  | "description_match"
  | "fuzzy_name_match"
  | "high_dependency_centrality"
  | "medium_dependency_centrality";

// ---------------------------------------------------------------------------
// Token parsing (inline key:value filters, e.g. "type:model orders")
// ---------------------------------------------------------------------------
interface ParsedTokens {
  terms: string[];
  type?: string;
  package?: string;
  tag?: string;
}

function parseQueryTokens(query: string): ParsedTokens {
  const tokens = query.split(/\s+/).filter(Boolean);
  const terms: string[] = [];
  let type: string | undefined;
  let pkg: string | undefined;
  let tag: string | undefined;

  for (const token of tokens) {
    if (token.startsWith("type:")) {
      type = token.slice(5);
    } else if (token.startsWith("package:")) {
      pkg = token.slice(8);
    } else if (token.startsWith("tag:")) {
      tag = token.slice(4);
    } else {
      terms.push(token);
    }
  }

  return { terms, type, package: pkg, tag };
}

// ---------------------------------------------------------------------------
// Levenshtein distance (no external dependencies)
// ---------------------------------------------------------------------------
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Use a flat array for the DP matrix
  const dp = new Array<number>((m + 1) * (n + 1));
  for (let i = 0; i <= m; i++) dp[i * (n + 1)] = i;
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i * (n + 1) + j] = Math.min(
        dp[(i - 1) * (n + 1) + j] + 1,
        dp[i * (n + 1) + (j - 1)] + 1,
        dp[(i - 1) * (n + 1) + (j - 1)] + cost,
      );
    }
  }
  return dp[m * (n + 1) + n];
}

// ---------------------------------------------------------------------------
// Next-action mapping by resource type
// ---------------------------------------------------------------------------
const NEXT_ACTIONS_BY_TYPE: Record<string, string[]> = {
  model: ["explain", "impact", "diagnose"],
  seed: ["explain", "impact", "diagnose"],
  snapshot: ["explain", "impact", "diagnose"],
  source: ["explain", "impact"],
  test: ["diagnose"],
  unit_test: ["diagnose"],
  exposure: ["explain", "impact"],
  metric: ["explain", "impact"],
  semantic_model: ["explain", "impact"],
};

function nextActionsFor(resourceType: string): string[] {
  return NEXT_ACTIONS_BY_TYPE[resourceType] ?? ["explain"];
}

// ---------------------------------------------------------------------------
// Confidence from normalized score
// ---------------------------------------------------------------------------
function confidenceFor(normalizedScore: number): DiscoveryConfidence {
  if (normalizedScore >= 75) return "high";
  if (normalizedScore >= 40) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Raw scoring
// ---------------------------------------------------------------------------
interface ScoredNode {
  attrs: GraphNodeAttributes;
  rawScore: number;
  reasons: ReasonCode[];
}

interface NodeFields {
  lName: string;
  lId: string;
  lPath: string;
  lDesc: string;
  lTags: string[];
}

function extractNodeFields(attrs: GraphNodeAttributes): NodeFields {
  return {
    lName: (attrs.name || "").toLowerCase(),
    lId: (attrs.unique_id || "").toLowerCase(),
    lPath: ((attrs.path as string | undefined) || "").toLowerCase(),
    lDesc: ((attrs.description as string | undefined) || "").toLowerCase(),
    lTags: ((attrs.tags as string[] | undefined) || []).map((t) =>
      t.toLowerCase(),
    ),
  };
}

function scoreNameSignal(
  term: string,
  lName: string,
  lId: string,
  reasons: Set<ReasonCode>,
): number {
  if (lName === term || lId === term) {
    reasons.add("exact_name_match");
    return 50;
  }
  if (lName.startsWith(term)) {
    reasons.add("name_prefix_match");
    return 35;
  }
  if (lName.includes(term)) {
    reasons.add("name_contains");
    return 25;
  }
  return 0;
}

function scoreIdSignal(
  term: string,
  lId: string,
  alreadyMatched: boolean,
  reasons: Set<ReasonCode>,
): number {
  if (lId === term) {
    reasons.add("unique_id_match");
    return alreadyMatched ? 0 : 45;
  }
  if (lId.includes(term)) {
    reasons.add("unique_id_contains");
    return alreadyMatched ? 0 : 20;
  }
  return 0;
}

function scoreTagSignal(
  term: string,
  lTags: string[],
  reasons: Set<ReasonCode>,
): number {
  if (lTags.some((t) => t === term)) {
    reasons.add("tag_match");
    return 20;
  }
  if (lTags.some((t) => t.includes(term))) {
    reasons.add("tag_contains");
    return 10;
  }
  return 0;
}

/** Score a single term against pre-lowercased node fields; returns 0 if no match. */
function scoreOneTerm(
  term: string,
  fields: NodeFields,
  reasons: Set<ReasonCode>,
): number {
  const namePoints = scoreNameSignal(term, fields.lName, fields.lId, reasons);
  const idPoints = scoreIdSignal(term, fields.lId, namePoints > 0, reasons);
  const tagPoints = scoreTagSignal(term, fields.lTags, reasons);

  let points = namePoints + idPoints + tagPoints;

  if (fields.lPath.includes(term)) {
    points += 8;
    reasons.add("path_match");
  }

  if (fields.lDesc.includes(term)) {
    points += 5;
    reasons.add("description_match");
  }

  if (points === 0 && term.length >= 4 && fields.lName.length >= 4) {
    if (levenshtein(fields.lName, term) <= 2) {
      points += 15;
      reasons.add("fuzzy_name_match");
    }
  }

  return points;
}

function applyCentralityBonus(
  inOutDegree: number,
  rawScore: number,
  reasons: Set<ReasonCode>,
): number {
  if (inOutDegree > 10) {
    reasons.add("high_dependency_centrality");
    return rawScore + 10;
  }
  if (inOutDegree > 3) {
    reasons.add("medium_dependency_centrality");
    return rawScore + 5;
  }
  return rawScore;
}

function scoreNodeAgainstTerms(
  attrs: GraphNodeAttributes,
  terms: string[],
  inOutDegree: number,
): ScoredNode {
  const reasons = new Set<ReasonCode>();
  const fields = extractNodeFields(attrs);
  let rawScore = 0;

  for (const rawTerm of terms) {
    const termPoints = scoreOneTerm(rawTerm.toLowerCase(), fields, reasons);
    if (termPoints === 0) {
      return { attrs, rawScore: 0, reasons: [] };
    }
    rawScore += termPoints;
  }

  rawScore = applyCentralityBonus(inOutDegree, rawScore, reasons);
  return { attrs, rawScore, reasons: Array.from(reasons) };
}

// ---------------------------------------------------------------------------
// Related resources
// ---------------------------------------------------------------------------
function buildRelated(
  graph: ManifestGraph,
  nodeId: string,
): DiscoveryRelated[] {
  const related: DiscoveryRelated[] = [];
  const seen = new Set<string>();

  // Depth-1 upstream
  for (const { nodeId: upId } of graph.getUpstream(nodeId, 1)) {
    if (!seen.has(upId)) {
      seen.add(upId);
      related.push({ unique_id: upId, relation: "upstream" });
    }
  }

  // Depth-1 downstream
  for (const { nodeId: downId } of graph.getDownstream(nodeId, 1)) {
    if (!seen.has(downId)) {
      seen.add(downId);
      const attrs = graph.getGraph().getNodeAttributes(downId);
      const relation =
        attrs.resource_type === "exposure"
          ? "exposure"
          : attrs.resource_type === "test" || attrs.resource_type === "unit_test"
            ? "test"
            : "downstream";
      related.push({ unique_id: downId, relation });
    }
  }

  return related.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export class DiscoveryService {
  /**
   * Query the manifest graph and return ranked, explainable discovery results.
   *
   * @param graph - A ManifestGraph built from the project manifest
   * @param queryString - Free-text query; supports `type:`, `tag:`, `package:` inline tokens
   * @param options - Optional type filter and result limit
   */
  static query(
    graph: ManifestGraph,
    queryString: string,
    options: DiscoveryOptions = {},
  ): DiscoveryOutput {
    const parsed = parseQueryTokens(queryString.trim());
    const effectiveType = options.type ?? parsed.type;
    const limit = options.limit ?? 10;

    const g = graph.getGraph();

    // Build centrality index (in+out degree) once
    const degreeMap = new Map<string, number>();
    g.forEachNode((nodeId) => {
      degreeMap.set(
        nodeId,
        g.inboundNeighbors(nodeId).length + g.outboundNeighbors(nodeId).length,
      );
    });

    const candidates: ScoredNode[] = [];

    g.forEachNode((_nodeId, attrs) => {
      // Skip field-level nodes (column lineage internals)
      if (attrs.resource_type === "field") return;

      // Apply type filter
      if (
        effectiveType &&
        attrs.resource_type.toLowerCase() !==
          effectiveType.toLowerCase()
      ) {
        return;
      }

      // Apply package filter from inline token
      if (
        parsed.package &&
        (attrs.package_name || "") !== parsed.package
      ) {
        return;
      }

      // Apply tag filter from inline token
      if (parsed.tag) {
        const nodeTags = ((attrs.tags as string[] | undefined) || []).map((t) =>
          t.toLowerCase(),
        );
        if (!nodeTags.includes(parsed.tag.toLowerCase())) return;
      }

      const degree = degreeMap.get(attrs.unique_id) ?? 0;
      const scored = scoreNodeAgainstTerms(attrs, parsed.terms, degree);
      if (scored.rawScore > 0 || parsed.terms.length === 0) {
        candidates.push(scored);
      }
    });

    if (candidates.length === 0) {
      return { query: queryString, total: 0, matches: [] };
    }

    // Sort: higher rawScore first, then alphabetical for stability
    candidates.sort((a, b) => {
      if (b.rawScore !== a.rawScore) return b.rawScore - a.rawScore;
      return a.attrs.unique_id.localeCompare(b.attrs.unique_id);
    });

    // Normalize scores to 0–100 relative to best candidate
    const maxRaw = candidates[0].rawScore;
    const normalize = (raw: number) =>
      maxRaw === 0 ? 0 : Math.round((raw / maxRaw) * 100);

    const topNormalized = normalize(candidates[0].rawScore);

    // Collect disambiguation set (score within 20 pts of top, beyond index 0)
    const disambiguationCandidates = candidates
      .slice(1)
      .filter((c) => topNormalized - normalize(c.rawScore) <= 20);

    const matches: DiscoveryMatch[] = candidates
      .slice(0, limit)
      .map((c, idx) => {
        const score = normalize(c.rawScore);
        const match: DiscoveryMatch = {
          resource_type: c.attrs.resource_type,
          unique_id: c.attrs.unique_id,
          display_name: c.attrs.name,
          score,
          confidence: confidenceFor(score),
          reasons: c.reasons as string[],
          disambiguation:
            idx === 0
              ? disambiguationCandidates.slice(0, 5).map((d) => ({
                  resource_type: d.attrs.resource_type,
                  unique_id: d.attrs.unique_id,
                  display_name: d.attrs.name,
                  score: normalize(d.rawScore),
                  confidence: confidenceFor(normalize(d.rawScore)),
                  reasons: d.reasons as string[],
                }))
              : [],
          related: buildRelated(graph, c.attrs.unique_id),
          next_actions: nextActionsFor(c.attrs.resource_type),
        };
        return match;
      });

    return { query: queryString, total: matches.length, matches };
  }
}
