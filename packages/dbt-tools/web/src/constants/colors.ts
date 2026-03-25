import {
  RESOURCE_TYPE_HEX,
  STATUS_HEX,
  THEME_HEX,
} from "@web/constants/themeColors";

/** Execution status → bar fill color. */
export const STATUS_COLORS: Record<string, string> = { ...STATUS_HEX };

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status.toLowerCase()] ?? THEME_HEX.textSoft;
}

/** dbt resource type → left-border accent color. */
export const RESOURCE_TYPE_COLORS: Record<string, string> = {
  ...RESOURCE_TYPE_HEX,
};

export function getResourceTypeColor(resourceType: string | undefined): string {
  return (
    (resourceType && RESOURCE_TYPE_COLORS[resourceType]) ?? "#cbd5e1"
  );
}
