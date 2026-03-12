#!/usr/bin/env node

import { Command } from "commander";
import * as fs from "fs";
import {
  ManifestGraph,
  ExecutionAnalyzer,
  resolveArtifactPaths,
  loadManifest,
  loadRunResults,
  validateSafePath,
  validateResourceId,
  isTTY,
  shouldOutputJSON,
  formatOutput,
  formatSummary,
  formatDeps,
  formatRunReport,
  FieldFilter,
  ErrorHandler,
  DependencyService,
  getCommandSchema,
  getAllSchemas,
} from "@dbt-tools/core";

const program = new Command();

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
  .argument(
    "[manifest-path]",
    "Path to manifest.json file (defaults to ./target/manifest.json)",
  )
  .option(
    "--target-dir <dir>",
    "Custom target directory (defaults to ./target)",
  )
  .option("--json", "Force JSON output")
  .option("--no-json", "Force human-readable output")
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
  .argument(
    "[manifest-path]",
    "Path to manifest.json file (defaults to ./target/manifest.json)",
  )
  .option("--format <format>", "Export format: json, dot, gexf", "json")
  .option("--output <path>", "Output file path (default: stdout)")
  .option(
    "--target-dir <dir>",
    "Custom target directory (defaults to ./target)",
  )
  .option("--fields <fields>", "Comma-separated list of fields to include")
  .action(
    (
      manifestPath: string | undefined,
      options: {
        format?: string;
        output?: string;
        targetDir?: string;
        fields?: string;
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
        if (options.output) {
          validateSafePath(options.output);
        }

        // Load manifest
        const manifest = loadManifest(paths.manifest);
        const graph = new ManifestGraph(manifest);
        const graphologyGraph = graph.getGraph();

        let output: string;

        switch (options.format?.toLowerCase()) {
          case "json": {
            // Export as JSON
            const nodes: Array<{ id: string; attributes: unknown }> = [];
            const edges: Array<{
              source: string;
              target: string;
              attributes: unknown;
            }> = [];

            graphologyGraph.forEachNode((nodeId, attributes) => {
              let filteredAttrs: unknown = attributes;
              if (options.fields) {
                filteredAttrs = FieldFilter.filterFields(
                  attributes,
                  options.fields,
                );
              }
              nodes.push({ id: nodeId, attributes: filteredAttrs });
            });

            graphologyGraph.forEachEdge(
              (edgeId, attributes, source, target) => {
                edges.push({
                  source,
                  target,
                  attributes,
                });
              },
            );

            output = JSON.stringify({ nodes, edges }, null, 2);
            break;
          }

          case "dot": {
            // Export as Graphviz DOT format
            const lines: string[] = ["digraph DbtGraph {"];
            graphologyGraph.forEachNode((nodeId, attributes) => {
              const name = (attributes.name as string) || nodeId;
              const label = `"${name}"`;
              lines.push(`  "${nodeId}" [label=${label}];`);
            });
            graphologyGraph.forEachEdge(
              (edgeId, attributes, source, target) => {
                lines.push(`  "${source}" -> "${target}";`);
              },
            );
            lines.push("}");
            output = lines.join("\n");
            break;
          }

          case "gexf": {
            // Export as GEXF format (simplified)
            const nodes: Array<{ id: string; label: string }> = [];
            const edges: Array<{ source: string; target: string }> = [];

            graphologyGraph.forEachNode((nodeId, attributes) => {
              nodes.push({
                id: nodeId,
                label: (attributes.name as string) || nodeId,
              });
            });

            graphologyGraph.forEachEdge(
              (edgeId, attributes, source, target) => {
                edges.push({ source, target });
              },
            );

            output = `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">
  <graph mode="static" defaultedgetype="directed">
    <nodes>
${nodes.map((n) => `      <node id="${n.id}" label="${n.label}"/>`).join("\n")}
    </nodes>
    <edges>
${edges.map((e, i) => `      <edge id="${i}" source="${e.source}" target="${e.target}"/>`).join("\n")}
    </edges>
  </graph>
</gexf>`;
            break;
          }

          default:
            throw new Error(`Unsupported format: ${options.format}`);
        }

        if (options.output) {
          fs.writeFileSync(options.output, output, "utf-8");
          console.log(`Graph exported to ${options.output}`);
        } else {
          console.log(output);
        }
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
    "[manifest-path]",
    "Path to manifest.json file (optional, for critical path)",
  )
  .option(
    "--target-dir <dir>",
    "Custom target directory (defaults to ./target)",
  )
  .option("--fields <fields>", "Comma-separated list of fields to include")
  .option("--json", "Force JSON output")
  .option("--no-json", "Force human-readable output")
  .action(
    (
      runResultsPath: string | undefined,
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
          runResultsPath,
          options.targetDir,
        );

        // Validate paths
        validateSafePath(paths.manifest);
        if (paths.runResults) {
          validateSafePath(paths.runResults);
        }

        // Load run results
        const runResults = loadRunResults(paths.runResults!);

        let analyzer: ExecutionAnalyzer | undefined;
        if (paths.manifest) {
          const manifest = loadManifest(paths.manifest);
          const graph = new ManifestGraph(manifest);
          analyzer = new ExecutionAnalyzer(runResults, graph);
        }

        let summary = analyzer
          ? analyzer.getSummary()
          : {
              total_execution_time: runResults.elapsed_time || 0,
              total_nodes: runResults.results?.length || 0,
              nodes_by_status: {} as Record<string, number>,
              node_executions: [] as Array<{
                unique_id: string;
                status: string;
                execution_time: number;
              }>,
            };

        // If no analyzer, compute basic stats
        if (!analyzer && runResults.results) {
          const nodesByStatus: Record<string, number> = {};
          for (const result of runResults.results) {
            const status = result.status || "unknown";
            nodesByStatus[status] = (nodesByStatus[status] || 0) + 1;
          }
          summary.nodes_by_status = nodesByStatus;
        }

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
          console.log(formatRunReport(summary));
        }
      } catch (error) {
        handleError(error, isTTY());
      }
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
  .option(
    "--target-dir <dir>",
    "Custom target directory (defaults to ./target)",
  )
  .option("--fields <fields>", "Comma-separated list of fields to include")
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
  .option("--json", "Force JSON output")
  .option("--no-json", "Force human-readable output")
  .action(
    (
      resourceId: string,
      options: {
        direction?: string;
        manifestPath?: string;
        targetDir?: string;
        fields?: string;
        depth?: number;
        format?: string;
        buildOrder?: boolean;
        json?: boolean;
        noJson?: boolean;
      },
    ) => {
      try {
        // Validate resource ID
        validateResourceId(resourceId);

        // Validate direction
        const direction = options.direction?.toLowerCase();
        if (direction !== "upstream" && direction !== "downstream") {
          throw new Error(
            `Invalid direction: ${options.direction}. Must be 'upstream' or 'downstream'`,
          );
        }

        // Validate depth if provided
        const depth = options.depth;
        if (depth !== undefined && (typeof depth !== "number" || depth < 1)) {
          throw new Error(
            `Invalid depth: ${options.depth}. Must be a positive integer`,
          );
        }

        // Validate format
        const format = (options.format ?? "tree").toLowerCase();
        if (format !== "flat" && format !== "tree") {
          throw new Error(
            `Invalid format: ${options.format}. Must be 'flat' or 'tree'`,
          );
        }

        // Validate build-order: only valid with upstream
        if (options.buildOrder && direction !== "upstream") {
          throw new Error(
            `--build-order is only valid with --direction upstream`,
          );
        }

        // Resolve artifact paths
        const paths = resolveArtifactPaths(
          options.manifestPath,
          undefined,
          options.targetDir,
        );

        // Validate path
        validateSafePath(paths.manifest);

        // Load manifest and create graph
        const manifest = loadManifest(paths.manifest);
        const graph = new ManifestGraph(manifest);

        // Get dependencies
        const result = DependencyService.getDependencies(
          graph,
          resourceId,
          direction as "upstream" | "downstream",
          options.fields,
          options.depth,
          format as "flat" | "tree",
          options.buildOrder,
        );

        // Format output
        const useJson = shouldOutputJSON(options.json, options.noJson);

        if (useJson) {
          console.log(formatOutput(result, true));
        } else {
          console.log(formatDeps(result, format));
        }
      } catch (error) {
        handleError(error, isTTY());
      }
    },
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
