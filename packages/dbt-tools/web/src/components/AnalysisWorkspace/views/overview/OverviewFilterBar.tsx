import type { Dispatch, SetStateAction } from "react";
import { PILL_ACTIVE, PILL_BASE } from "@web/lib/analysis-workspace/constants";
import type {
  DashboardStatusFilter,
  OverviewFilterState,
} from "@web/lib/analysis-workspace/types";

export function OverviewFilterBar({
  filters,
  setFilters,
  availableTypes,
  resultCount,
}: {
  filters: OverviewFilterState;
  setFilters: Dispatch<SetStateAction<OverviewFilterState>>;
  availableTypes: string[];
  resultCount: number;
}) {
  const activeCount =
    (filters.status !== "all" ? 1 : 0) +
    filters.resourceTypes.size +
    (filters.query.trim() ? 1 : 0);

  function toggleType(resourceType: string) {
    setFilters((current) => {
      const next = new Set(current.resourceTypes);
      if (next.has(resourceType)) next.delete(resourceType);
      else next.add(resourceType);
      return { ...current, resourceTypes: next };
    });
  }

  return (
    <div className="overview-filter-bar">
      <div className="overview-filter-bar__topline">
        <div className="overview-filter-bar__title">
          <span>Dashboard filters</span>
          <strong>{resultCount} matching runs</strong>
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            className={PILL_BASE}
            onClick={() =>
              setFilters({
                status: "all",
                resourceTypes: new Set(),
                query: "",
              })
            }
          >
            Clear all ({activeCount})
          </button>
        )}
      </div>

      <div className="overview-filter-bar__controls">
        <div className="pill-row">
          {[
            { value: "all", label: "All" },
            { value: "positive", label: "Healthy" },
            { value: "warning", label: "Warnings" },
            { value: "danger", label: "Errors" },
          ].map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={
                filters.status === filter.value ? PILL_ACTIVE : PILL_BASE
              }
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  status: filter.value as DashboardStatusFilter,
                }))
              }
            >
              {filter.label}
            </button>
          ))}
        </div>

        {availableTypes.length > 0 && (
          <div className="pill-row">
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
                  {active && " ✓"}
                </button>
              );
            })}
          </div>
        )}

        <label className="workspace-search workspace-search--compact overview-filter-bar__search">
          <span>Search executions</span>
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
            />
            {filters.query && (
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
            )}
          </div>
        </label>
      </div>
    </div>
  );
}
