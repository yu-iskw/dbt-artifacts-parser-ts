/**
 * OutputFormatter handles formatting output for CLI commands.
 * JSON-by-default when stdout is not a TTY (for agent consumption).
 */
export class OutputFormatter {
  /**
   * Check if stdout is a TTY
   */
  static isTTY(): boolean {
    return process.stdout.isTTY === true;
  }

  /**
   * Determine if output should be JSON
   */
  static shouldOutputJSON(forceJson?: boolean, forceNoJson?: boolean): boolean {
    // Explicit flags take precedence
    if (forceNoJson === true) {
      return false;
    }
    if (forceJson === true) {
      return true;
    }

    // Default: JSON when not TTY (for agents), human-readable when TTY
    return !this.isTTY();
  }

  /**
   * Format output as JSON or human-readable based on context
   */
  static formatOutput(
    data: unknown,
    forceJson?: boolean,
    forceNoJson?: boolean,
  ): string {
    const useJson = this.shouldOutputJSON(forceJson, forceNoJson);

    if (useJson) {
      return JSON.stringify(data, null, 2);
    }

    // Human-readable formatting is handled per-command
    // This is a fallback that just stringifies
    return String(data);
  }

  /**
   * Format analyze command output
   */
  static formatAnalyze(summary: {
    total_nodes: number;
    total_edges: number;
    has_cycles: boolean;
    nodes_by_type: Record<string, number>;
  }): string {
    const lines: string[] = [];
    lines.push("dbt Project Analysis");
    lines.push("====================");
    lines.push(`Total Nodes: ${summary.total_nodes}`);
    lines.push(`Total Edges: ${summary.total_edges}`);
    lines.push(`Has Cycles: ${summary.has_cycles ? "Yes" : "No"}`);
    lines.push("\nNodes by Type:");
    for (const [type, count] of Object.entries(summary.nodes_by_type)) {
      lines.push(`  ${type}: ${count}`);
    }
    return lines.join("\n");
  }

  /**
   * Format deps command output (flat or tree)
   */
  static formatDeps(
    result: {
      resource_id: string;
      direction: "upstream" | "downstream";
      dependencies: Array<{
        unique_id: string;
        resource_type: string;
        name: string;
        package_name: string;
        depth?: number;
        dependencies?: unknown[];
        [key: string]: unknown;
      }>;
      count: number;
    },
    format?: "flat" | "tree",
  ): string {
    if (format === "tree") {
      return this.formatDepsTree(result);
    }

    const lines: string[] = [];
    lines.push(`Dependencies for ${result.resource_id}`);
    lines.push(`Direction: ${result.direction}`);
    lines.push(`Count: ${result.count}`);
    lines.push("\nDependencies:");

    if (result.dependencies.length === 0) {
      lines.push("  (none)");
    } else {
      for (const dep of result.dependencies) {
        const depthStr =
          typeof dep.depth === "number" ? ` [depth ${dep.depth}]` : "";
        lines.push(
          `  - ${dep.unique_id} (${dep.resource_type}) - ${dep.name}${depthStr}`,
        );
      }
    }

    return lines.join("\n");
  }

  /**
   * Format deps command output as an indented tree
   */
  private static formatDepsTree(result: {
    resource_id: string;
    direction: "upstream" | "downstream";
    dependencies: Array<{
      unique_id: string;
      resource_type: string;
      name: string;
      depth?: number;
      dependencies?: unknown[];
      [key: string]: unknown;
    }>;
    count: number;
  }): string {
    const rootName = result.resource_id.split(".").pop() ?? result.resource_id;
    const lines: string[] = [];
    lines.push(`${rootName} (${result.direction})`);
    lines.push(`Count: ${result.count}`);
    lines.push("");

    const formatNode = (
      node: {
        unique_id: string;
        resource_type: string;
        name: string;
        depth?: number;
        dependencies?: unknown[];
      },
      prefix: string,
      isLast: boolean,
    ): void => {
      const depthStr =
        typeof node.depth === "number" ? ` [depth ${node.depth}]` : "";
      const connector = isLast ? "└── " : "├── ";
      lines.push(
        `${prefix}${connector}${node.unique_id} (${node.resource_type}) - ${node.name}${depthStr}`,
      );

      const children = (node.dependencies ?? []) as Array<{
        unique_id: string;
        resource_type: string;
        name: string;
        depth?: number;
        dependencies?: unknown[];
      }>;
      const childPrefix = prefix + (isLast ? "    " : "│   ");
      for (let i = 0; i < children.length; i++) {
        formatNode(children[i], childPrefix, i === children.length - 1);
      }
    };

    for (let i = 0; i < result.dependencies.length; i++) {
      formatNode(
        result.dependencies[i],
        "",
        i === result.dependencies.length - 1,
      );
    }

    return lines.join("\n");
  }

  /**
   * Format run-report command output
   */
  static formatRunReport(summary: {
    total_execution_time: number;
    total_nodes: number;
    nodes_by_status: Record<string, number>;
    critical_path?: {
      path: string[];
      total_time: number;
    };
  }): string {
    const lines: string[] = [];
    lines.push("dbt Execution Report");
    lines.push("===================");
    lines.push(
      `Total Execution Time: ${summary.total_execution_time.toFixed(2)}s`,
    );
    lines.push(`Total Nodes: ${summary.total_nodes}`);
    lines.push("\nNodes by Status:");
    for (const [status, count] of Object.entries(summary.nodes_by_status)) {
      lines.push(`  ${status}: ${count}`);
    }

    if (summary.critical_path) {
      lines.push("\nCritical Path:");
      lines.push(`  Path: ${summary.critical_path.path.join(" -> ")}`);
      lines.push(
        `  Total Time: ${summary.critical_path.total_time.toFixed(2)}s`,
      );
    }

    return lines.join("\n");
  }

  /**
   * Format human-readable output for a specific command type
   */
  static formatHumanReadable(
    data: unknown,
    format: "analyze" | "deps" | "run-report",
  ): string {
    switch (format) {
      case "analyze":
        return this.formatAnalyze(
          data as Parameters<typeof this.formatAnalyze>[0],
        );
      case "deps":
        return this.formatDeps(data as Parameters<typeof this.formatDeps>[0]);
      case "run-report":
        return this.formatRunReport(
          data as Parameters<typeof this.formatRunReport>[0],
        );
      default:
        return String(data);
    }
  }
}
