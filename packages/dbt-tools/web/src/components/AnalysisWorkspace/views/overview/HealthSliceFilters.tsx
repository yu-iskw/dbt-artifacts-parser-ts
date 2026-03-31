import type { Dispatch, SetStateAction } from "react";
import { PILL_ACTIVE, PILL_BASE } from "@web/lib/analysis-workspace/constants";
import type { OverviewFilterState } from "@web/lib/analysis-workspace/types";

/**
 * Types, text search, and clear — scoped under a "Slice" disclosure so the
 * Execution breakdown header can carry status pills alone.
 */
export function HealthSliceFilters({
  filters,
  setFilters,
  availableTypes,
}: {
  filters: OverviewFilterState;
  setFilters: Dispatch<SetStateAction<OverviewFilterState>>;
  availableTypes: string[];
}) {
  const sliceActiveCount =
    filters.resourceTypes.size + (filters.query.trim() ? 1 : 0);
  const anyFilterActive = sliceActiveCount > 0 || filters.status !== "all";

  function toggleType(resourceType: string) {
    setFilters((current) => {
      const next = new Set(current.resourceTypes);
      if (next.has(resourceType)) next.delete(resourceType);
      else next.add(resourceType);
      return { ...current, resourceTypes: next };
    });
  }

  return (
    <div className="health-slice-filters">
      <details className="health-slice-filters__details">
        <summary className="health-slice-filters__summary">
          Slice
          {sliceActiveCount > 0 && (
            <span className="health-slice-filters__summary-badge">
              {sliceActiveCount}
            </span>
          )}
        </summary>
        <div className="health-slice-filters__body" role="search">
          <label className="workspace-search workspace-search--compact health-slice-filters__search">
            <div className="workspace-search__input-row">
              <input
                value={filters.query}
                onChange={(e) =>
                  setFilters((current) => ({
                    ...current,
                    query: e.target.value,
                  }))
                }
                placeholder="Filter by name, path, status, or thread…"
                aria-label="Search executions"
              />
              {filters.query ? (
                <button
                  type="button"
                  className="workspace-search__clear"
                  aria-label="Clear dashboard search"
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      query: "",
                    }))
                  }
                >
                  ✕
                </button>
              ) : null}
            </div>
          </label>

          {availableTypes.length > 0 ? (
            <details className="health-compact-filter__types">
              <summary className="health-compact-filter__types-summary">
                Types
                {filters.resourceTypes.size > 0 ? (
                  <span className="health-compact-filter__types-badge">
                    {filters.resourceTypes.size}
                  </span>
                ) : null}
              </summary>
              <div className="health-compact-filter__types-body pill-row">
                {availableTypes.map((type) => {
                  const active = filters.resourceTypes.has(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      className={active ? PILL_ACTIVE : PILL_BASE}
                      onClick={() => toggleType(type)}
                    >
                      {type.replace("_", " ")}
                      {active ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
            </details>
          ) : null}

          {anyFilterActive ? (
            <button
              type="button"
              className="health-slice-filters__clear"
              onClick={() =>
                setFilters({
                  status: "all",
                  resourceTypes: new Set(),
                  query: "",
                })
              }
            >
              Clear all filters
            </button>
          ) : null}
        </div>
      </details>
    </div>
  );
}
