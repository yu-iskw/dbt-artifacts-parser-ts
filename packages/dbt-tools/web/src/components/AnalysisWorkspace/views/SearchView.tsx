import type { Dispatch, SetStateAction } from "react";
import { useDeferredValue, useMemo } from "react";
import type { AnalysisState, ResourceNode } from "@web/types";
import type { SearchViewState, WorkspaceView } from "@web/lib/analysis-workspace/types";
import { matchesResource } from "@web/lib/analysis-workspace/utils";
import { SectionCard } from "../shared";

const MAX_RESULTS_PER_GROUP = 20;

interface SearchGroup {
  label: string;
  items: ResourceNode[];
  targetView: WorkspaceView;
}

function buildSearchGroups(
  resources: ResourceNode[],
  query: string,
): SearchGroup[] {
  if (!query.trim()) return [];

  const matched = resources.filter((r) => matchesResource(r, query));

  const assets = matched.filter(
    (r) =>
      r.resourceType !== "test" && r.resourceType !== "unit_test",
  );
  const tests = matched.filter(
    (r) => r.resourceType === "test" || r.resourceType === "unit_test",
  );

  const groups: SearchGroup[] = [];
  if (assets.length > 0) {
    groups.push({
      label: "Assets",
      items: assets.slice(0, MAX_RESULTS_PER_GROUP),
      targetView: "inventory",
    });
  }
  if (tests.length > 0) {
    groups.push({
      label: "Tests",
      items: tests.slice(0, MAX_RESULTS_PER_GROUP),
      targetView: "quality",
    });
  }

  return groups;
}

/**
 * Search — cross-entity find and command-driven navigation.
 *
 * Provides a single search input that matches across all workspace assets and
 * lets the user jump directly to the appropriate lens with the entity selected.
 */
export function SearchView({
  analysis,
  searchViewState,
  onSearchViewStateChange,
  onNavigateTo,
}: {
  analysis: AnalysisState;
  searchViewState: SearchViewState;
  onSearchViewStateChange: Dispatch<SetStateAction<SearchViewState>>;
  onNavigateTo: (view: WorkspaceView, resourceId?: string) => void;
}) {
  const deferredQuery = useDeferredValue(searchViewState.query);

  const groups = useMemo(
    () => buildSearchGroups(analysis.resources, deferredQuery),
    [analysis.resources, deferredQuery],
  );

  const totalMatches = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="workspace-view search-view">
      {/* ── Lens header ── */}
      <div className="lens-header">
        <div className="lens-header__title">
          <p className="eyebrow">Workspace lens</p>
          <h2>Search</h2>
          <p className="lens-header__desc">
            Find any asset, test, or resource across the workspace.
          </p>
        </div>
      </div>

      {/* ── Search input ── */}
      <div className="search-input-region">
        <label className="workspace-search search-view__input">
          <span>Search workspace</span>
          <input
            autoFocus
            value={searchViewState.query}
            onChange={(e) =>
              onSearchViewStateChange((current) => ({
                ...current,
                query: e.target.value,
              }))
            }
            placeholder="Search by name, type, path, or ID…"
            aria-label="Search workspace"
          />
        </label>
        {searchViewState.query && (
          <button
            type="button"
            className="search-view__clear"
            aria-label="Clear search"
            onClick={() =>
              onSearchViewStateChange((current) => ({ ...current, query: "" }))
            }
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Results ── */}
      {deferredQuery.trim() ? (
        totalMatches === 0 ? (
          <div className="search-no-results">
            <p>No results for <strong>{deferredQuery}</strong></p>
            <p className="search-no-results__hint">
              Try searching by resource name, type (model, source, seed), or unique ID.
            </p>
          </div>
        ) : (
          <div className="search-results">
            {groups.map((group) => (
              <div key={group.label}>
              <SectionCard
                title={group.label}
                subtitle={`${group.items.length}${group.items.length === MAX_RESULTS_PER_GROUP ? "+" : ""} matching`}
              >
                <div className="search-result-list">
                  {group.items.map((resource) => (
                    <button
                      key={resource.uniqueId}
                      type="button"
                      className="search-result-row"
                      onClick={() =>
                        onNavigateTo(group.targetView, resource.uniqueId)
                      }
                    >
                      <span className="search-result-row__type">
                        {resource.resourceType}
                      </span>
                      <span className="search-result-row__name">
                        {resource.name}
                      </span>
                      {resource.path && (
                        <span className="search-result-row__path">
                          {resource.path}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </SectionCard>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="search-idle">
          <p className="search-idle__hint">
            Start typing to search across {analysis.resources.length} assets.
          </p>
        </div>
      )}
    </div>
  );
}
