import {
  loadAnalysisFromBuffers,
  type AnalysisLoadResult,
} from "./analysisLoader";

/**
 * Fetches manifest.json and run_results.json from /api/ and returns AnalysisLoadResult.
 * Also attempts to fetch catalog.json — silently proceeds without it if absent (404).
 * Used by preload and reload when DBT_TARGET is set.
 */
export async function refetchFromApi(): Promise<AnalysisLoadResult | null> {
  const [manifestRes, runResultsRes] = await Promise.all([
    fetch("/api/manifest.json"),
    fetch("/api/run_results.json"),
  ]);
  if (!manifestRes.ok || !runResultsRes.ok) return null;
  const [manifestBytes, runResultsBytes] = await Promise.all([
    manifestRes.arrayBuffer(),
    runResultsRes.arrayBuffer(),
  ]);
  return loadAnalysisFromBuffers(manifestBytes, runResultsBytes, "preload");
}
