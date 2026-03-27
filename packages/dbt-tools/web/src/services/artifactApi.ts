import { analyzeArtifacts } from "./analyze";
import type { AnalysisState } from "@web/types";

/**
 * Fetches manifest.json and run_results.json from /api/ and returns AnalysisState.
 * Also attempts to fetch catalog.json — silently proceeds without it if absent (404).
 * Used by preload and reload when DBT_TARGET is set.
 */
export async function refetchFromApi(): Promise<AnalysisState | null> {
  const [manifestRes, runResultsRes, catalogRes] = await Promise.all([
    fetch("/api/manifest.json"),
    fetch("/api/run_results.json"),
    fetch("/api/catalog.json").catch(() => null),
  ]);
  if (!manifestRes.ok || !runResultsRes.ok) return null;
  const [manifestJson, runResultsJson] = await Promise.all([
    manifestRes.json() as Promise<Record<string, unknown>>,
    runResultsRes.json() as Promise<Record<string, unknown>>,
  ]);
  const catalogJson = catalogRes?.ok
    ? await (catalogRes.json() as Promise<Record<string, unknown>>).catch(
        () => undefined,
      )
    : undefined;
  return analyzeArtifacts(manifestJson, runResultsJson, catalogJson);
}
