import type { ManifestGraph } from "./manifest-graph";
import type { DbtResourceType, GraphNodeAttributes } from "../types";

export type DiscoveryConfidence = "high" | "medium" | "low";

export type DiscoveryReasonCode =
  | "exact_name_match"
  | "exact_unique_id_match"
  | "name_contains_query"
  | "unique_id_contains_query"
  | "tag_match"
  | "path_match"
  | "description_match"
  | "alias_match"
  | "fuzzy_name_match"
  | "high_dependency_centrality";

export interface DiscoveryRelatedResource {
  unique_id: string;
  relation: "upstream" | "downstream" | "test" | "sibling";
}

export interface DiscoveryMatch {
  resource_type: DbtResourceType;
  unique_id: string;
  display_name: string;
  score: number;
  confidence: DiscoveryConfidence;
  reasons: DiscoveryReasonCode[];
  disambiguation: string[];
  related: DiscoveryRelatedResource[];
  next_actions: string[];
}

export interface DiscoveryResult {
  query: string;
  matches: DiscoveryMatch[];
}

export interface DiscoverySearchOptions {
  limit?: number;
  resourceTypes?: DbtResourceType[];
}

function normalizedText(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).map((token) => token.trim()).filter(Boolean);
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  const current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length] ?? Math.max(a.length, b.length);
}

function nextActionsForType(type: DbtResourceType): string[] {
  if (type === "model" || type === "source" || type === "snapshot") {
    return ["explain", "impact", "diagnose node"];
  }
  if (type === "test" || type === "unit_test") {
    return ["explain", "diagnose node", "impact"];
  }
  return ["explain", "impact"];
}

function confidenceFromScore(score: number): DiscoveryConfidence {
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

function centralityBoost(
  graph: ReturnType<ManifestGraph["getGraph"]>,
  uniqueId: string,
): number {
  const degree = graph.inDegree(uniqueId) + graph.outDegree(uniqueId);
  return Math.min(0.15, degree * 0.01);
}

function includesAnyToken(tokens: string[], text: string): boolean {
  if (!text) return false;
  return tokens.some((token) => text.includes(token));
}

type MatchAccumulator = {
  score: number;
  reasons: Set<DiscoveryReasonCode>;
};

function addReason(
  acc: MatchAccumulator,
  reason: DiscoveryReasonCode,
  weight: number,
): void {
  acc.score += weight;
  acc.reasons.add(reason);
}

function scoreNameAndId(
  acc: MatchAccumulator,
  query: string,
  name: string,
  uniqueId: string,
): void {
  if (name === query) {
    addReason(acc, "exact_name_match", 0.5);
  } else if (name.includes(query)) {
    addReason(acc, "name_contains_query", 0.3);
  }

  if (uniqueId === query) {
    addReason(acc, "exact_unique_id_match", 0.52);
  } else if (uniqueId.includes(query)) {
    addReason(acc, "unique_id_contains_query", 0.32);
  }
}

function scoreMetadata(
  acc: MatchAccumulator,
  tokens: string[],
  values: {
    tags: string[];
    path: string;
    description: string;
    alias: string;
  },
  query: string,
): void {
  if (includesAnyToken(tokens, values.tags.join(" "))) {
    addReason(acc, "tag_match", 0.15);
  }
  if (includesAnyToken(tokens, values.path)) {
    addReason(acc, "path_match", 0.12);
  }
  if (includesAnyToken(tokens, values.description)) {
    addReason(acc, "description_match", 0.08);
  }
  if (
    values.alias.length > 0 &&
    (values.alias === query || values.alias.includes(query))
  ) {
    addReason(acc, "alias_match", 0.2);
  }
}

function scoreFuzzyName(acc: MatchAccumulator, query: string, name: string): void {
  if (query.length < 4 || name.length === 0) return;
  const distance = levenshteinDistance(query, name);
  if (distance > 0 && distance <= 2) {
    addReason(acc, "fuzzy_name_match", 0.18 - distance * 0.04);
  }
}

function scoreNode(
  attrs: GraphNodeAttributes,
  query: string,
  tokens: string[],
  graph: ReturnType<ManifestGraph["getGraph"]>,
): MatchAccumulator {
  const acc: MatchAccumulator = { score: 0, reasons: new Set() };
  const name = normalizedText(attrs.name);
  const uniqueId = normalizedText(attrs.unique_id);
  const path = normalizedText(attrs.path);
  const description = normalizedText(attrs.description);
  const alias = normalizedText(attrs.alias);
  const tags = (attrs.tags ?? []).map((tag) => normalizedText(tag));

  scoreNameAndId(acc, query, name, uniqueId);
  scoreMetadata(acc, tokens, { tags, path, description, alias }, query);
  scoreFuzzyName(acc, query, name);

  const centrality = centralityBoost(graph, attrs.unique_id);
  if (acc.reasons.size > 0 && centrality >= 0.08) {
    acc.score += centrality;
    acc.reasons.add("high_dependency_centrality");
  }

  return acc;
}

function buildRelatedResources(
  graph: ReturnType<ManifestGraph["getGraph"]>,
  uniqueId: string,
): DiscoveryRelatedResource[] {
  const upstream = graph.inboundNeighbors(uniqueId).slice(0, 2);
  const downstream = graph.outboundNeighbors(uniqueId).slice(0, 2);
  const related: DiscoveryRelatedResource[] = [
    ...upstream.map((id) => ({ unique_id: id, relation: "upstream" as const })),
    ...downstream.map((id) => ({
      unique_id: id,
      relation: "downstream" as const,
    })),
  ];

  for (const downId of downstream) {
    if (downId.startsWith("test.") || downId.startsWith("unit_test.")) {
      related.push({ unique_id: downId, relation: "test" });
    }
  }
  return related.slice(0, 5);
}

export function discoverResources(
  manifestGraph: ManifestGraph,
  inputQuery: string,
  options: DiscoverySearchOptions = {},
): DiscoveryResult {
  const query = normalizedText(inputQuery);
  const tokens = tokenize(query);
  const limit = options.limit ?? 10;
  const graph = manifestGraph.getGraph();
  const matches: DiscoveryMatch[] = [];

  graph.forEachNode((nodeId, attrs) => {
    if (attrs.resource_type === "field") return;
    if (
      options.resourceTypes &&
      !options.resourceTypes.includes(attrs.resource_type)
    ) {
      return;
    }

    const scored = scoreNode(attrs, query, tokens, graph);
    if (scored.score <= 0) return;

    const normalizedScore = Math.min(1, Number(scored.score.toFixed(4)));
    const disambiguation: string[] = [];
    matches.push({
      resource_type: attrs.resource_type,
      unique_id: nodeId,
      display_name: attrs.name,
      score: normalizedScore,
      confidence: confidenceFromScore(normalizedScore),
      reasons: Array.from(scored.reasons.values()),
      disambiguation,
      related: buildRelatedResources(graph, nodeId),
      next_actions: nextActionsForType(attrs.resource_type),
    });
  });

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.unique_id.localeCompare(b.unique_id);
  });

  const top = matches.slice(0, limit);
  if (top.length > 1) {
    const leader = top[0];
    const closeAlternatives = top
      .slice(1)
      .filter((candidate) => leader.score - candidate.score <= 0.08)
      .map((candidate) => candidate.unique_id);
    if (closeAlternatives.length > 0) {
      leader.disambiguation = closeAlternatives;
    }
  }

  return {
    query: inputQuery,
    matches: top,
  };
}
