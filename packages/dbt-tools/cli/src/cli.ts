#!/usr/bin/env node

import { Command } from "commander";
import * as fs from "fs";
import {
  ManifestGraph,
  ExecutionAnalyzer,
  resolveArtifactPaths,
  loadManifest,
  loadRunResults,
  loadCatalog,
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
  SQLAnalyzer,
  getCommandSchema,
  getAllSchemas,
  detectBottlenecks,
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
        if (options.fieldLevel) {
          if (paths.catalog) {
            validateSafePath(paths.catalog);
            const catalog = loadCatalog(paths.catalog);
            graph.addFieldNodes(catalog);

            // Analyze SQL for each node
            const analyzer = new SQLAnalyzer();
            // TODO: Determine dialect from manifest adapter type
            const adapterType =
              (manifest.metadata as any)?.adapter_type || "mysql";

            if (manifest.nodes) {
              for (const [uniqueId, node] of Object.entries(manifest.nodes)) {
                const compiledCode = (node as any).compiled_code;
                if (compiledCode) {
                  const fieldDeps = analyzer.analyze(compiledCode, adapterType);
                  graph.addFieldEdges(uniqueId, fieldDeps);
                }
              }
            }
          } else {
            console.warn(
              "Warning: --field-level requires catalog.json, but it was not found.",
            );
          }
        }

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
            lines.push("  compound=true;");
            lines.push("  node [shape=box, style=filled, fillcolor=white];");

            const resourceNodes: string[] = [];
            const fieldNodesByParent: Record<string, string[]> = {};

            graphologyGraph.forEachNode((nodeId, attributes) => {
              if (attributes.resource_type === "field") {
                const parentId = attributes.parent_id as string;
                if (!fieldNodesByParent[parentId]) {
                  fieldNodesByParent[parentId] = [];
                }
                fieldNodesByParent[parentId].push(nodeId);
              } else {
                resourceNodes.push(nodeId);
              }
            });

            // Add clusters for resources with fields
            for (const nodeId of resourceNodes) {
              const attributes = graphologyGraph.getNodeAttributes(nodeId);
              const name = (attributes.name as string) || nodeId;
              const fields = fieldNodesByParent[nodeId];

              if (fields && fields.length > 0) {
                lines.push(`  subgraph "cluster_${nodeId}" {`);
                lines.push(`    label = "${name}";`);
                lines.push("    style = filled;");
                lines.push("    fillcolor = lightgrey;");
                for (const fieldId of fields) {
                  const fieldAttr = graphologyGraph.getNodeAttributes(fieldId);
                  lines.push(
                    `    "${fieldId}" [label="${fieldAttr.name}", fillcolor=white];`,
                  );
                }
                lines.push("  }");
              } else {
                lines.push(`  "${nodeId}" [label="${name}"];`);
              }
            }

            graphologyGraph.forEachEdge(
              (edgeId, attributes, source, target) => {
                // Only show non-internal edges, or show all?
                // For field-level, internal edges are mostly for clusters.
                if (attributes.dependency_type !== "internal") {
                  lines.push(`  "${source}" -> "${target}";`);
                }
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
  .option("--json", "Force JSON output")
  .option("--no-json", "Force human-readable output")
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
        let graph: ManifestGraph | undefined;
        if (paths.manifest) {
          const manifest = loadManifest(paths.manifest);
          graph = new ManifestGraph(manifest);
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

        // Bottleneck detection
        let bottlenecks:
          | {
              nodes: Array<{
                unique_id: string;
                name?: string;
                execution_time: number;
                rank: number;
                pct_of_total: number;
                status: string;
              }>;
              total_execution_time: number;
              criteria_used: "top_n" | "threshold";
            }
          | undefined;
        let bottlenecksTopLabel: string | undefined;

        if (options.bottlenecks && summary.node_executions?.length) {
          const topN = options.bottlenecksTop ?? 10;
          const threshold = options.bottlenecksThreshold;

          if (
            options.bottlenecksTop !== undefined &&
            options.bottlenecksThreshold !== undefined
          ) {
            throw new Error(
              "Cannot use both --bottlenecks-top and --bottlenecks-threshold; choose one",
            );
          }

          if (threshold !== undefined && threshold > 0) {
            bottlenecks = detectBottlenecks(summary.node_executions, {
              mode: "threshold",
              min_seconds: threshold,
              graph,
            });
            bottlenecksTopLabel = `>= ${threshold}s`;
          } else {
            bottlenecks = detectBottlenecks(summary.node_executions, {
              mode: "top_n",
              top: topN > 0 ? topN : 10,
              graph,
            });
            bottlenecksTopLabel = `top ${topN}`;
          }
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
          const report: Record<string, unknown> = {
            ...summary,
          };
          if (bottlenecks) {
            report.bottlenecks = bottlenecks;
          }
          console.log(formatOutput(report, true));
        } else {
          console.log(
            formatRunReport(summary, bottlenecks, bottlenecksTopLabel),
          );
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
        field?: string;
        catalogPath?: string;
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
          options.catalogPath,
        );

        // Validate path
        validateSafePath(paths.manifest);

        // Load manifest and create graph
        const manifest = loadManifest(paths.manifest);
        const graph = new ManifestGraph(manifest);

        let targetId = resourceId;

        // If field-level trace is requested
        if (options.field) {
          if (paths.catalog) {
            validateSafePath(paths.catalog);
            const catalog = loadCatalog(paths.catalog);
            graph.addFieldNodes(catalog);

            // Analyze SQL for involved nodes
            const analyzer = new SQLAnalyzer();
            const adapterType =
              (manifest.metadata as any)?.adapter_type || "mysql";

            // We need to analyze all nodes to build the full field lineage
            // Alternatively, we could do it lazily, but for now, let's do all
            if (manifest.nodes) {
              for (const [uniqueId, node] of Object.entries(manifest.nodes)) {
                const compiledCode = (node as any).compiled_code;
                if (compiledCode) {
                  const fieldDeps = analyzer.analyze(compiledCode, adapterType);
                  graph.addFieldEdges(uniqueId, fieldDeps);
                }
              }
            }
            targetId = `${resourceId}#${options.field}`;
          } else {
            console.warn(
              "Warning: --field requires catalog.json, but it was not found. Falling back to resource-level lineage.",
            );
          }
        }

        // Get dependencies
        const result = DependencyService.getDependencies(
          graph,
          targetId,
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
