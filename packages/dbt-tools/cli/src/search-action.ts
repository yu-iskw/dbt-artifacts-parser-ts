/**
 * Search CLI action handler – fast manifest search across dbt entities.
 */
import {
  ManifestGraph,
  loadManifest,
  validateSafePath,
  validateNoControlChars,
  FieldFilter,
  formatOutput,
  shouldOutputJSON,
  legacySearchScore,
  parseDiscoveryQueryTokens,
  applyDiscoveryNodeFilters,
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
    const g = graph.getGraph();

    const parsed = query ? parseDiscoveryQueryTokens(query) : { terms: [] };

    const effectiveType = options.type ?? parsed.type;
    const effectivePackage = options.package ?? parsed.package;
    const effectiveTag = options.tag ?? parsed.tag;

    type ScoredResult = { score: number; result: SearchResult };
    const scored: ScoredResult[] = [];

    g.forEachNode((_id, attrs) => {
      if (
        !applyDiscoveryNodeFilters(
          attrs,
          effectiveType,
          effectivePackage,
          effectiveTag,
          options.path,
        )
      ) {
        return;
      }

      const score = legacySearchScore(attrs, parsed.terms);
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
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
