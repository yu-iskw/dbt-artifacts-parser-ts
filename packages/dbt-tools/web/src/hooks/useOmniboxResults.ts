import { useMemo } from "react";
import type { AnalysisState, ResourceNode } from "@web/types";
import type { SearchState } from "@web/lib/analysis-workspace/types";
import { matchesResource } from "@web/lib/analysis-workspace/utils";

const OMNIBOX_LIMIT = 8;

/** Up to {@link OMNIBOX_LIMIT} resources for the global workspace omnibox (recent or search). */
export function computeOmniboxResults(
  analysis: AnalysisState | null,
  searchState: SearchState,
): ResourceNode[] {
  if (!analysis) return [];
  if (!searchState.query.trim()) {
    return searchState.recentResourceIds
      .map(
        (id) =>
          analysis.resources.find((resource) => resource.uniqueId === id) ??
          null,
      )
      .filter((resource): resource is ResourceNode => resource != null)
      .slice(0, OMNIBOX_LIMIT);
  }
  return analysis.resources
    .filter((resource) => matchesResource(resource, searchState.query))
    .slice(0, OMNIBOX_LIMIT);
}

export function useOmniboxResults(
  analysis: AnalysisState | null,
  searchState: SearchState,
) {
  return useMemo(
    () => computeOmniboxResults(analysis, searchState),
    [analysis, searchState.query, searchState.recentResourceIds],
  );
}
