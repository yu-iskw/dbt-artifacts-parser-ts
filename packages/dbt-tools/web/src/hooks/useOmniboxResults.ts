import { useEffect, useMemo, useState } from "react";
import type { AnalysisState, ResourceNode } from "@web/types";
import type { SearchState } from "@web/lib/analysis-workspace/types";
import { searchResourcesFromWorker } from "@web/services/analysisLoader";

const OMNIBOX_LIMIT = 8;

/** Recent resources only (empty query). Search hits use the analysis worker. */
export function computeOmniboxRecentResults(
  analysis: AnalysisState | null,
  searchState: SearchState,
): ResourceNode[] {
  if (!analysis || searchState.query.trim()) return [];
  return searchState.recentResourceIds
    .map(
      (id) =>
        analysis.resources.find((resource) => resource.uniqueId === id) ?? null,
    )
    .filter((resource): resource is ResourceNode => resource != null)
    .slice(0, OMNIBOX_LIMIT);
}

/**
 * Omnibox matches: recent picks when the query is empty; otherwise worker-side
 * scan (keeps the main thread responsive on huge projects).
 */
export function useOmniboxResults(
  analysis: AnalysisState | null,
  searchState: SearchState,
): ResourceNode[] {
  const queryTrimmed = searchState.query.trim();
  const recentResults = useMemo(
    () => computeOmniboxRecentResults(analysis, searchState),
    [analysis, searchState.query, searchState.recentResourceIds],
  );

  const [searchHits, setSearchHits] = useState<ResourceNode[]>([]);

  useEffect(() => {
    if (!analysis || !queryTrimmed) {
      setSearchHits([]);
      return;
    }

    let cancelled = false;
    void searchResourcesFromWorker(searchState.query).then((resources) => {
      if (!cancelled) setSearchHits(resources);
    });

    return () => {
      cancelled = true;
    };
  }, [analysis, queryTrimmed, searchState.query]);

  if (!queryTrimmed) {
    return recentResults;
  }
  return searchHits;
}
