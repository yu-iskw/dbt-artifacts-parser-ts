import { TIMELINE_TIMEZONE_STORAGE_KEY } from "./constants";

export function formatMs(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(0)}m`;
  if (ms >= 10_000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms >= 1_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms.toFixed(0)}ms`;
}

export function formatTimestamp(epochMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(epochMs));
}

export function getAvailableTimeZones(): string[] {
  const localTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const supportedValuesOf = (
    Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    }
  ).supportedValuesOf;
  const supportedTimeZones = supportedValuesOf?.("timeZone") ?? [];
  return Array.from(new Set([localTimeZone, "UTC", ...supportedTimeZones]));
}

export function getInitialTimeZone(): string {
  const localTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  try {
    return (
      window.localStorage.getItem(TIMELINE_TIMEZONE_STORAGE_KEY) ||
      localTimeZone
    );
  } catch {
    return localTimeZone;
  }
}

export function isPositiveStatus(status: string): boolean {
  return ["success", "pass", "passed"].includes(status.trim().toLowerCase());
}

export function computeTicks(
  maxEnd: number,
): Array<{ ms: number; label: string }> {
  if (maxEnd <= 0) return [];
  const STEPS = [
    50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 30000, 60000, 120000,
  ];
  const TARGET = 6;
  const step = STEPS.find((s) => maxEnd / s <= TARGET) ?? 120_000;
  const ticks: Array<{ ms: number; label: string }> = [];
  for (let ms = 0; ms <= maxEnd; ms += step) {
    ticks.push({ ms, label: formatMs(ms) });
  }
  return ticks;
}
