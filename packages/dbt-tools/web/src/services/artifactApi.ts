import { analyzeArtifacts } from "./analyze";
import type { AnalysisState } from "@web/types";

/**
 * Fetches manifest.json and run_results.json from /api/ and returns AnalysisState.
 * Used by preload and reload when DBT_TARGET is set.
 */
export async function refetchFromApi(): Promise<AnalysisState | null> {
  const [manifestRes, runResultsRes] = await Promise.all([
    fetch("/api/manifest.json"),
    fetch("/api/run_results.json"),
  ]);
  if (!manifestRes.ok || !runResultsRes.ok) return null;
  const [manifestJson, runResultsJson] = await Promise.all([
    manifestRes.json() as Promise<Record<string, unknown>>,
    runResultsRes.json() as Promise<Record<string, unknown>>,
  ]);
  return analyzeArtifacts(manifestJson, runResultsJson);
}
