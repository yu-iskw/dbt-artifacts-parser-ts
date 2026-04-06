/**
 * Timeline CLI action handler – per-node execution records from run_results.json.
 * Distinct from run-report: this command exposes row-level timeline entries,
 * not aggregated stats.
 */
import {
  ManifestGraph,
  resolveArtifactPaths,
  loadManifest,
  loadRunResults,
  validateSafePath,
  buildNodeExecutionsFromRunResults,
  searchRunResults,
  formatOutput,
  shouldOutputJSON,
  type NodeExecution,
} from "@dbt-tools/core";

export type TimelineOptions = {
  sort?: string;
  top?: number;
  failedOnly?: boolean;
  status?: string;
  format?: string;
  targetDir?: string;
  json?: boolean;
  noJson?: boolean;
};

export type TimelineEntry = {
  unique_id: string;
  name?: string;
  resource_type?: string;
  status: string;
  execution_time: number;
  started_at?: string;
  completed_at?: string;
  thread_id?: string;
  message?: string;
};

export type TimelineResult = {
  total: number;
  entries: TimelineEntry[];
};

/** Build a name/type lookup map from a ManifestGraph */
function buildNodeLookup(
  graph: ManifestGraph,
): Map<string, { name: string; resource_type: string }> {
  const map = new Map<string, { name: string; resource_type: string }>();
  const g = graph.getGraph();
  g.forEachNode((_id, attrs) => {
    map.set(attrs.unique_id, {
      name: attrs.name,
      resource_type: attrs.resource_type,
    });
  });
  return map;
}

/** Map NodeExecution to TimelineEntry, enriching with manifest data when available */
function toTimelineEntry(
  exec: NodeExecution,
  lookup: Map<string, { name: string; resource_type: string }> | undefined,
): TimelineEntry {
  const meta = lookup?.get(exec.unique_id);
  return {
    unique_id: exec.unique_id,
    name: meta?.name,
    resource_type: meta?.resource_type,
    status: exec.status,
    execution_time: exec.execution_time,
    started_at: exec.started_at,
    completed_at: exec.completed_at,
    thread_id: exec.thread_id,
    message: exec.message,
  };
}

/**
 * Format timeline as a human-readable table.
 */
export function formatTimeline(result: TimelineResult): string {
  const lines: string[] = [];
  lines.push("dbt Execution Timeline");
  lines.push("======================");
  lines.push(`Total entries: ${result.total}`);

  if (result.entries.length === 0) {
    lines.push("(no matching executions)");
    return lines.join("\n");
  }

  lines.push("");
  lines.push(
    "  #     Status     Time (s)  Type              Name / unique_id",
  );
  lines.push(
    "  ----  ---------  --------  ----------------  ----------------------------------------",
  );

  for (let i = 0; i < result.entries.length; i++) {
    const e = result.entries[i];
    const rank = String(i + 1).padStart(4);
    const status = (e.status || "unknown").padEnd(9).slice(0, 9);
    const time = e.execution_time.toFixed(2).padStart(8);
    const rt = (e.resource_type || "").padEnd(16).slice(0, 16);
    const label = e.name ?? e.unique_id;
    lines.push(`  ${rank}  ${status}  ${time}  ${rt}  ${label}`);
  }

  return lines.join("\n");
}

/** Format timeline as CSV */
export function formatTimelineCsv(entries: TimelineEntry[]): string {
  const header =
    "unique_id,name,resource_type,status,execution_time,started_at,completed_at,thread_id,message";
  const escape = (v: string | undefined): string => {
    const s = v ?? "";
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const rows = entries.map((e) =>
    [
      escape(e.unique_id),
      escape(e.name),
      escape(e.resource_type),
      escape(e.status),
      String(e.execution_time),
      escape(e.started_at),
      escape(e.completed_at),
      escape(e.thread_id),
      escape(e.message),
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

const ALLOWED_SORTS = new Set(["duration", "start"]);

/**
 * Timeline action handler
 */
export function timelineAction(
  runResultsPath: string | undefined,
  manifestPath: string | undefined,
  options: TimelineOptions,
  handleError: (error: unknown, isTTY: boolean) => void,
  isTTY: () => boolean,
): void {
  try {
    const sortKey = (options.sort ?? "duration").toLowerCase();
    if (!ALLOWED_SORTS.has(sortKey)) {
      throw new Error(
        `--sort must be one of: ${[...ALLOWED_SORTS].join(", ")}`,
      );
    }

    const paths = resolveArtifactPaths(
      manifestPath,
      runResultsPath,
      options.targetDir,
    );
    validateSafePath(paths.runResults);

    const runResults = loadRunResults(paths.runResults);
    let executions: NodeExecution[] = buildNodeExecutionsFromRunResults(
      runResults,
    );

    // Optionally enrich with manifest metadata
    let lookup: Map<string, { name: string; resource_type: string }> | undefined;
    if (manifestPath) {
      validateSafePath(paths.manifest);
      try {
        const manifest = loadManifest(paths.manifest);
        const graph = new ManifestGraph(manifest);
        lookup = buildNodeLookup(graph);
      } catch {
        // manifest loading is best-effort for enrichment
      }
    }

    // Apply status filters
    if (options.failedOnly) {
      executions = executions.filter(
        (e) => e.status !== "success" && e.status !== "pass",
      );
    } else if (options.status) {
      const statuses = options.status
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      executions = searchRunResults(executions, { status: statuses });
    }

    // Sort
    if (sortKey === "duration") {
      executions = searchRunResults(executions, {
        sort: "execution_time_desc",
      });
    } else if (sortKey === "start") {
      executions = [...executions].sort((a, b) => {
        const aTs = a.started_at ?? "";
        const bTs = b.started_at ?? "";
        return aTs.localeCompare(bTs);
      });
    }

    // Top N
    if (options.top !== undefined && options.top > 0) {
      executions = executions.slice(0, options.top);
    }

    const entries = executions.map((e) => toTimelineEntry(e, lookup));
    const result: TimelineResult = { total: entries.length, entries };

    const outputFormat = (options.format ?? "").toLowerCase();
    const useJson = shouldOutputJSON(options.json, options.noJson);

    if (outputFormat === "csv") {
      console.log(formatTimelineCsv(entries));
    } else if (outputFormat === "table" || (!useJson && outputFormat !== "json")) {
      console.log(formatTimeline(result));
    } else {
      console.log(formatOutput(result, true));
    }
  } catch (error) {
    handleError(error, isTTY());
  }
}
