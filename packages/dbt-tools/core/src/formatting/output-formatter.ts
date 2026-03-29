type DepNode = {
  unique_id: string;
  resource_type: string;
  name: string;
  depth?: number;
  dependencies?: unknown[];
};

function formatDepsTreeNode(
  node: DepNode,
  prefix: string,
  isLast: boolean,
  lines: string[],
): void {
  const depthStr =
    typeof node.depth === "number" ? ` [depth ${node.depth}]` : "";
  const connector = isLast ? "└── " : "├── ";
  lines.push(
    `${prefix}${connector}${node.unique_id} (${node.resource_type}) - ${node.name}${depthStr}`,
  );

  const children = (node.dependencies ?? []) as DepNode[];
  const childPrefix = prefix + (isLast ? "    " : "│   ");
  for (let i = 0; i < children.length; i++) {
    formatDepsTreeNode(
      children[i],
      childPrefix,
      i === children.length - 1,
      lines,
    );
  }
}

function formatDepsTree(result: {
  resource_id: string;
  direction: "upstream" | "downstream";
  dependencies: Array<DepNode & { [key: string]: unknown }>;
  count: number;
}): string {
  const rootName = result.resource_id.split(".").pop() ?? result.resource_id;
  const lines: string[] = [];
  lines.push(`${rootName} (${result.direction})`);
  lines.push(`Count: ${result.count}`);
  lines.push("");

  for (let i = 0; i < result.dependencies.length; i++) {
    formatDepsTreeNode(
      result.dependencies[i],
      "",
      i === result.dependencies.length - 1,
      lines,
    );
  }

  return lines.join("\n");
}

/**
 * Check if stdout is a TTY
 */
export function isTTY(): boolean {
  return process.stdout.isTTY === true;
}

/**
 * Determine if output should be JSON
 */
export function shouldOutputJSON(
  forceJson?: boolean,
  forceNoJson?: boolean,
): boolean {
  if (forceNoJson === true) {
    return false;
  }
  if (forceJson === true) {
    return true;
  }
  return !isTTY();
}

/**
 * Format output as JSON or human-readable based on context
 */
export function formatOutput(
  data: unknown,
  forceJson?: boolean,
  forceNoJson?: boolean,
): string {
  const useJson = shouldOutputJSON(forceJson, forceNoJson);

  if (useJson) {
    return JSON.stringify(data, null, 2);
  }

  return String(data);
}

/**
 * Format summary command output
 */
export function formatSummary(summary: {
  total_nodes: number;
  total_edges: number;
  has_cycles: boolean;
  nodes_by_type: Record<string, number>;
}): string {
  const lines: string[] = [];
  lines.push("dbt Project Summary");
  lines.push("===================");
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
export function formatDeps(
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
    return formatDepsTree(result);
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
 * Bottleneck node for formatting
 */
export interface BottleneckNodeForFormat {
  unique_id: string;
  name?: string;
  execution_time: number;
  rank: number;
  pct_of_total: number;
  status: string;
}

/**
 * Format bottleneck section for human-readable output
 */
export function formatBottlenecks(
  bottlenecks: {
    nodes: BottleneckNodeForFormat[];
    total_execution_time: number;
    criteria_used: "top_n" | "threshold";
  },
  topLabel?: string,
): string {
  if (bottlenecks.nodes.length === 0) {
    return "\nBottlenecks: (none)\n";
  }

  const criteriaLabel =
    topLabel ?? (bottlenecks.criteria_used === "top_n" ? "top N" : "threshold");
  const lines: string[] = [];
  lines.push(`\nBottlenecks (${criteriaLabel} by execution time):`);
  lines.push("  Rank  Node                              Time (s)  % of Total");

  const maxIdLen = 34;
  for (const node of bottlenecks.nodes) {
    const label = node.name ?? node.unique_id;
    const idDisplay =
      label.length > maxIdLen ? label.slice(0, maxIdLen - 3) + "..." : label;
    const padded = idDisplay.padEnd(maxIdLen);
    const timeStr = node.execution_time.toFixed(2).padStart(8);
    lines.push(
      `  ${String(node.rank).padStart(2)}     ${padded}  ${timeStr}    ${node.pct_of_total.toFixed(1)}%`,
    );
  }

  return lines.join("\n") + "\n";
}

/**
 * Format run-report command output
 */
export function formatRunReport(
  summary: {
    total_execution_time: number;
    total_nodes: number;
    nodes_by_status: Record<string, number>;
    critical_path?: {
      path: string[];
      total_time: number;
    };
  },
  bottlenecks?: {
    nodes: BottleneckNodeForFormat[];
    total_execution_time: number;
    criteria_used: "top_n" | "threshold";
  },
  bottlenecksTopLabel?: string,
): string {
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
    lines.push(`  Total Time: ${summary.critical_path.total_time.toFixed(2)}s`);
  }

  if (bottlenecks) {
    lines.push(formatBottlenecks(bottlenecks, bottlenecksTopLabel));
  }

  return lines.join("\n");
}

/**
 * Format enriched bottleneck analysis for human-readable output
 */
export function formatBottleneckAnalysis(result: {
  top_bottlenecks: Array<{
    rank: number;
    unique_id: string;
    name?: string;
    execution_time: number;
    pct_of_total: number;
    downstream_count: number;
    structural_impact_score: number;
    is_on_critical_path: boolean;
    status: string;
  }>;
  total_execution_time: number;
  criteria_used: string;
  adapter_type: string | null;
  total_nodes_analyzed: number;
}): string {
  const lines: string[] = [];
  lines.push("dbt Bottleneck Analysis");
  lines.push("=======================");
  lines.push(`Total Nodes Analyzed: ${result.total_nodes_analyzed}`);
  lines.push(
    `Total Execution Time: ${result.total_execution_time.toFixed(2)}s`,
  );
  if (result.adapter_type) {
    lines.push(`Adapter: ${result.adapter_type}`);
  }
  lines.push(`Criteria: ${result.criteria_used}`);

  if (result.top_bottlenecks.length === 0) {
    lines.push("\nNo bottlenecks found.");
    return lines.join("\n");
  }

  lines.push(
    "\n  Rank  Node                              Impact Score  Time (s)  Downstream  On CP?",
  );

  const maxLabelLen = 34;
  for (const node of result.top_bottlenecks) {
    const label = node.name ?? node.unique_id;
    const labelDisplay =
      label.length > maxLabelLen
        ? label.slice(0, maxLabelLen - 3) + "..."
        : label;
    const padded = labelDisplay.padEnd(maxLabelLen);
    const impactStr = node.structural_impact_score.toFixed(1).padStart(12);
    const timeStr = node.execution_time.toFixed(2).padStart(8);
    const downstreamStr = String(node.downstream_count).padStart(10);
    const cpStr = (node.is_on_critical_path ? "yes" : "no").padStart(6);
    lines.push(
      `  ${String(node.rank).padStart(2)}     ${padded}  ${impactStr}  ${timeStr}  ${downstreamStr}  ${cpStr}`,
    );
  }

  lines.push(
    "\nImpact Score = execution_time × (1 + downstream_node_count). Higher = fix first.",
  );
  return lines.join("\n");
}

/**
 * Format critical path analysis for human-readable output
 */
export function formatCriticalPathAnalysis(result: {
  path: Array<{
    unique_id: string;
    name: string;
    resource_type: string;
    execution_time: number;
    cumulative_time: number;
    concurrent_nodes: number;
  }>;
  total_time: number;
  total_nodes: number;
  adapter_type: string | null;
}): string {
  const lines: string[] = [];
  lines.push("dbt Critical Path Analysis");
  lines.push("==========================");
  lines.push(`Total Nodes: ${result.total_nodes}`);
  lines.push(`Critical Path Total Time: ${result.total_time.toFixed(2)}s`);
  lines.push(`Critical Path Length: ${result.path.length} nodes`);
  if (result.adapter_type) {
    lines.push(`Adapter: ${result.adapter_type}`);
  }

  if (result.path.length === 0) {
    lines.push("\nNo critical path found.");
    return lines.join("\n");
  }

  lines.push(
    "\n  Step  Node                              Type        Time (s)  Cumulative  Concurrent",
  );

  const maxLabelLen = 34;
  for (let i = 0; i < result.path.length; i++) {
    const node = result.path[i];
    const labelDisplay =
      node.name.length > maxLabelLen
        ? node.name.slice(0, maxLabelLen - 3) + "..."
        : node.name;
    const padded = labelDisplay.padEnd(maxLabelLen);
    const typeStr = String(node.resource_type).padEnd(10).slice(0, 10);
    const timeStr = node.execution_time.toFixed(2).padStart(8);
    const cumStr = node.cumulative_time.toFixed(2).padStart(10);
    const concStr = String(node.concurrent_nodes).padStart(10);
    lines.push(
      `  ${String(i + 1).padStart(2)}    ${padded}  ${typeStr}  ${timeStr}  ${cumStr}  ${concStr}`,
    );
  }

  return lines.join("\n");
}

/**
 * Format parallelism analysis for human-readable output
 */
export function formatParallelismAnalysis(result: {
  waves: Array<{
    wave_number: number;
    node_ids: string[];
    width: number;
    estimated_time_s?: number;
  }>;
  total_waves: number;
  max_parallelism: number;
  avg_wave_width: number;
  serialization_bottlenecks: Array<{
    wave_number: number;
    node_id: string;
    description: string;
  }>;
  recommended_threads: number;
  has_cycles: boolean;
}): string {
  const lines: string[] = [];
  lines.push("dbt Parallelism Analysis");
  lines.push("========================");

  if (result.has_cycles) {
    lines.push("Warning: Graph contains cycles. Parallelism analysis skipped.");
    return lines.join("\n");
  }

  lines.push(`Total Waves: ${result.total_waves}`);
  lines.push(`Max Parallelism: ${result.max_parallelism} nodes`);
  lines.push(`Avg Wave Width: ${result.avg_wave_width}`);
  lines.push(`Recommended Threads: ${result.recommended_threads}`);

  if (result.waves.length > 0) {
    lines.push("\n  Wave  Width  Est. Time (s)  Nodes (first 5)");
    for (const wave of result.waves) {
      const preview = wave.node_ids
        .slice(0, 5)
        .map((id) => id.split(".").pop() ?? id)
        .join(", ");
      const ellipsis = wave.node_ids.length > 5 ? ", …" : "";
      const timeStr =
        wave.estimated_time_s !== undefined
          ? wave.estimated_time_s.toFixed(2).padStart(13)
          : "           n/a";
      lines.push(
        `  ${String(wave.wave_number).padStart(2)}    ${String(wave.width).padStart(3)}  ${timeStr}  ${preview}${ellipsis}`,
      );
    }
  }

  if (result.serialization_bottlenecks.length > 0) {
    lines.push("\nSerialization Bottlenecks:");
    for (const b of result.serialization_bottlenecks) {
      lines.push(`  Wave ${b.wave_number}: ${b.description}`);
    }
  } else {
    lines.push("\nNo serialization bottlenecks detected.");
  }

  return lines.join("\n");
}

/**
 * Format human-readable output for a specific command type
 */
export function formatHumanReadable(
  data: unknown,
  format: "summary" | "deps" | "run-report",
): string {
  switch (format) {
    case "summary":
      return formatSummary(data as Parameters<typeof formatSummary>[0]);
    case "deps":
      return formatDeps(data as Parameters<typeof formatDeps>[0]);
    case "run-report":
      return formatRunReport(data as Parameters<typeof formatRunReport>[0]);
    default:
      return String(data);
  }
}
