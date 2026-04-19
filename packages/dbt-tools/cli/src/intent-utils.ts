import {
  FieldFilter,
  ManifestGraph,
  discoverResources,
  formatOutput,
  loadManifest,
  shouldOutputJSON,
  validateNoControlChars,
  validateSafePath,
  type DiscoveryMatch,
} from "@dbt-tools/core";
import {
  resolveCliArtifactPaths,
  type ArtifactRootCliOptions,
} from "./cli-artifact-resolve";

export interface IntentCommonOptions extends ArtifactRootCliOptions {
  fields?: string;
  json?: boolean;
  noJson?: boolean;
}

export interface IntentContext {
  graph: ManifestGraph;
}

export async function buildIntentContext(
  options: ArtifactRootCliOptions,
): Promise<IntentContext> {
  const paths = await resolveCliArtifactPaths(
    { dbtTarget: options.dbtTarget },
    { manifest: true, runResults: false },
  );
  validateSafePath(paths.manifest);
  const manifest = loadManifest(paths.manifest);
  return { graph: new ManifestGraph(manifest) };
}

export function emitIntentOutput(
  output: unknown,
  options: Pick<IntentCommonOptions, "fields" | "json" | "noJson">,
  humanFormatter: (value: unknown) => string,
): void {
  const useJson = shouldOutputJSON(options.json, options.noJson);
  if (useJson) {
    const filtered =
      options.fields != null ? FieldFilter.filterFields(output, options.fields) : output;
    console.log(formatOutput(filtered, true));
    return;
  }
  console.log(humanFormatter(output));
}

export function resolveTargetMatch(
  queryOrUniqueId: string,
  graph: ManifestGraph,
): DiscoveryMatch {
  validateNoControlChars(queryOrUniqueId);
  const discovered = discoverResources(graph, queryOrUniqueId, { limit: 5 });
  const match = discovered.matches[0];
  if (!match) {
    throw new Error(`No resource resolved for input "${queryOrUniqueId}"`);
  }
  return match;
}

export function buildWebUrl(
  path: "/search" | "/inventory",
  params: Record<string, string | undefined>,
): string {
  const base =
    process.env.DBT_TOOLS_WEB_BASE_URL?.trim() || "http://localhost:5173";
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

