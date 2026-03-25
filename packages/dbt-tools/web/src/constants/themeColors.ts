/**
 * Hex / rgba mirrors of design tokens in `index.css` for canvas, SVG, and TS
 * consumers that cannot use CSS `var()`.
 * Keep in sync when rebranding `:root` in index.css.
 */
export const THEME_HEX = {
  accent: "#0891b2",
  accentDark: "#0e7490",
  text: "#0f172a",
  textSoft: "#64748b",
  bg: "#f1f5f9",
  bgSoft: "#ffffff",
  slate: "#8e97a6",
  rose: "#d86066",
  mint: "#2bb673",
  amber: "#f2a44b",
} as const;

/** Execution status and resource types — match `--dbt-type-*` and status tokens in index.css */
export const STATUS_HEX = {
  success: THEME_HEX.mint,
  error: THEME_HEX.rose,
  skipped: THEME_HEX.slate,
  "run error": THEME_HEX.rose,
  pass: THEME_HEX.mint,
  fail: THEME_HEX.rose,
  warn: THEME_HEX.amber,
  "no op": THEME_HEX.slate,
} as const;

export const RESOURCE_TYPE_HEX: Record<string, string> = {
  model: "#2ac7e6",
  test: "#d0d9e4",
  seed: "#b18dff",
  snapshot: "#ffaf61",
  source: "#9adf53",
  exposure: "#ff8d69",
  metric: "#ff5f9c",
  semantic_model: "#76a3ff",
  analysis: "#a6b4c6",
  unit_test: "#d0d9e4",
};

export const CANVAS = {
  rowStripe: "rgba(241, 245, 249, 0.55)",
  rowStripeHover: "rgba(8, 145, 178, 0.07)",
  labelText: THEME_HEX.text,
  metaText: THEME_HEX.textSoft,
  axisTick: THEME_HEX.slate,
  gridLine: "rgba(15, 23, 42, 0.07)",
  barHoverStroke: "rgba(8, 145, 178, 0.65)",
  testFailStripe: "rgba(216, 96, 102, 0.9)",
} as const;
