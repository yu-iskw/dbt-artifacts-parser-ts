/**
 * Search CLI action handler – fast manifest search across dbt entities.
 */
import {
  ManifestGraph,
  discoverResources,
  loadManifest,
  validateSafePath,
  validateNoControlChars,
  FieldFilter,
  formatOutput,
  shouldOutputJSON,
} from "@dbt-tools/core";
import {
  resolveCliArtifactPaths,
  type ArtifactRootCliOptions,
} from "./cli-artifact-resolve";

export type SearchOptions = {
  type?: string;
  package?: string;
  tag?: string;
  path?: string;
  fields?: string;
  json?: boolean;
  noJson?: boolean;
} & ArtifactRootCliOptions;

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

/** Apply structured flag filters on top of query-extracted filters */
function applyFilters(
  attrs: SearchResult,
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
export async function searchAction(
  query: string | undefined,
  options: SearchOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    if (query) {
      validateNoControlChars(query);
    }

    const paths = await resolveCliArtifactPaths(
      {
        dbtTarget: options.dbtTarget,
      },
      { manifest: true, runResults: false },
    );
    validateSafePath(paths.manifest);

    const manifest = loadManifest(paths.manifest);
    const graph = new ManifestGraph(manifest);

    // Parse inline key:value tokens from query
    const parsed = query ? parseQueryTokens(query) : { terms: [] };

    // Merge inline filters with explicit flag options (flags take precedence)
    const effectiveType = options.type ?? parsed.type;
    const effectivePackage = options.package ?? parsed.package;
    const effectiveTag = options.tag ?? parsed.tag;

    const discovered = discoverResources(graph, parsed.terms.join(" "), {
      limit: 1000,
    });

    const results = discovered.matches
      .map((match) => {
        const attrs = graph.getGraph().getNodeAttributes(match.unique_id);
        return {
          unique_id: match.unique_id,
          resource_type: match.resource_type,
          name: match.display_name,
          package_name: attrs.package_name,
          path: attrs.path as string | undefined,
          tags: attrs.tags as string[] | undefined,
          description: attrs.description as string | undefined,
        } satisfies SearchResult;
      })
      .filter((result) =>
        applyFilters(
          result,
          effectiveType,
          effectivePackage,
          effectiveTag,
          options.path,
        ),
      );
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
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
