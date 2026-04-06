import * as fs from "fs";
import * as path from "path";
import {
  ManifestGraph,
  createFocusedGraph,
  resolveArtifactPaths,
  loadManifest,
  loadRunResults,
  loadCatalog,
  validateSafePath,
  validateDepth,
  validateString,
  buildNodeExecutionsFromRunResults,
  formatOutput,
  shouldOutputJSON,
  exportGraphToFormat,
  writeGraphOutput,
  SQLAnalyzer,
  sqlDialectFromDbtAdapterType,
} from "@dbt-tools/core";
import type { ParsedManifest } from "dbt-artifacts-parser/manifest";

type CliEnv = {
  handleError: (error: unknown, isTTY: boolean) => void;
  isTTY: () => boolean;
};

type InventoryRow = {
  unique_id: string;
  resource_type: string;
  name: string;
  package_name: string;
  path?: string;
  tags?: string[];
  group?: string;
  owner?: string;
  status?: string;
};

type InventoryOptions = {
  manifestPath?: string;
  runResultsPath?: string;
  targetDir?: string;
  type?: string;
  package?: string;
  tag?: string;
  path?: string;
  owner?: string;
  group?: string;
  status?: string;
  fields?: string;
  format?: "json" | "table";
  json?: boolean;
  noJson?: boolean;
};

type TimelineOptions = {
  manifestPath?: string;
  runResultsPath?: string;
  targetDir?: string;
  sort?: "duration" | "start";
  top?: number;
  failedOnly?: boolean;
  status?: string;
  format?: "json" | "table" | "csv";
  json?: boolean;
  noJson?: boolean;
};

type SearchOptions = {
  manifestPath?: string;
  targetDir?: string;
  type?: string;
  package?: string;
  tag?: string;
  path?: string;
  format?: "json" | "table";
  top?: number;
  json?: boolean;
  noJson?: boolean;
};

type StatusOptions = {
  targetDir?: string;
  manifestPath?: string;
  runResultsPath?: string;
  json?: boolean;
  noJson?: boolean;
};

type GraphFocusOptions = {
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
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value != null
    ? (value as Record<string, unknown>)
    : {};
}

function splitCsv(input?: string): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function deriveOwner(node: Record<string, unknown>): string | undefined {
  const owner = node.owner;
  if (typeof owner === "string" && owner.trim() !== "") return owner;

  const config = asRecord(node.config);
  const configOwner = config.owner;
  if (typeof configOwner === "string" && configOwner.trim() !== "") {
    return configOwner;
  }

  const meta = asRecord(node.meta);
  const metaOwner = meta.owner;
  if (typeof metaOwner === "string" && metaOwner.trim() !== "") {
    return metaOwner;
  }

  return undefined;
}

function collectInventoryRows(manifest: ParsedManifest): InventoryRow[] {
  const rows: InventoryRow[] = [];

  const addEntries = (
    entries: Record<string, unknown> | undefined,
    fallbackType?: string,
  ): void => {
    if (!entries) return;
    for (const [uniqueId, rawNode] of Object.entries(entries)) {
      const node = asRecord(rawNode);
      const tags = Array.isArray(node.tags)
        ? node.tags.filter((entry): entry is string => typeof entry === "string")
        : undefined;
      rows.push({
        unique_id: uniqueId,
        resource_type:
          (typeof node.resource_type === "string"
            ? node.resource_type
            : fallbackType) ?? "unknown",
        name:
          typeof node.name === "string" && node.name !== ""
            ? node.name
            : uniqueId,
        package_name:
          typeof node.package_name === "string" ? node.package_name : "",
        path:
          (typeof node.path === "string" && node.path) ||
          (typeof node.original_file_path === "string" &&
          node.original_file_path
            ? node.original_file_path
            : undefined),
        tags,
        group:
          (typeof node.group === "string" && node.group) ||
          (typeof asRecord(node.config).group === "string" &&
          (asRecord(node.config).group as string)
            ? (asRecord(node.config).group as string)
            : undefined),
        owner: deriveOwner(node),
      });
    }
  };

  addEntries(manifest.nodes as Record<string, unknown> | undefined);
  addEntries(manifest.sources as Record<string, unknown> | undefined, "source");
  addEntries(manifest.macros as Record<string, unknown> | undefined, "macro");
  addEntries(
    manifest.exposures as Record<string, unknown> | undefined,
    "exposure",
  );

  const optionalManifest = manifest as ParsedManifest & {
    metrics?: Record<string, unknown>;
  };
  addEntries(optionalManifest.metrics, "metric");

  return rows;
}

function applyInventoryFilters(
  rows: InventoryRow[],
  options: Pick<
    InventoryOptions,
    "type" | "package" | "tag" | "path" | "owner" | "group" | "status"
  >,
): InventoryRow[] {
  const normalizedType = options.type?.toLowerCase();
  const normalizedPackage = options.package?.toLowerCase();
  const normalizedTag = options.tag?.toLowerCase();
  const normalizedPath = options.path?.toLowerCase();
  const normalizedOwner = options.owner?.toLowerCase();
  const normalizedGroup = options.group?.toLowerCase();
  const normalizedStatus = options.status?.toLowerCase();

  return rows.filter((row) => {
    if (normalizedType && row.resource_type.toLowerCase() !== normalizedType) {
      return false;
    }
    if (
      normalizedPackage &&
      row.package_name.toLowerCase() !== normalizedPackage
    ) {
      return false;
    }
    if (
      normalizedTag &&
      !(row.tags ?? []).some((tag) => tag.toLowerCase() === normalizedTag)
    ) {
      return false;
    }
    if (
      normalizedPath &&
      !((row.path ?? "").toLowerCase().includes(normalizedPath))
    ) {
      return false;
    }
    if (
      normalizedOwner &&
      !((row.owner ?? "").toLowerCase().includes(normalizedOwner))
    ) {
      return false;
    }
    if (
      normalizedGroup &&
      !((row.group ?? "").toLowerCase().includes(normalizedGroup))
    ) {
      return false;
    }
    if (normalizedStatus && (row.status ?? "unknown").toLowerCase() !== normalizedStatus) {
      return false;
    }
    return true;
  });
}

function formatTable(rows: Array<Record<string, unknown>>, columns: string[]): string {
  if (rows.length === 0) {
    return "(no rows)";
  }
  const widths = new Map<string, number>();
  for (const column of columns) {
    const maxRow = Math.max(
      column.length,
      ...rows.map((row) => String(row[column] ?? "").length),
    );
    widths.set(column, Math.min(Math.max(maxRow, 6), 70));
  }

  const trimCell = (value: string, width: number): string =>
    value.length > width ? `${value.slice(0, width - 3)}...` : value;

  const renderRow = (row: Record<string, unknown>): string =>
    columns
      .map((column) => {
        const width = widths.get(column) ?? column.length;
        return trimCell(String(row[column] ?? ""), width).padEnd(width);
      })
      .join("  ");

  const header = renderRow(
    Object.fromEntries(columns.map((column) => [column, column])) as Record<
      string,
      unknown
    >,
  );
  const divider = columns
    .map((column) => "-".repeat(widths.get(column) ?? column.length))
    .join("  ");
  return [header, divider, ...rows.map(renderRow)].join("\n");
}

export function inventoryAction(options: InventoryOptions, env: CliEnv): void {
  try {
    const paths = resolveArtifactPaths(
      options.manifestPath,
      options.runResultsPath,
      options.targetDir,
    );
    validateSafePath(paths.manifest);
    const manifest = loadManifest(paths.manifest);

    const statuses = new Map<string, string>();
    try {
      validateSafePath(paths.runResults);
      const runResults = loadRunResults(paths.runResults);
      for (const result of runResults.results ?? []) {
        if (result.unique_id) {
          statuses.set(result.unique_id, result.status ?? "unknown");
        }
      }
    } catch {
      // run_results is optional for inventory; ignore when unavailable.
    }

    const rows = collectInventoryRows(manifest).map((row) => ({
      ...row,
      status: statuses.get(row.unique_id),
    }));

    const filtered = applyInventoryFilters(rows, options);
    const fields = splitCsv(options.fields);
    const selectedColumns =
      fields.length > 0
        ? fields
        : [
            "unique_id",
            "resource_type",
            "name",
            "package_name",
            "status",
            "path",
          ];
    const projected = filtered.map((row) => {
      const out: Record<string, unknown> = {};
      for (const column of selectedColumns) {
        out[column] = row[column as keyof InventoryRow] ?? "";
      }
      return out;
    });

    const useJson = shouldOutputJSON(options.json, options.noJson);
    if (useJson || options.format === "json") {
      console.log(
        formatOutput(
          {
            count: projected.length,
            total_resources: rows.length,
            filters: {
              type: options.type,
              package: options.package,
              tag: options.tag,
              path: options.path,
              owner: options.owner,
              group: options.group,
              status: options.status,
            },
            resources: projected,
          },
          true,
        ),
      );
      return;
    }

    console.log(
      [
        `Inventory results: ${projected.length} / ${rows.length}`,
        formatTable(projected, selectedColumns),
      ].join("\n\n"),
    );
  } catch (error) {
    env.handleError(error, env.isTTY());
  }
}

type TimelineRow = {
  unique_id: string;
  name: string;
  resource_type: string;
  status: string;
  duration_seconds: number;
  started_at?: string;
  completed_at?: string;
};

function toCsv(rows: TimelineRow[]): string {
  const headers = [
    "unique_id",
    "name",
    "resource_type",
    "status",
    "duration_seconds",
    "started_at",
    "completed_at",
  ];
  const quote = (value: string): string => `"${value.replace(/\"/g, "\"\"")}"`;

  return [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.unique_id,
        row.name,
        row.resource_type,
        row.status,
        row.duration_seconds.toFixed(3),
        row.started_at ?? "",
        row.completed_at ?? "",
      ]
        .map((value) => quote(String(value)))
        .join(","),
    ),
  ].join("\n");
}

export function timelineAction(options: TimelineOptions, env: CliEnv): void {
  try {
    const paths = resolveArtifactPaths(
      options.manifestPath,
      options.runResultsPath,
      options.targetDir,
    );
    validateSafePath(paths.runResults);
    const runResults = loadRunResults(paths.runResults);

    const nameById = new Map<string, { name: string; resource_type: string }>();
    try {
      validateSafePath(paths.manifest);
      const manifest = loadManifest(paths.manifest);
      for (const row of collectInventoryRows(manifest)) {
        nameById.set(row.unique_id, {
          name: row.name,
          resource_type: row.resource_type,
        });
      }
    } catch {
      // Manifest is optional for timeline enrichment.
    }

    let rows: TimelineRow[] = buildNodeExecutionsFromRunResults(runResults).map(
      (entry) => {
        const node = nameById.get(entry.unique_id);
        return {
          unique_id: entry.unique_id,
          name: node?.name ?? entry.unique_id.split(".").pop() ?? entry.unique_id,
          resource_type: node?.resource_type ?? entry.unique_id.split(".")[0] ?? "unknown",
          status: entry.status,
          duration_seconds: entry.execution_time,
          started_at: entry.started_at,
          completed_at: entry.completed_at,
        };
      },
    );

    if (options.failedOnly) {
      rows = rows.filter((row) =>
        ["error", "fail", "runtime error", "warn"].includes(
          row.status.toLowerCase(),
        ),
      );
    }

    if (options.status) {
      const statuses = new Set(
        splitCsv(options.status).map((entry) => entry.toLowerCase()),
      );
      rows = rows.filter((row) => statuses.has(row.status.toLowerCase()));
    }

    const sortBy = options.sort ?? "duration";
    rows.sort((a, b) => {
      if (sortBy === "start") {
        return (b.started_at ?? "").localeCompare(a.started_at ?? "");
      }
      return b.duration_seconds - a.duration_seconds;
    });

    if (options.top !== undefined) {
      if (!Number.isInteger(options.top) || options.top < 1) {
        throw new Error("--top must be a positive integer");
      }
      rows = rows.slice(0, options.top);
    }

    const useJson = shouldOutputJSON(options.json, options.noJson);
    if (useJson || options.format === "json") {
      console.log(formatOutput({ count: rows.length, timeline: rows }, true));
      return;
    }
    if (options.format === "csv") {
      console.log(toCsv(rows));
      return;
    }

    console.log(
      [
        `Timeline rows: ${rows.length}`,
        formatTable(rows as unknown as Array<Record<string, unknown>>, [
          "unique_id",
          "resource_type",
          "status",
          "duration_seconds",
          "started_at",
        ]),
      ].join("\n\n"),
    );
  } catch (error) {
    env.handleError(error, env.isTTY());
  }
}

function scoreInventoryRow(row: InventoryRow, terms: string[]): number {
  if (terms.length === 0) return 1;
  let score = 0;
  const id = row.unique_id.toLowerCase();
  const name = row.name.toLowerCase();
  const pkg = row.package_name.toLowerCase();
  const p = (row.path ?? "").toLowerCase();
  const tags = new Set((row.tags ?? []).map((tag) => tag.toLowerCase()));

  for (const term of terms) {
    const t = term.toLowerCase();
    if (id === t || name === t) score += 100;
    else if (id.includes(t) || name.includes(t)) score += 30;
    if (pkg.includes(t)) score += 15;
    if (p.includes(t)) score += 10;
    if (tags.has(t)) score += 20;
  }

  return score;
}

function parseScopedTerms(terms: string[], options: SearchOptions): SearchOptions {
  const next = { ...options };
  for (const term of terms) {
    const idx = term.indexOf(":");
    if (idx < 1) continue;
    const key = term.slice(0, idx).toLowerCase();
    const value = term.slice(idx + 1);
    if (value === "") continue;
    if (key === "type") next.type = value;
    if (key === "package") next.package = value;
    if (key === "tag") next.tag = value;
    if (key === "path" || key === "source") next.path = value;
  }
  return next;
}

export function searchAction(
  terms: string[],
  options: SearchOptions,
  env: CliEnv,
): void {
  try {
    const scoped = parseScopedTerms(terms, options);
    const freeTextTerms = terms.filter((term) => !term.includes(":"));

    const paths = resolveArtifactPaths(scoped.manifestPath, undefined, scoped.targetDir);
    validateSafePath(paths.manifest);
    const manifest = loadManifest(paths.manifest);

    let rows = applyInventoryFilters(collectInventoryRows(manifest), {
      type: scoped.type,
      package: scoped.package,
      tag: scoped.tag,
      path: scoped.path,
      owner: undefined,
      group: undefined,
      status: undefined,
    });

    const scored = rows
      .map((row) => ({
        ...row,
        _score: scoreInventoryRow(row, freeTextTerms),
      }))
      .filter((row) => row._score > 0)
      .sort((a, b) => b._score - a._score || a.unique_id.localeCompare(b.unique_id));

    if (scoped.top !== undefined) {
      if (!Number.isInteger(scoped.top) || scoped.top < 1) {
        throw new Error("--top must be a positive integer");
      }
      rows = scored.slice(0, scoped.top);
    } else {
      rows = scored;
    }

    const outputRows = rows.map((row) => ({
      unique_id: row.unique_id,
      resource_type: row.resource_type,
      name: row.name,
      package_name: row.package_name,
      path: row.path ?? "",
      tags: (row.tags ?? []).join(","),
    }));

    const useJson = shouldOutputJSON(scoped.json, scoped.noJson);
    if (useJson || scoped.format === "json") {
      console.log(
        formatOutput(
          {
            count: outputRows.length,
            query: terms,
            filters: {
              type: scoped.type,
              package: scoped.package,
              tag: scoped.tag,
              path: scoped.path,
            },
            results: outputRows,
          },
          true,
        ),
      );
      return;
    }

    console.log(
      [
        `Search results: ${outputRows.length}`,
        formatTable(outputRows, [
          "unique_id",
          "resource_type",
          "name",
          "package_name",
          "path",
        ]),
      ].join("\n\n"),
    );
  } catch (error) {
    env.handleError(error, env.isTTY());
  }
}

type ArtifactFileStatus = {
  path: string;
  exists: boolean;
  modified_at?: string;
  age_seconds?: number;
};

function statArtifact(filePath: string): ArtifactFileStatus {
  validateSafePath(filePath);
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    return { path: resolvedPath, exists: false };
  }
  const stat = fs.statSync(resolvedPath);
  const modifiedAt = stat.mtime;
  return {
    path: resolvedPath,
    exists: true,
    modified_at: modifiedAt.toISOString(),
    age_seconds: Math.max(0, Math.floor((Date.now() - modifiedAt.getTime()) / 1000)),
  };
}

export function statusAction(options: StatusOptions, env: CliEnv): void {
  try {
    const paths = resolveArtifactPaths(
      options.manifestPath,
      options.runResultsPath,
      options.targetDir,
    );

    const manifest = statArtifact(paths.manifest);
    const runResults = statArtifact(paths.runResults);

    const readiness = {
      manifest_ready: manifest.exists,
      execution_ready: manifest.exists && runResults.exists,
      state:
        manifest.exists && runResults.exists
          ? "execution-ready"
          : manifest.exists
            ? "manifest-ready"
            : "not-ready",
    };

    const existing = [manifest, runResults].filter(
      (entry) => entry.exists && entry.modified_at,
    );
    const freshest = existing
      .slice()
      .sort((a, b) => (b.modified_at ?? "").localeCompare(a.modified_at ?? ""))[0];

    const payload = {
      target_dir: path.resolve(options.targetDir ?? "./target"),
      artifacts: {
        manifest,
        run_results: runResults,
      },
      readiness,
      freshness:
        freshest != null
          ? {
              latest_artifact:
                freshest.path === manifest.path ? "manifest" : "run_results",
              modified_at: freshest.modified_at,
              age_seconds: freshest.age_seconds,
            }
          : undefined,
    };

    const useJson = shouldOutputJSON(options.json, options.noJson);
    if (useJson) {
      console.log(formatOutput(payload, true));
      return;
    }

    const lines = [
      "dbt artifact status",
      "===================",
      `Target dir: ${payload.target_dir}`,
      `Manifest: ${manifest.exists ? "present" : "missing"} (${manifest.path})`,
      `Run results: ${runResults.exists ? "present" : "missing"} (${runResults.path})`,
      `Readiness: ${readiness.state}`,
    ];

    if (payload.freshness) {
      lines.push(
        `Freshness: latest=${payload.freshness.latest_artifact}, age=${payload.freshness.age_seconds}s`,
      );
    }

    console.log(lines.join("\n"));
  } catch (error) {
    env.handleError(error, env.isTTY());
  }
}

function resolveFocusNodes(
  graph: ManifestGraph,
  rows: InventoryRow[],
  focus: string,
): string[] {
  if (focus.includes(":")) {
    const [prefix, rawValue] = focus.split(":", 2);
    const value = rawValue?.toLowerCase() ?? "";
    if (prefix === "tag") {
      return rows
        .filter((row) => (row.tags ?? []).some((tag) => tag.toLowerCase() === value))
        .map((row) => row.unique_id);
    }
    if (prefix === "type") {
      return rows
        .filter((row) => row.resource_type.toLowerCase() === value)
        .map((row) => row.unique_id);
    }
    if (prefix === "package") {
      return rows
        .filter((row) => row.package_name.toLowerCase() === value)
        .map((row) => row.unique_id);
    }
    if (prefix === "path") {
      return rows
        .filter((row) => (row.path ?? "").toLowerCase().includes(value))
        .map((row) => row.unique_id);
    }
  }

  if (graph.getGraph().hasNode(focus)) {
    return [focus];
  }

  return rows
    .filter((row) => row.name.toLowerCase() === focus.toLowerCase())
    .map((row) => row.unique_id);
}

export function graphAction(
  manifestPath: string | undefined,
  options: GraphFocusOptions,
  env: CliEnv,
): void {
  try {
    const paths = resolveArtifactPaths(
      manifestPath,
      undefined,
      options.targetDir,
      options.catalogPath,
    );
    validateSafePath(paths.manifest);
    if (options.output) {
      validateSafePath(options.output);
    }

    if (options.focus) {
      validateString(options.focus);
      validateDepth(options.depth);
    }

    const manifest = loadManifest(paths.manifest);
    const graph = new ManifestGraph(manifest);

    if (options.fieldLevel && paths.catalog) {
      validateSafePath(paths.catalog);
      try {
        const catalog = loadCatalog(paths.catalog);
        graph.addFieldNodes(catalog);
        const analyzer = new SQLAnalyzer();
        const adapterType = (
          manifest.metadata as { adapter_type?: string } | undefined
        )?.adapter_type;
        const sqlDialect = sqlDialectFromDbtAdapterType(adapterType);
        if (manifest.nodes) {
          for (const [uniqueId, node] of Object.entries(manifest.nodes)) {
            const compiledCode = (node as Record<string, unknown>)
              .compiled_code as string | undefined;
            if (compiledCode) {
              const fieldDeps = analyzer.analyze(compiledCode, sqlDialect);
              graph.addFieldEdges(uniqueId, fieldDeps);
            }
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (msg.startsWith("Catalog file not found:")) {
          console.warn(
            "Warning: --field-level requires catalog.json, but it was not found. Falling back to resource-level lineage.",
          );
        } else {
          throw error;
        }
      }
    }

    let graphToExport = graph.getGraph();

    if (options.focus) {
      const focusNodes = resolveFocusNodes(
        graph,
        collectInventoryRows(manifest),
        options.focus,
      );
      if (focusNodes.length === 0) {
        throw new Error(`No nodes matched --focus selector: ${options.focus}`);
      }

      const direction = options.direction ?? "both";
      if (!["upstream", "downstream", "both"].includes(direction)) {
        throw new Error("--direction must be one of: upstream, downstream, both");
      }

      const types = splitCsv(options.resourceTypes);
      const typeSet = types.length
        ? new Set(types.map((entry) => entry.toLowerCase()))
        : undefined;
      graphToExport = createFocusedGraph(
        graph,
        focusNodes,
        direction,
        options.depth,
        typeSet,
      );
    }

    const output = exportGraphToFormat(graphToExport, {
      format: options.format,
      output: options.output,
      fields: options.fields,
    });
    writeGraphOutput(output, options.output);
  } catch (error) {
    env.handleError(error, env.isTTY());
  }
}
