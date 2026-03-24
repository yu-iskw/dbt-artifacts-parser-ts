import type { CSSProperties } from "react";

export const ROW_H = 44;
export const BAR_H = 14;
export const BAR_PAD = 6;
export const NAME_Y = 14;
export const TIME_Y = 34;
export const LABEL_W = 160;
export const X_PAD = 24;
export const AXIS_TOP = 32;
export const MIN_VIEWPORT_H = 240;
export const VIEWPORT_SCREEN_PADDING = 320;
export const MAX_VIEWPORT_RATIO = 0.78;

export const TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: "var(--text-soft)",
  fontSize: "0.82rem",
};

export const TIMELINE_TIMEZONE_STORAGE_KEY = "dbt-tools.timelineTimezone";

export type DisplayMode = "duration" | "timestamps";
