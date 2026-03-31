import type { Dispatch, SetStateAction } from "react";
import { PILL_ACTIVE, PILL_BASE } from "@web/lib/analysis-workspace/constants";
import type { OverviewFilterState } from "@web/lib/analysis-workspace/types";

/**
 * Search, Types, and clear-all for the Health execution slice (inline or inside Refine popover).
 * Dashboard status pills live on the execution section header.
 */
export function HealthSliceFilters({
  filters,
  setFilters,
  availableTypes,
  bodyClassName,
}: {
  filters: OverviewFilterState;
  setFilters: Dispatch<SetStateAction<OverviewFilterState>>;
  availableTypes: string[];
  /** Merged onto the root `role="search"` wrapper (e.g. popover body spacing). */
  bodyClassName?: string;
}) {
  const anyFilterActive =
    filters.resourceTypes.size > 0 ||
    filters.query.trim().length > 0 ||
    filters.status !== "all";

  function toggleType(resourceType: string) {
    setFilters((current) => {
      const next = new Set(current.resourceTypes);
      if (next.has(resourceType)) next.delete(resourceType);
      else next.add(resourceType);
      return { ...current, resourceTypes: next };
    });
  }

  const rootClass = ["health-slice-filters", bodyClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} role="search">
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
  );
}
