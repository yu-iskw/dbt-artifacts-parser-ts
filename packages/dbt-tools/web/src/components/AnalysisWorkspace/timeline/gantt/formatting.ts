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

export function isSkippedStatus(status: string): boolean {
  return ["skipped", "no op"].includes(status.trim().toLowerCase());
}

export function isIssueStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return !isPositiveStatus(normalized) && !isSkippedStatus(normalized);
}

export function computeTicks(
  rangeStart: number,
  rangeEnd: number,
): Array<{ ms: number; label: string }> {
  if (rangeEnd <= rangeStart) return [];
  const span = rangeEnd - rangeStart;
  const STEPS = [
    50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 30000, 60000, 120000,
  ];
  const TARGET = 6;
  const step = STEPS.find((s) => span / s <= TARGET) ?? 120_000;
  const ticks: Array<{ ms: number; label: string }> = [];
  const first = Math.ceil(rangeStart / step) * step;
  if (rangeStart > 0) {
    ticks.push({ ms: rangeStart, label: formatMs(rangeStart) });
  }
  for (let ms = first; ms <= rangeEnd; ms += step) {
    if (ms <= rangeStart || ms >= rangeEnd) continue;
    ticks.push({ ms, label: formatMs(ms) });
  }
  ticks.push({ ms: rangeEnd, label: formatMs(rangeEnd) });
  return ticks;
}
