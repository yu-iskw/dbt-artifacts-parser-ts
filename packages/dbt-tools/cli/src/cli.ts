#!/usr/bin/env node

import { Command } from "commander";
import {
  ManifestGraph,
  resolveArtifactPaths,
  loadManifest,
  loadCatalog,
  validateSafePath,
  isTTY,
  shouldOutputJSON,
  formatOutput,
  formatSummary,
  FieldFilter,
  ErrorHandler,
  SQLAnalyzer,
  getCommandSchema,
  getAllSchemas,
  exportGraphToFormat,
  writeGraphOutput,
} from "@dbt-tools/core";
import { runReportAction, depsAction } from "./cli-actions";
import { serveAction } from "./serve-action";

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
  .version("0.1.0");

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

        // Load manifest
        const manifest = loadManifest(paths.manifest);
        const graph = new ManifestGraph(manifest);

        // Enhance with field-level lineage if requested
        if (options.fieldLevel && paths.catalog) {
          try {
            validateSafePath(paths.catalog);
            const catalog = loadCatalog(paths.catalog);
            graph.addFieldNodes(catalog);

            // Analyze SQL for each node
            const analyzer = new SQLAnalyzer();
            // TODO: Determine dialect from manifest adapter type
            const adapterType =
              (manifest.metadata as { adapter_type?: string })?.adapter_type ??
              "mysql";

            if (manifest.nodes) {
              for (const [uniqueId, node] of Object.entries(manifest.nodes)) {
                const compiledCode = (node as Record<string, unknown>)
                  .compiled_code as string | undefined;
                if (compiledCode) {
                  const fieldDeps = analyzer.analyze(compiledCode, adapterType);
                  graph.addFieldEdges(uniqueId, fieldDeps);
                }
              }
            }
          } catch {
            console.warn(
              "Warning: --field-level requires catalog.json, but it was not found. Falling back to resource-level lineage.",
            );
          }
        }

        const output = exportGraphToFormat(graph.getGraph(), {
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
        json?: boolean;
        noJson?: boolean;
      },
    ) =>
      runReportAction(
        runResultsPath,
        manifestPath,
        options,
        handleError,
        isTTY,
      ),
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

/**
 * Serve command: Start a local web server that watches target/ and auto-reloads
 */
program
  .command("serve")
  .description(
    "Serve the dbt-tools UI and auto-reload when artifacts change after dbt run",
  )
  .option("--target <path>", "Path to dbt target directory", "./target")
  .option("--port <n>", "HTTP port", "3000")
  .option("--host <host>", "Bind address", "127.0.0.1")
  .option("--open", "Open browser on start", false)
  .action(
    (options: {
      target: string;
      port: string;
      host: string;
      open: boolean;
    }) => {
      serveAction(options).catch((error) => handleError(error, isTTY()));
    },
  );

// Parse command line arguments
program.parse();
