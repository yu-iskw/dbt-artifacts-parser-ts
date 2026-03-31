import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { Popover } from "@web/components/ui/Popover";
import { buildHealthExecutionSliceSummary } from "@web/lib/analysis-workspace/healthExecutionSliceSummary";
import type { OverviewFilterState } from "@web/lib/analysis-workspace/types";
import { HealthSliceFilters } from "./HealthSliceFilters";

/**
 * Refine slice: chip opens a panel with search, Types, and clear-all (Execution breakdown).
 * Dashboard status stays on the section header pills.
 */
export function HealthExecutionSliceRefine({
  filters,
  setFilters,
  availableTypes,
  sliceDescriptionId,
}: {
  filters: OverviewFilterState;
  setFilters: Dispatch<SetStateAction<OverviewFilterState>>;
  availableTypes: string[];
  /** `id` of the Execution breakdown subtitle for aria-describedby on the trigger. */
  sliceDescriptionId: string;
}) {
  const [open, setOpen] = useState(false);
  const summary = useMemo(
    () => buildHealthExecutionSliceSummary(filters),
    [filters],
  );
  const triggerLabel = `Refine slice · ${summary}`;

  return (
    <div className="health-exec-slice-refine">
      <Popover
        open={open}
        onOpenChange={setOpen}
        triggerLabel={triggerLabel}
        triggerClassName="ui-popover__trigger health-exec-slice-refine__trigger"
        triggerAriaDescribedBy={sliceDescriptionId}
      >
        <div className="health-exec-slice-refine__panel-inner">
          <HealthSliceFilters
            filters={filters}
            setFilters={setFilters}
            availableTypes={availableTypes}
            bodyClassName="health-slice-filters--popover-body"
          />
        </div>
      </Popover>
    </div>
  );
}
