import { PILL_ACTIVE, PILL_BASE } from "@web/lib/workspace-state/constants";
import type { LensMode } from "@web/lib/workspace-state/types";

export function LensSelector({
  lensMode,
  setLensMode,
}: {
  lensMode: LensMode;
  setLensMode: (mode: LensMode) => void;
}) {
  const modes: Array<{ value: LensMode; label: string }> = [
    { value: "type", label: "Type" },
    { value: "status", label: "Status" },
    { value: "coverage", label: "Coverage" },
  ];
  return (
    <div className="lens-selector">
      <span className="lens-selector__label">Lens</span>
      {modes.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={lensMode === value ? PILL_ACTIVE : PILL_BASE}
          onClick={() => setLensMode(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
