#!/usr/bin/env node

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseManifest } from "dbt-artifacts-parser/manifest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseRunResults } from "dbt-artifacts-parser/run_results";
import { ManifestGraph } from "@dbt-tools/core";
import { ExecutionAnalyzer } from "@dbt-tools/core";

const program = new Command();

program
  .name("dbt-tools")
  .description("Command-line interface for dbt artifact analysis")
  .version("0.1.0");

/**
 * Load and parse a JSON file
 */
function loadJsonFile<T>(filePath: string): T {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${fullPath}: ${error}`);
  }
}

/**
 * Analyze command: Basic summary of project structure
 */
program
  .command("analyze")
  .description("Analyze dbt manifest and provide summary statistics")
  .argument("<manifest-path>", "Path to manifest.json file")
  .option("--json", "Output results as JSON")
  .action((manifestPath: string, options: { json?: boolean }) => {
    try {
      const manifestJson = loadJsonFile<Record<string, unknown>>(manifestPath);
      const manifest = parseManifest(manifestJson);
      const graph = new ManifestGraph(manifest);
      const summary = graph.getSummary();

      if (options.json) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        console.log("dbt Project Analysis");
        console.log("====================");
        console.log(`Total Nodes: ${summary.total_nodes}`);
        console.log(`Total Edges: ${summary.total_edges}`);
        console.log(`Has Cycles: ${summary.has_cycles ? "Yes" : "No"}`);
        console.log("\nNodes by Type:");
        for (const [type, count] of Object.entries(summary.nodes_by_type)) {
          console.log(`  ${type}: ${count}`);
        }
      }
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

/**
 * Graph export command: Export graph in various formats
 */
program
  .command("graph")
  .description("Export dependency graph")
  .argument("<manifest-path>", "Path to manifest.json file")
  .option("--format <format>", "Export format: json, dot, gexf", "json")
  .option("--output <path>", "Output file path (default: stdout)")
  .action(
    (manifestPath: string, options: { format?: string; output?: string }) => {
      try {
        const manifestJson =
          loadJsonFile<Record<string, unknown>>(manifestPath);
        const manifest = parseManifest(manifestJson);
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
        console.error(
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        );
        process.exit(1);
      }
    },
  );

/**
 * Run report command: Execution summary from run_results.json
 */
program
  .command("run-report")
  .description("Generate execution report from run_results.json")
  .argument("<run-results-path>", "Path to run_results.json file")
  .argument(
    "[manifest-path]",
    "Path to manifest.json file (optional, for critical path)",
  )
  .option("--json", "Output results as JSON")
  .action(
    (
      runResultsPath: string,
      manifestPath: string | undefined,
      options: { json?: boolean },
    ) => {
      try {
        const runResultsJson =
          loadJsonFile<Record<string, unknown>>(runResultsPath);
        const runResults = parseRunResults(runResultsJson);

        let analyzer: ExecutionAnalyzer | undefined;
        if (manifestPath) {
          const manifestJson =
            loadJsonFile<Record<string, unknown>>(manifestPath);
          const manifest = parseManifest(manifestJson);
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

        if (options.json) {
          console.log(JSON.stringify(summary, null, 2));
        } else {
          console.log("dbt Execution Report");
          console.log("===================");
          console.log(
            `Total Execution Time: ${summary.total_execution_time.toFixed(2)}s`,
          );
          console.log(`Total Nodes: ${summary.total_nodes}`);
          console.log("\nNodes by Status:");
          for (const [status, count] of Object.entries(
            summary.nodes_by_status,
          )) {
            console.log(`  ${status}: ${count}`);
          }

          if (analyzer && "critical_path" in summary && summary.critical_path) {
            console.log("\nCritical Path:");
            console.log(`  Path: ${summary.critical_path.path.join(" -> ")}`);
            console.log(
              `  Total Time: ${summary.critical_path.total_time.toFixed(2)}s`,
            );
          }
        }
      } catch (error) {
        console.error(
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        );
        process.exit(1);
      }
    },
  );

// Parse command line arguments
program.parse();
