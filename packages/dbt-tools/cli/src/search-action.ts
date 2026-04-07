/**
 * Search CLI action handler – fast manifest search across dbt entities.
 */
import {
  ManifestGraph,
  resolveArtifactPaths,
  loadManifest,
  validateSafePath,
  validateNoControlChars,
  FieldFilter,
  formatOutput,
  shouldOutputJSON,
  type GraphNodeAttributes,
} from "@dbt-tools/core";

export type SearchOptions = {
  type?: string;
  package?: string;
  tag?: string;
  path?: string;
  fields?: string;
  targetDir?: string;
  json?: boolean;
  noJson?: boolean;
};

export type SearchResult = {
  unique_id: string;
  resource_type: string;
  name: string;
  package_name: string;
  path?: string;
  tags?: string[];
  description?: string;
};

export type SearchOutput = {
  query?: string;
  total: number;
  results: SearchResult[];
};

/**
 * Parse structured filters from free-text tokens, e.g. "type:model tag:finance".
 * Returns remaining plain terms after extracting key:value pairs.
 */
function parseQueryTokens(query: string): {
  terms: string[];
  type?: string;
  package?: string;
  tag?: string;
} {
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
    } else if (token.startsWith("owner:") || token.startsWith("source:")) {
      // treat owner:/source: as plain terms to match against unique_id/name
      terms.push(token.slice(token.indexOf(":") + 1));
    } else {
      terms.push(token);
    }
  }

  return { terms, type, package: pkg, tag };
}

/** Score a node against plain search terms (0 = no match, higher = better) */
function scoreNode(attrs: GraphNodeAttributes, terms: string[]): number {
  if (terms.length === 0) return 1; // everything matches when no terms

  let score = 0;
  const lName = (attrs.name || "").toLowerCase();
  const lId = (attrs.unique_id || "").toLowerCase();
  const lPkg = (attrs.package_name || "").toLowerCase();
  const lPath = ((attrs.path as string | undefined) || "").toLowerCase();
  const lTags = ((attrs.tags as string[] | undefined) || []).map((t) =>
    t.toLowerCase(),
  );

  for (const rawTerm of terms) {
    const term = rawTerm.toLowerCase();
    if (lName === term || lId === term) {
      score += 10; // exact match
    } else if (lName.includes(term) || lId.includes(term)) {
      score += 5; // substring match on primary fields
    } else if (lPkg.includes(term) || lPath.includes(term)) {
      score += 2; // weaker match
    } else if (lTags.some((t) => t.includes(term))) {
      score += 3; // tag match
    } else {
      return 0; // term not found → no match
    }
  }

  return score;
}

/** Apply structured flag filters on top of query-extracted filters */
function applyFilters(
  attrs: GraphNodeAttributes,
  effectiveType: string | undefined,
  effectivePackage: string | undefined,
  effectiveTag: string | undefined,
  pathFilter: string | undefined,
): boolean {
  if (attrs.resource_type === "field") return false;

  if (effectiveType) {
    const types = effectiveType
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (!types.includes(attrs.resource_type.toLowerCase())) return false;
  }

  if (effectivePackage) {
    if ((attrs.package_name || "") !== effectivePackage) return false;
  }

  if (effectiveTag) {
    const required = effectiveTag
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const nodeTags = ((attrs.tags as string[] | undefined) || []).map((t) =>
      t.toLowerCase(),
    );
    if (!required.some((t) => nodeTags.includes(t))) return false;
  }

  if (pathFilter) {
    const nodePath = (attrs.path as string | undefined) || "";
    if (!nodePath.includes(pathFilter)) return false;
  }

  return true;
}

/**
 * Format search results as human-readable output.
 */
export function formatSearch(output: SearchOutput): string {
  const lines: string[] = [];
  const header = output.query
    ? `Search results for "${output.query}"`
    : "Search results";
  lines.push(header);
  lines.push("=".repeat(header.length));
  lines.push(`${output.total} result${output.total !== 1 ? "s" : ""} found`);

  if (output.results.length === 0) {
    return lines.join("\n");
  }

  lines.push("");
  for (const r of output.results) {
    const tags = r.tags?.length ? `  tags: ${r.tags.join(", ")}` : "";
    lines.push(`  ${r.unique_id}`);
    lines.push(
      `    type: ${r.resource_type}  package: ${r.package_name}${tags}`,
    );
    if (r.path) lines.push(`    path: ${r.path}`);
  }

  return lines.join("\n");
}

/**
 * Search action handler
 */
export function searchAction(
  query: string | undefined,
  manifestPath: string | undefined,
  options: SearchOptions,
  handleError: (error: unknown, isTTY: boolean) => void,
  isTTY: () => boolean,
): void {
  try {
    if (query) {
      validateNoControlChars(query);
    }

    const paths = resolveArtifactPaths(
      manifestPath,
      undefined,
      options.targetDir,
    );
    validateSafePath(paths.manifest);

    const manifest = loadManifest(paths.manifest);
    const graph = new ManifestGraph(manifest);
    const g = graph.getGraph();

    // Parse inline key:value tokens from query
    const parsed = query ? parseQueryTokens(query) : { terms: [] };

    // Merge inline filters with explicit flag options (flags take precedence)
    const effectiveType = options.type ?? parsed.type;
    const effectivePackage = options.package ?? parsed.package;
    const effectiveTag = options.tag ?? parsed.tag;

    type ScoredResult = { score: number; result: SearchResult };
    const scored: ScoredResult[] = [];

    g.forEachNode((_id, attrs) => {
      if (
        !applyFilters(
          attrs,
          effectiveType,
          effectivePackage,
          effectiveTag,
          options.path,
        )
      ) {
        return;
      }

      const score = scoreNode(attrs, parsed.terms);
      if (score === 0) return;

      scored.push({
        score,
        result: {
          unique_id: attrs.unique_id,
          resource_type: attrs.resource_type,
          name: attrs.name,
          package_name: attrs.package_name,
          path: attrs.path as string | undefined,
          tags: attrs.tags as string[] | undefined,
          description: attrs.description as string | undefined,
        },
      });
    });

    // Sort: higher score first, then alphabetical by unique_id
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.result.unique_id.localeCompare(b.result.unique_id);
    });

    const results = scored.map((s) => s.result);
    const output: SearchOutput = {
      query: query || undefined,
      total: results.length,
      results,
    };

    const useJson = shouldOutputJSON(options.json, options.noJson);

    if (useJson) {
      let out: unknown = output;
      if (options.fields) {
        out = FieldFilter.filterFields(output, options.fields);
      }
      console.log(formatOutput(out, true));
    } else {
      console.log(formatSearch(output));
    }
  } catch (error) {
    handleError(error, isTTY());
  }
}
