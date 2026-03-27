import { buildAnalysisSnapshotFromArtifacts } from "@dbt-tools/core/browser";
import type { AnalysisState, CatalogColumn } from "@web/types";

type CatalogTableLike = {
  columns: Record<
    string,
    { name: string; type: string; index: number; comment?: string | null }
  >;
  unique_id?: string | null;
};

function buildCatalogColumnIndex(
  catalogJson: Record<string, unknown>,
): Map<string, CatalogColumn[]> {
  const index = new Map<string, CatalogColumn[]>();

  const addTable = (uniqueId: string, table: CatalogTableLike) => {
    const cols = Object.values(table.columns)
      .map((c) => ({
        name: c.name,
        type: c.type,
        index: c.index,
        comment: c.comment ?? null,
      }))
      .sort((a, b) => a.index - b.index);
    if (cols.length > 0) index.set(uniqueId, cols);
  };

  const nodesRaw = catalogJson.nodes;
  if (nodesRaw != null && typeof nodesRaw === "object") {
    for (const [key, table] of Object.entries(
      nodesRaw as Record<string, unknown>,
    )) {
      if (table == null || typeof table !== "object") continue;
      const t = table as CatalogTableLike;
      const id = typeof t.unique_id === "string" ? t.unique_id : key;
      addTable(id, t);
    }
  }

  const sourcesRaw = catalogJson.sources;
  if (sourcesRaw != null && typeof sourcesRaw === "object") {
    for (const [key, table] of Object.entries(
      sourcesRaw as Record<string, unknown>,
    )) {
      if (table == null || typeof table !== "object") continue;
      const t = table as CatalogTableLike;
      const id = typeof t.unique_id === "string" ? t.unique_id : key;
      addTable(id, t);
    }
  }

  return index;
}

/**
 * Parses manifest and run_results JSON, runs analysis, and returns AnalysisState.
 * Shared by both file upload and API preload paths.
 * catalogJson is optional — when absent, all views work identically without column metadata.
 */
export async function analyzeArtifacts(
  manifestJson: Record<string, unknown>,
  runResultsJson: Record<string, unknown>,
  catalogJson?: Record<string, unknown>,
): Promise<AnalysisState> {
  const snapshot = await buildAnalysisSnapshotFromArtifacts(
    manifestJson,
    runResultsJson,
  );

  if (!catalogJson) return snapshot as unknown as AnalysisState;

  const catalogColumnIndex = buildCatalogColumnIndex(catalogJson);
  const enrichedResources = snapshot.resources.map((r) => ({
    ...r,
    columns: catalogColumnIndex.get(r.uniqueId) ?? [],
  }));
  return { ...snapshot, resources: enrichedResources } as unknown as AnalysisState;
}
