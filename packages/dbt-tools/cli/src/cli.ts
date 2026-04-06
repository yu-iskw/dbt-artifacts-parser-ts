#!/usr/bin/env node

import { Command } from "commander";
import {
  ManifestGraph,
  resolveArtifactPaths,
  loadManifest,
  validateSafePath,
  isTTY,
  shouldOutputJSON,
  formatOutput,
  formatSummary,
  FieldFilter,
  ErrorHandler,
  getCommandSchema,
  getAllSchemas,
} from "@dbt-tools/core";
import {
  runReportAction,
  depsAction,
  inventoryAction,
  timelineAction,
  searchAction,
  statusAction,
  graphAction,
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
 * Graph export command: Export graph in various formats
 */
program
  .command("graph")
  .description("Export dependency graph")
  .argument(ARG_MANIFEST_PATH, DESC_MANIFEST)
  .option("--format <format>", DESC_GRAPH_FORMAT, DEFAULT_GRAPH_FORMAT)
  .option("--output <path>", "Output file path (default: stdout)")
  .option(OPT_TARGET_DIR, DESC_TARGET_DIR)
  .option(OPT_FIELDS, DESC_FIELDS)
  .option("--field-level", "Include field-level (column-level) lineage")
  .option("--catalog-path <path>", "Path to catalog.json file")
  .option("--focus <selector>", "Focus graph export on a node or selector")
  .option("--depth <number>", "Max depth for --focus traversal", parseInt)
  .option(
    "--direction <direction>",
    "Direction for --focus traversal: upstream|downstream|both",
    "both",
  )
  .option(
    "--resource-types <types>",
    "Comma-separated resource types for focused graph",
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
        depth?: number;
        direction?: "upstream" | "downstream" | "both";
        resourceTypes?: string;
      },
    ) => graphAction(manifestPath, options, { handleError, isTTY }),
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
  .option(
    "--format <format>",
    "Output structure: flat list or nested tree",
    "tree",
  )
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

program
  .command("inventory")
  .description("List and filter dbt resources from manifest")
  .option("--manifest-path <path>", "Path to manifest.json file")
  .option("--run-results-path <path>", "Path to run_results.json file")
  .option(OPT_TARGET_DIR, DESC_TARGET_DIR)
  .option("--type <type>", "Filter by resource type")
  .option("--package <package>", "Filter by package name")
  .option("--tag <tag>", "Filter by tag")
  .option("--path <path>", "Filter by file path segment")
  .option("--owner <owner>", "Filter by owner")
  .option("--group <group>", "Filter by group")
  .option("--status <status>", "Filter by run status")
  .option(OPT_FIELDS, DESC_FIELDS)
  .option("--format <format>", "Output format: json or table")
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action((options) => inventoryAction(options, { handleError, isTTY }));

program
  .command("timeline")
  .description("Show per-node execution timeline rows from run_results.json")
  .option("--manifest-path <path>", "Path to manifest.json file")
  .option("--run-results-path <path>", "Path to run_results.json file")
  .option(OPT_TARGET_DIR, DESC_TARGET_DIR)
  .option("--sort <sort>", "Sort by duration or start", "duration")
  .option("--top <n>", "Top N rows after sorting", parseInt)
  .option("--failed-only", "Show only failed/error/warn entries")
  .option("--status <status>", "Filter by status (comma-separated)")
  .option("--format <format>", "Output format: json, table, csv")
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action((options) => timelineAction(options, { handleError, isTTY }));

program
  .command("search")
  .description("Search dbt manifest resources")
  .argument("[terms...]", "Search terms (supports scoped tokens like tag:finance)")
  .option("--manifest-path <path>", "Path to manifest.json file")
  .option(OPT_TARGET_DIR, DESC_TARGET_DIR)
  .option("--type <type>", "Filter by resource type")
  .option("--package <package>", "Filter by package name")
  .option("--tag <tag>", "Filter by tag")
  .option("--path <path>", "Filter by file path segment")
  .option("--top <n>", "Limit number of results", parseInt)
  .option("--format <format>", "Output format: json or table")
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action((terms: string[], options) =>
    searchAction(terms, options, { handleError, isTTY }),
  );

program
  .command("status")
  .description("Report local artifact availability/readiness/freshness")
  .option("--manifest-path <path>", "Path to manifest.json file")
  .option("--run-results-path <path>", "Path to run_results.json file")
  .option(OPT_TARGET_DIR, DESC_TARGET_DIR)
  .option("--json", DESC_JSON)
  .option("--no-json", DESC_NO_JSON)
  .action((options) => statusAction(options, { handleError, isTTY }));

program
  .command("freshness")
  .description("Alias for status")
  .option("--manifest-path <path>", "Path to manifest.json file")
  .option("--run-results-path <path>", "Path to run_results.json file")
  .option(OPT_TARGET_DIR, DESC_TARGET_DIR)
  .option("--json", DESC_JSON)
  .option("--no-json", DESC_NO_JSON)
  .action((options) => statusAction(options, { handleError, isTTY }));

// Parse command line arguments
program.parse();
