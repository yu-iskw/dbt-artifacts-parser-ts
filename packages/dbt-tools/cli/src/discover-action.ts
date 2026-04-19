/**
 * Discover CLI action handler – ranked, explainable dbt resource discovery.
 */
import {
  ManifestGraph,
  loadManifest,
  validateSafePath,
  validateNoControlChars,
  FieldFilter,
  formatOutput,
  shouldOutputJSON,
  DiscoveryService,
  type DiscoveryOutput,
  type DiscoveryMatch,
} from "@dbt-tools/core";
import {
  resolveCliArtifactPaths,
  type ArtifactRootCliOptions,
} from "./cli-artifact-resolve";

export type DiscoverOptions = {
  type?: string;
  limit?: string;
  fields?: string;
  json?: boolean;
  noJson?: boolean;
} & ArtifactRootCliOptions;

// ---------------------------------------------------------------------------
// Human-readable formatting
// ---------------------------------------------------------------------------
function formatConfidenceBadge(confidence: string): string {
  return `[${confidence.toUpperCase()}]`;
}

function formatRelatedSummary(related: DiscoveryMatch["related"]): string {
  const upstream = related.filter((r) => r.relation === "upstream").length;
  const downstream = related.filter((r) => r.relation === "downstream").length;
  const tests = related.filter((r) => r.relation === "test").length;
  const parts: string[] = [];
  if (upstream > 0) parts.push(`${upstream} upstream`);
  if (downstream > 0) parts.push(`${downstream} downstream`);
  if (tests > 0) parts.push(`${tests} test${tests !== 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(", ") : "none";
}

function formatDiscovery(output: DiscoveryOutput): string {
  const lines: string[] = [];
  const header = `Discovery results for "${output.query}"`;
  lines.push(header);
  lines.push("=".repeat(header.length));
  lines.push(`${output.total} match${output.total !== 1 ? "es" : ""} found`);

  if (output.matches.length === 0) {
    return lines.join("\n");
  }

  for (const m of output.matches) {
    lines.push("");
    lines.push(
      `  ${m.unique_id}  ${formatConfidenceBadge(m.confidence)}  score: ${m.score}`,
    );
    lines.push(
      `    type: ${m.resource_type}  package: ${m.unique_id.split(".")[1] ?? ""}`,
    );
    lines.push(`    reasons: ${m.reasons.join(", ")}`);
    lines.push(`    next: ${m.next_actions.join(", ")}`);
    lines.push(`    related: ${formatRelatedSummary(m.related)}`);

    if (m.disambiguation.length > 0) {
      lines.push(
        `    disambiguation: ${m.disambiguation.map((d) => d.unique_id).join(", ")}`,
      );
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Action handler
// ---------------------------------------------------------------------------
export async function discoverAction(
  query: string,
  options: DiscoverOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    validateNoControlChars(query);

    const paths = await resolveCliArtifactPaths(
      { dbtTarget: options.dbtTarget },
      { manifest: true, runResults: false },
    );
    validateSafePath(paths.manifest);

    const manifest = loadManifest(paths.manifest);
    const graph = new ManifestGraph(manifest);

    const limitNum =
      options.limit !== undefined ? parseInt(options.limit, 10) : 10;
    const safeLimit = Number.isFinite(limitNum) && limitNum > 0 ? limitNum : 10;

    const result = DiscoveryService.query(graph, query, {
      type: options.type,
      limit: safeLimit,
    });

    const useJson = shouldOutputJSON(options.json, options.noJson);

    if (useJson) {
      let out: unknown = result;
      if (options.fields) {
        out = FieldFilter.filterFields(result, options.fields);
      }
      console.log(formatOutput(out, true));
    } else {
      console.log(formatDiscovery(result));
    }
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
