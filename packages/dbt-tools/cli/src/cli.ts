#!/usr/bin/env node

import { Command } from "commander";
import {
  ManifestGraph,
  resolveArtifactPaths,
  loadManifest,
  loadCatalog,
  validateSafePath,
  validateDepth,
  validateResourceId,
  isTTY,
  shouldOutputJSON,
  formatOutput,
  formatSummary,
  FieldFilter,
  ErrorHandler,
  SQLAnalyzer,
  sqlDialectFromDbtAdapterType,
  getCommandSchema,
  getAllSchemas,
  exportGraphToFormat,
  writeGraphOutput,
} from "@dbt-tools/core";
import {
  runReportAction,
  depsAction,
  inventoryAction,
  timelineAction,
  searchAction,
  statusAction,
} from "./cli-actions";
import { CLI_PACKAGE_VERSION } from "./version";

const program = new Command();

/** CLI option/argument description constants (avoid no-duplicate-string) */
const ARG_MANIFEST_PATH = "[manifest-path]";
const DESC_MANIFEST =
  "Path to manifest.json file (defaults to ./target/manifest.json)";
const OPT_TARGET_DIR = "--target-dir <dir>";
const DESC_TARGET_DIR = "Custom target directory (defaults to ./target)";
const OPT_JSON = "--json";
const DESC_JSON = "Force JSON output";
const OPT_NO_JSON = "--no-json";
const DESC_NO_JSON = "Force human-readable output";
const DESC_GRAPH_FORMAT = "Export format: json, dot, gexf";
const DEFAULT_GRAPH_FORMAT = "json";
const OPT_FIELDS = "--fields <fields>";
const DESC_FIELDS = "Comma-separated list of fields to include";
const OPT_FORMAT = "--format <format>";

program
  .name("dbt-tools")
  .description("Command-line interface for dbt artifact analysis")
  .version(CLI_PACKAGE_VERSION);

/**
 * Handle errors with proper formatting
 */
function handleError(error: unknown, isTTY: boolean): void {
  const formatted = ErrorHandler.formatError(
    error instanceof Error ? error : new Error(String(error)),
    isTTY,
  );

  if (typeof formatted === "string") {
    console.error(formatted);
  } else {
    console.error(JSON.stringify(formatted, null, 2));
  }
  process.exit(1);
}

function tryApplyFieldLevelLineageToGraph(
  graph: ManifestGraph,
  manifest: ReturnType<typeof loadManifest>,
  catalogPath: string,
): void {
  validateSafePath(catalogPath);
  let catalog: ReturnType<typeof loadCatalog> | undefined;
  try {
    catalog = loadCatalog(catalogPath);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.startsWith("Catalog file not found:")) {
      console.warn(
        "Warning: --field-level requires catalog.json, but it was not found. Falling back to resource-level lineage.",
      );
      return;
    }
    throw error;
  }
  graph.addFieldNodes(catalog);

  const analyzer = new SQLAnalyzer();
  const adapterType = (
    manifest.metadata as { adapter_type?: string } | undefined
  )?.adapter_type;
  const sqlDialect = sqlDialectFromDbtAdapterType(adapterType);

  if (manifest.nodes) {
    for (const [uniqueId, node] of Object.entries(manifest.nodes)) {
      const compiledCode = (node as Record<string, unknown>).compiled_code as
        | string
        | undefined;
      if (compiledCode) {
        const fieldDeps = analyzer.analyze(compiledCode, sqlDialect);
        graph.addFieldEdges(uniqueId, fieldDeps);
      }
    }
  }
}

/**
 * Summary command: Basic summary of project structure
 */
program
  .command("summary")
  .description("Provide summary statistics for dbt manifest")
  .argument(ARG_MANIFEST_PATH, DESC_MANIFEST)
  .option(OPT_TARGET_DIR, DESC_TARGET_DIR)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    (
      manifestPath: string | undefined,
      options: {
        targetDir?: string;
        fields?: string;
        json?: boolean;
        noJson?: boolean;
      },
    ) => {
      try {
        // Resolve artifact paths
        const paths = resolveArtifactPaths(
          manifestPath,
          undefined,
          options.targetDir,
        );

        // Validate path
        validateSafePath(paths.manifest);

        // Load manifest
        const manifest = loadManifest(paths.manifest);
        const graph = new ManifestGraph(manifest);
        let summary = graph.getSummary();

        // Apply field filtering if requested
        if (options.fields) {
          summary = FieldFilter.filterFields(
            summary,
            options.fields,
          ) as typeof summary;
        }

        // Format output
        const useJson = shouldOutputJSON(options.json, options.noJson);

        if (useJson) {
          console.log(formatOutput(summary, true));
        } else {
          console.log(formatSummary(summary));
        }
      } catch (error) {
        handleError(error, isTTY());
      }
    },
  );

/**
 * Graph export command: Export graph in various formats.
 * Supports optional subgraph focus via --focus, --focus-depth, --focus-direction,
 * and --resource-types.
 */
program
  .command("graph")
  .description("Export dependency graph")
  .argument(ARG_MANIFEST_PATH, DESC_MANIFEST)
  .option(OPT_FORMAT, DESC_GRAPH_FORMAT, DEFAULT_GRAPH_FORMAT)
  .option("--output <path>", "Output file path (default: stdout)")
  .option(OPT_TARGET_DIR, DESC_TARGET_DIR)
  .option(OPT_FIELDS, DESC_FIELDS)
  .option("--field-level", "Include field-level (column-level) lineage")
  .option("--catalog-path <path>", "Path to catalog.json file")
  .option(
    "--focus <resource-id>",
    "Focus on a single node; exports its subgraph only",
  )
  .option(
    "--focus-depth <number>",
    "Max traversal depth for --focus (default: unlimited)",
    parseInt,
  )
  .option(
    "--focus-direction <direction>",
    "Traversal direction for --focus: upstream, downstream, or both (default: both)",
    "both",
  )
  .option(
    "--resource-types <types>",
    "Comma-separated resource types to include (filters nodes when --focus is set)",
  )
  .action(
    (
      manifestPath: string | undefined,
      options: {
        format?: string;
        output?: string;
        targetDir?: string;
        fields?: string;
        fieldLevel?: boolean;
        catalogPath?: string;
        focus?: string;
        focusDepth?: number;
        focusDirection?: string;
        resourceTypes?: string;
      },
    ) => {
      try {
        // Resolve artifact paths
        const paths = resolveArtifactPaths(
          manifestPath,
          undefined,
          options.targetDir,
          options.catalogPath,
        );

        // Validate path
        validateSafePath(paths.manifest);
        if (options.output) {
          validateSafePath(options.output);
        }

        const focusDirection = (options.focusDirection ?? "both").toLowerCase();
        if (!["upstream", "downstream", "both"].includes(focusDirection)) {
          throw new Error(
            `--focus-direction must be one of: upstream, downstream, both`,
          );
        }

        if (options.focusDepth !== undefined) {
          validateDepth(options.focusDepth);
        }

        // Load manifest
        const manifest = loadManifest(paths.manifest);
        const graph = new ManifestGraph(manifest);

        // Enhance with field-level lineage if requested
        if (options.fieldLevel && paths.catalog) {
          tryApplyFieldLevelLineageToGraph(graph, manifest, paths.catalog);
        }

        let targetGraph = graph.getGraph();

        // Apply subgraph focus if requested
        if (options.focus) {
          validateResourceId(options.focus);
          const allowedTypes = options.resourceTypes
            ? new Set(
                options.resourceTypes
                  .split(",")
                  .map((t) => t.trim().toLowerCase())
                  .filter(Boolean),
              )
            : undefined;
          targetGraph = graph.buildSubgraph(
            options.focus,
            focusDirection as "upstream" | "downstream" | "both",
            options.focusDepth,
            allowedTypes,
          );
        }

        const output = exportGraphToFormat(targetGraph, {
          format: options.format,
          output: options.output,
          fields: options.fields,
        });
        writeGraphOutput(output, options.output);
      } catch (error) {
        handleError(error, isTTY());
      }
    },
  );

/**
 * Run report command: Execution summary from run_results.json
 */
program
  .command("run-report")
  .description("Generate execution report from run_results.json")
  .argument(
    "[run-results-path]",
    "Path to run_results.json file (defaults to ./target/run_results.json)",
  )
  .argument(
    ARG_MANIFEST_PATH,
    "Path to manifest.json file (optional, for critical path)",
  )
  .option(OPT_TARGET_DIR, DESC_TARGET_DIR)
  .option(OPT_FIELDS, DESC_FIELDS)
  .option("--bottlenecks", "Include bottleneck section in report")
  .option(
    "--bottlenecks-top <n>",
    "Top N slowest nodes (default: 10 when --bottlenecks)",
    parseInt,
  )
  .option(
    "--bottlenecks-threshold <s>",
    "Nodes exceeding s seconds (alternative to top-N)",
    parseFloat,
  )
  .option(
    "--adapter-summary",
    "Include adapter_response aggregates (and default top-5 slot/bytes in human output)",
  )
  .option(
    "--adapter-top-by <metric>",
    "Rank nodes by adapter metric: bytes_processed | slot_ms | rows_affected",
  )
  .option(
    "--adapter-top-n <n>",
    "Top N for --adapter-top-by (default: 10)",
    parseInt,
  )
  .option(
    "--adapter-min-bytes <n>",
    "When using --adapter-top-by, require bytes_processed >= n",
    parseFloat,
  )
  .option(
    "--adapter-min-slot-ms <n>",
    "When using --adapter-top-by, require slot_ms >= n",
    parseFloat,
  )
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    (
      runResultsPath: string | undefined,
      manifestPath: string | undefined,
      options: {
        targetDir?: string;
        fields?: string;
        bottlenecks?: boolean;
        bottlenecksTop?: number;
        bottlenecksThreshold?: number;
        adapterSummary?: boolean;
        adapterTopBy?: string;
        adapterTopN?: number;
        adapterMinBytes?: number;
        adapterMinSlotMs?: number;
        json?: boolean;
        noJson?: boolean;
      },
    ) => {
      const allowed = new Set(["bytes_processed", "slot_ms", "rows_affected"]);
      let adapterTopBy:
        | "bytes_processed"
        | "slot_ms"
        | "rows_affected"
        | undefined;
      if (options.adapterTopBy != null && options.adapterTopBy !== "") {
        if (!allowed.has(options.adapterTopBy)) {
          handleError(
            new Error(
              `--adapter-top-by must be one of: ${[...allowed].join(", ")}`,
            ),
            isTTY(),
          );
          return;
        }
        adapterTopBy = options.adapterTopBy as
          | "bytes_processed"
          | "slot_ms"
          | "rows_affected";
      }
      runReportAction(
        runResultsPath,
        manifestPath,
        {
          targetDir: options.targetDir,
          fields: options.fields,
          bottlenecks: options.bottlenecks,
          bottlenecksTop: options.bottlenecksTop,
          bottlenecksThreshold: options.bottlenecksThreshold,
          adapterSummary: options.adapterSummary,
          adapterTopBy,
          adapterTopN: options.adapterTopN,
          adapterMinBytes: options.adapterMinBytes,
          adapterMinSlotMs: options.adapterMinSlotMs,
          json: options.json,
          noJson: options.noJson,
        },
        handleError,
        isTTY,
      );
    },
  );

/**
 * Deps command: Get upstream or downstream dependencies
 */
program
  .command("deps")
  .description("Get upstream or downstream dependencies for a dbt resource")
  .argument(
    "<resource-id>",
    "Unique ID of the dbt resource (e.g., model.my_project.customers)",
  )
  .option(
    "--direction <direction>",
    "Direction: upstream or downstream",
    "downstream",
  )
  .option("--manifest-path <path>", "Path to manifest.json file")
  .option(OPT_TARGET_DIR, DESC_TARGET_DIR)
  .option(OPT_FIELDS, DESC_FIELDS)
  .option("--field <name>", "Specific field (column) to trace dependencies for")
  .option("--catalog-path <path>", "Path to catalog.json file")
  .option(
    "--depth <number>",
    "Max traversal depth; 1 = immediate neighbors, omit for all levels",
    parseInt,
  )
  .option(OPT_FORMAT, "Output structure: flat list or nested tree", "tree")
  .option(
    "--build-order",
    "Output upstream dependencies in topological build order (only with --direction upstream)",
  )
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    (
      resourceId: string,
      options: {
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
      },
    ) => depsAction(resourceId, options, handleError, isTTY),
  );

/**
 * Inventory command: List and filter dbt resources from manifest
 */
program
  .command("inventory")
  .description("List and filter dbt resources from manifest")
  .argument(ARG_MANIFEST_PATH, DESC_MANIFEST)
  .option("--type <type>", "Filter by resource type(s), comma-separated")
  .option("--package <package>", "Filter by package name")
  .option("--tag <tag>", "Filter by tag(s), comma-separated")
  .option("--path <path>", "Filter by file path substring")
  .option(OPT_FIELDS, DESC_FIELDS)
  .option(OPT_TARGET_DIR, DESC_TARGET_DIR)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    (
      manifestPath: string | undefined,
      options: {
        type?: string;
        package?: string;
        tag?: string;
        path?: string;
        fields?: string;
        targetDir?: string;
        json?: boolean;
        noJson?: boolean;
      },
    ) => inventoryAction(manifestPath, options, handleError, isTTY),
  );

/**
 * Timeline command: Per-node execution entries from run_results.json
 */
program
  .command("timeline")
  .description(
    "Show per-node execution timeline from run_results.json (row-level, unlike run-report)",
  )
  .argument(
    "[run-results-path]",
    "Path to run_results.json (defaults to ./target/run_results.json)",
  )
  .argument(
    "[manifest-path]",
    "Path to manifest.json (optional, enriches entries with name and type)",
  )
  .option("--sort <key>", "Sort key: duration (default) or start", "duration")
  .option("--top <n>", "Show top N entries only", parseInt)
  .option("--failed-only", "Show only non-successful executions")
  .option(
    "--status <status>",
    "Filter by status (comma-separated, e.g. error,warn)",
  )
  .option(
    OPT_FORMAT,
    "Output format: json (default non-TTY), table (default TTY), csv",
  )
  .option(OPT_TARGET_DIR, DESC_TARGET_DIR)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    (
      runResultsPath: string | undefined,
      manifestPath: string | undefined,
      options: {
        sort?: string;
        top?: number;
        failedOnly?: boolean;
        status?: string;
        format?: string;
        targetDir?: string;
        json?: boolean;
        noJson?: boolean;
      },
    ) =>
      timelineAction(runResultsPath, manifestPath, options, handleError, isTTY),
  );

/**
 * Search command: Fast manifest search across dbt entities
 */
program
  .command("search")
  .description("Search for dbt resources by name, tag, type, or free text")
  .argument(
    "[query]",
    "Search query; supports key:value tokens like type:model tag:finance",
  )
  .argument(ARG_MANIFEST_PATH, DESC_MANIFEST)
  .option("--type <type>", "Filter by resource type(s), comma-separated")
  .option("--package <package>", "Filter by package name")
  .option("--tag <tag>", "Filter by tag(s), comma-separated")
  .option("--path <path>", "Filter by file path substring")
  .option(OPT_FIELDS, DESC_FIELDS)
  .option(OPT_TARGET_DIR, DESC_TARGET_DIR)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    (
      query: string | undefined,
      manifestPath: string | undefined,
      options: {
        type?: string;
        package?: string;
        tag?: string;
        path?: string;
        fields?: string;
        targetDir?: string;
        json?: boolean;
        noJson?: boolean;
      },
    ) => searchAction(query, manifestPath, options, handleError, isTTY),
  );

/**
 * Status command: Report artifact presence, freshness, and readiness
 */
program
  .command("status")
  .description(
    "Report dbt artifact presence, modification times, and analysis readiness",
  )
  .option(OPT_TARGET_DIR, DESC_TARGET_DIR)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action((options: { targetDir?: string; json?: boolean; noJson?: boolean }) =>
    statusAction(options, handleError, isTTY),
  );

/**
 * Freshness command: Alias for status with freshness framing
 */
program
  .command("freshness")
  .description("Alias for status – shows artifact recency and readiness")
  .option(OPT_TARGET_DIR, DESC_TARGET_DIR)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action((options: { targetDir?: string; json?: boolean; noJson?: boolean }) =>
    statusAction(options, handleError, isTTY),
  );

/**
 * Schema command: Get command schema for introspection
 */
program
  .command("schema")
  .description("Get machine-readable schema for a command")
  .argument(
    "[command]",
    "Command name (if omitted, returns all command schemas)",
  )
  .option("--json", "Force JSON output (always JSON by default)")
  .action((command: string | undefined, _options: { json?: boolean }) => {
    try {
      let result: unknown;

      if (command) {
        const schema = getCommandSchema(command);
        if (!schema) {
          throw new Error(`Unknown command: ${command}`);
        }
        result = schema;
      } else {
        result = getAllSchemas();
      }

      // Schema command always outputs JSON
      console.log(formatOutput(result, true));
    } catch (error) {
      handleError(error, isTTY());
    }
  });

// Parse command line arguments
program.parse();
