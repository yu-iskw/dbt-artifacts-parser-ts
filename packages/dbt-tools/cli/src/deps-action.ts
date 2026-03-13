/**
 * Deps command action handler.
 */
import {
  ManifestGraph,
  resolveArtifactPaths,
  loadManifest,
  loadCatalog,
  validateSafePath,
  validateResourceId,
  validateDepth,
  DependencyService,
  SQLAnalyzer,
  formatOutput,
  formatDeps,
  shouldOutputJSON,
} from "@dbt-tools/core";

type DepsOptions = {
  direction?: string;
  manifestPath?: string;
  targetDir?: string;
  fields?: string;
  field?: string;
  catalogPath?: string;
  depth?: number;
  format?: string;
  buildOrder?: boolean;
  json?: boolean;
  noJson?: boolean;
};

/** Add field-level lineage to graph and return targetId */
function addFieldLevelLineage(
  manifest: Record<string, unknown>,
  graph: ManifestGraph,
  paths: { catalog?: string },
  resourceId: string,
  fieldName: string,
): string {
  if (!paths.catalog) {
    console.warn(
      "Warning: --field requires catalog.json, but it was not found. Falling back to resource-level lineage.",
    );
    return resourceId;
  }

  try {
    validateSafePath(paths.catalog);
    const catalog = loadCatalog(paths.catalog);
    graph.addFieldNodes(catalog);

    const analyzer = new SQLAnalyzer();
    const adapterType =
      (manifest.metadata as { adapter_type?: string })?.adapter_type || "mysql";

    const nodes = manifest.nodes as
      | Record<string, Record<string, unknown>>
      | undefined;
    if (nodes) {
      for (const [uniqueId, node] of Object.entries(nodes)) {
        const compiledCode = node.compiled_code;
        if (typeof compiledCode === "string") {
          const fieldDeps = analyzer.analyze(compiledCode, adapterType);
          graph.addFieldEdges(uniqueId, fieldDeps);
        }
      }
    }

    return `${resourceId}#${fieldName}`;
  } catch {
    console.warn(
      "Warning: --field requires catalog.json, but it was not found. Falling back to resource-level lineage.",
    );
    return resourceId;
  }
}

/**
 * Deps action handler
 */
export function depsAction(
  resourceId: string,
  options: DepsOptions,
  handleError: (error: unknown, isTTY: boolean) => void,
  isTTY: () => boolean,
): void {
  try {
    validateResourceId(resourceId);

    const direction = options.direction?.toLowerCase();
    if (direction !== "upstream" && direction !== "downstream") {
      throw new Error(
        `Invalid direction: ${options.direction}. Must be 'upstream' or 'downstream'`,
      );
    }

    validateDepth(options.depth);

    const format = (options.format ?? "tree").toLowerCase();
    if (format !== "flat" && format !== "tree") {
      throw new Error(
        `Invalid format: ${options.format}. Must be 'flat' or 'tree'`,
      );
    }

    if (options.buildOrder && direction !== "upstream") {
      throw new Error(`--build-order is only valid with --direction upstream`);
    }

    const paths = resolveArtifactPaths(
      options.manifestPath,
      undefined,
      options.targetDir,
      options.catalogPath,
    );

    validateSafePath(paths.manifest);

    const manifest = loadManifest(paths.manifest);
    const graph = new ManifestGraph(manifest);

    let targetId = resourceId;
    if (options.field) {
      targetId = addFieldLevelLineage(
        manifest as Record<string, unknown>,
        graph,
        paths,
        resourceId,
        options.field,
      );
    }

    const result = DependencyService.getDependencies(
      graph,
      targetId,
      direction as "upstream" | "downstream",
      options.fields,
      options.depth,
      format as "flat" | "tree",
      options.buildOrder,
    );

    const useJson = shouldOutputJSON(options.json, options.noJson);

    if (useJson) {
      console.log(formatOutput(result, true));
    } else {
      console.log(formatDeps(result, format));
    }
  } catch (error) {
    handleError(error, isTTY());
  }
}
