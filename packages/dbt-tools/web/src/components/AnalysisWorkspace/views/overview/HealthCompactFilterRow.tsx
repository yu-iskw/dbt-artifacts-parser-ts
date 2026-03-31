import type { Dispatch, SetStateAction } from "react";
import { PILL_ACTIVE, PILL_BASE } from "@web/lib/analysis-workspace/constants";
import type {
  DashboardStatusFilter,
  OverviewFilterState,
} from "@web/lib/analysis-workspace/types";

export function HealthCompactFilterRow({
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
    <div className="health-compact-filter" role="search">
      <div className="health-compact-filter__row">
        <div className="health-compact-filter__pills pill-row">
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
          <details className="health-compact-filter__types">
            <summary className="health-compact-filter__types-summary">
              Types
              {filters.resourceTypes.size > 0 && (
                <span className="health-compact-filter__types-badge">
                  {filters.resourceTypes.size}
                </span>
              )}
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
                    {active && " ✓"}
                  </button>
                );
              })}
            </div>
          </details>
        )}

        <span className="health-compact-filter__count">
          {resultCount.toLocaleString()} runs
        </span>

        {activeCount > 0 && (
          <button
            type="button"
            className="health-compact-filter__clear"
            onClick={() =>
              setFilters({
                status: "all",
                resourceTypes: new Set(),
                query: "",
              })
            }
          >
            Clear ({activeCount})
          </button>
        )}
      </div>

      <label className="workspace-search workspace-search--compact health-compact-filter__search">
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
  );
}
