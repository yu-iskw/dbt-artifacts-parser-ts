#!/usr/bin/env node

import { Command } from "commander";
import * as fs from "fs";
import {
  ManifestGraph,
  ExecutionAnalyzer,
  ArtifactLoader,
  InputValidator,
  OutputFormatter,
  ErrorHandler,
  DependencyService,
  SchemaGenerator,
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
 * Analyze command: Basic summary of project structure
 */
program
  .command("analyze")
  .description("Analyze dbt manifest and provide summary statistics")
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
      options: { targetDir?: string; json?: boolean; noJson?: boolean },
    ) => {
      try {
        // Resolve artifact paths
        const paths = ArtifactLoader.resolveArtifactPaths(
          manifestPath,
          undefined,
          options.targetDir,
        );

        // Validate path
        InputValidator.validateSafePath(paths.manifest);

        // Load manifest
        const manifest = ArtifactLoader.loadManifest(paths.manifest);
        const graph = new ManifestGraph(manifest);
        const summary = graph.getSummary();

        // Format output
        const useJson = OutputFormatter.shouldOutputJSON(
          options.json,
          options.noJson,
        );

        if (useJson) {
          console.log(OutputFormatter.formatOutput(summary, true));
        } else {
          console.log(OutputFormatter.formatAnalyze(summary));
        }
      } catch (error) {
        handleError(error, OutputFormatter.isTTY());
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
  .action(
    (
      manifestPath: string | undefined,
      options: { format?: string; output?: string; targetDir?: string },
    ) => {
      try {
        // Resolve artifact paths
        const paths = ArtifactLoader.resolveArtifactPaths(
          manifestPath,
          undefined,
          options.targetDir,
        );

        // Validate path
        InputValidator.validateSafePath(paths.manifest);
        if (options.output) {
          InputValidator.validateSafePath(options.output);
        }

        // Load manifest
        const manifest = ArtifactLoader.loadManifest(paths.manifest);
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
              nodes.push({ id: nodeId, attributes });
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
        handleError(error, OutputFormatter.isTTY());
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
  .option("--json", "Force JSON output")
  .option("--no-json", "Force human-readable output")
  .action(
    (
      runResultsPath: string | undefined,
      manifestPath: string | undefined,
      options: { targetDir?: string; json?: boolean; noJson?: boolean },
    ) => {
      try {
        // Resolve artifact paths
        const paths = ArtifactLoader.resolveArtifactPaths(
          manifestPath,
          runResultsPath,
          options.targetDir,
        );

        // Validate paths
        InputValidator.validateSafePath(paths.manifest);
        if (paths.runResults) {
          InputValidator.validateSafePath(paths.runResults);
        }

        // Load run results
        const runResults = ArtifactLoader.loadRunResults(paths.runResults!);

        let analyzer: ExecutionAnalyzer | undefined;
        if (paths.manifest) {
          const manifest = ArtifactLoader.loadManifest(paths.manifest);
          const graph = new ManifestGraph(manifest);
          analyzer = new ExecutionAnalyzer(runResults, graph);
        }

        const summary = analyzer
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

        // Format output
        const useJson = OutputFormatter.shouldOutputJSON(
          options.json,
          options.noJson,
        );

        if (useJson) {
          console.log(OutputFormatter.formatOutput(summary, true));
        } else {
          console.log(OutputFormatter.formatRunReport(summary));
        }
      } catch (error) {
        handleError(error, OutputFormatter.isTTY());
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
        json?: boolean;
        noJson?: boolean;
      },
    ) => {
      try {
        // Validate resource ID
        InputValidator.validateResourceId(resourceId);

        // Validate direction
        const direction = options.direction?.toLowerCase();
        if (direction !== "upstream" && direction !== "downstream") {
          throw new Error(
            `Invalid direction: ${options.direction}. Must be 'upstream' or 'downstream'`,
          );
        }

        // Resolve artifact paths
        const paths = ArtifactLoader.resolveArtifactPaths(
          options.manifestPath,
          undefined,
          options.targetDir,
        );

        // Validate path
        InputValidator.validateSafePath(paths.manifest);

        // Load manifest and create graph
        const manifest = ArtifactLoader.loadManifest(paths.manifest);
        const graph = new ManifestGraph(manifest);

        // Get dependencies
        const result = DependencyService.getDependencies(
          graph,
          resourceId,
          direction as "upstream" | "downstream",
          options.fields,
        );

        // Format output
        const useJson = OutputFormatter.shouldOutputJSON(
          options.json,
          options.noJson,
        );

        if (useJson) {
          console.log(OutputFormatter.formatOutput(result, true));
        } else {
          console.log(OutputFormatter.formatDeps(result));
        }
      } catch (error) {
        handleError(error, OutputFormatter.isTTY());
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
        const schema = SchemaGenerator.getCommandSchema(command);
        if (!schema) {
          throw new Error(`Unknown command: ${command}`);
        }
        result = schema;
      } else {
        result = SchemaGenerator.getAllSchemas();
      }

      // Schema command always outputs JSON
      console.log(OutputFormatter.formatOutput(result, true));
    } catch (error) {
      handleError(error, OutputFormatter.isTTY());
    }
  });

// Parse command line arguments
program.parse();
