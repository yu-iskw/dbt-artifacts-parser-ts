/**
 * Hex / rgba mirrors of design tokens in `index.css` for canvas, SVG, and TS
 * consumers that cannot use CSS `var()`.
 * Keep in sync when rebranding `:root` in index.css.
 */
export const THEME_HEX = {
  accent: "#4f46e5",
  accentDark: "#6366f1",
  text: "#1c1c2e",
  textSoft: "#9090a8",
  bg: "#f4f4f8",
  bgSoft: "#ffffff",
  slate: "#9090a8",
  rose: "#b91c1c",
  mint: "#15803d",
  amber: "#c27803",
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
  model: "#2563eb",
  test: "#475569",
  seed: "#7c3aed",
  snapshot: "#a16207",
  source: "#0d9448",
  exposure: "#b45309",
  metric: "#a21caf",
  semantic_model: "#0369a1",
  analysis: "#6b7280",
  unit_test: "#475569",
};

export const CANVAS = {
  rowStripe: "rgba(244, 244, 248, 0.55)",
  rowStripeHover: "rgba(79, 70, 229, 0.07)",
  labelText: THEME_HEX.text,
  metaText: THEME_HEX.textSoft,
  axisTick: THEME_HEX.slate,
  gridLine: "rgba(28, 28, 46, 0.07)",
  barHoverStroke: "rgba(79, 70, 229, 0.65)",
  testFailStripe: "rgba(185, 28, 28, 0.9)",
} as const;
