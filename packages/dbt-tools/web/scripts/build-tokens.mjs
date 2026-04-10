#!/usr/bin/env node
/**
 * DTCG-style token JSON → CSS custom properties, Tailwind v4 @theme bridge, TS exports.
 * Run from package root: node scripts/build-tokens.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");
const TOKENS_DIR = path.join(PKG_ROOT, "tokens");
const OUT_CSS = path.join(PKG_ROOT, "src/styles/tokens.css");
const OUT_THEME = path.join(PKG_ROOT, "src/styles/theme.css");
const OUT_TW = path.join(PKG_ROOT, "src/styles/tailwind.theme.css");
const OUT_TS = path.join(PKG_ROOT, "src/lib/tokens.generated.ts");
const OUT_THEME_COLORS = path.join(PKG_ROOT, "src/constants/themeColors.generated.ts");

/** @typedef {{ $type?: string, $value?: unknown, $extensions?: { dbt?: { cssVar?: string, cssVarRef?: string } } }} TokenNode */

const LEGACY_ALIASES = [
  ["bg", "bg-canvas"],
  ["bg-soft", "bg-surface-muted"],
  ["panel", "bg-surface"],
  ["panel-strong", "bg-surface-muted"],
  ["panel-border", "border-default"],
  ["text", "text-primary"],
  ["text-muted", "text-secondary"],
  ["text-soft", "text-tertiary"],
  ["accent", "accent-primary"],
  ["bg-muted", "bg-surface-muted"],
];

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string[]} pathParts
 * @param {(leaf: TokenNode, jsonPath: string) => void} onLeaf
 */
function walkTokens(obj, pathParts, onLeaf) {
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith("$")) continue;
    if (v === null || typeof v !== "object" || Array.isArray(v)) continue;
    const node = /** @type {TokenNode} */ (v);
    if ("$value" in node && node.$value !== undefined) {
      onLeaf(node, [...pathParts, k].join("."));
    } else {
      walkTokens(/** @type {Record<string, unknown>} */ (v), [...pathParts, k], onLeaf);
    }
  }
}

/** @param {string} dir */
function loadAllSemantics(dir) {
  /** @type {Array<{ cssVar: string, value: string, jsonPath: string }>} */
  const rows = [];
  if (!fs.existsSync(dir)) return rows;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const data = readJson(path.join(dir, f));
    walkTokens(data, ["semantic", f.replace(/\.json$/, "")], (leaf, jsonPath) => {
      const ext = leaf.$extensions?.dbt;
      if (!ext?.cssVar) return;
      const raw = formatTokenValue(leaf);
      rows.push({ cssVar: ext.cssVar, value: raw, jsonPath });
    });
  }
  rows.sort((a, b) => a.cssVar.localeCompare(b.cssVar));
  return rows;
}

/** @param {TokenNode} leaf */
function formatTokenValue(leaf) {
  const v = leaf.$value;
  const t = leaf.$type;
  if (t === "fontFamily" && Array.isArray(v)) {
    return v.map((x) => (String(x).includes(" ") ? `"${x}"` : x)).join(", ");
  }
  if (t === "cubicBezier" && Array.isArray(v) && v.length === 4) {
    return `cubic-bezier(${v.join(", ")})`;
  }
  if (t === "shadow" && typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  return String(v);
}

/** @param {string} dir */
function loadComponentTokens(dir) {
  /** @type {Array<{ cssVar: string, cssValue: string, jsonPath: string }>} */
  const rows = [];
  if (!fs.existsSync(dir)) return rows;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const data = readJson(path.join(dir, f));
    walkTokens(data, ["component", f.replace(/\.json$/, "")], (leaf, jsonPath) => {
      const ext = leaf.$extensions?.dbt;
      if (!ext?.cssVar) return;
      const cssValue = ext.cssVarRef
        ? `var(--${ext.cssVarRef})`
        : formatTokenValue(leaf);
      rows.push({ cssVar: ext.cssVar, cssValue, jsonPath });
    });
  }
  rows.sort((a, b) => a.cssVar.localeCompare(b.cssVar));
  return rows;
}

/** @param {string} s */
function hexUpper(s) {
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
  return s;
}

/** @param {string} s */
function hexLower(s) {
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  return s;
}

/** @param {string} hex #RRGGBB */
function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * @param {Array<{ cssVar: string, value: string }>} semanticRows
 * @param {Map<string, string>} darkMap
 */
function buildResolvedMaps(semanticRows, darkMap) {
  /** @type {Record<string, string>} */
  const light = {};
  /** @type {Record<string, string>} */
  const dark = {};
  for (const r of semanticRows) {
    light[r.cssVar] = r.value;
    dark[r.cssVar] = darkMap.get(r.cssVar) ?? r.value;
  }
  dark["graph-node-selected-stroke"] = dark["accent-primary"];
  light["graph-node-selected-stroke"] = light["accent-primary"];
  return { light, dark };
}

function loadDarkOverrides() {
  const p = path.join(TOKENS_DIR, "themes", "dark.json");
  const data = readJson(p);
  const list = data.overrides;
  if (!Array.isArray(list)) return new Map();
  /** @type {Map<string, string>} */
  const m = new Map();
  for (const row of list) {
    if (row && typeof row.cssVar === "string" && typeof row.$value === "string") {
      m.set(row.cssVar, row.$value);
    }
  }
  return m;
}

function cssBlockComment(title) {
  return `\n  /* ${title} */\n`;
}

function buildTokensCss(semanticRows, componentRows, darkMap) {
  const semanticLines = semanticRows.map((r) => `  --${r.cssVar}: ${r.value};`);
  semanticLines.push("  --graph-node-selected-stroke: var(--accent-primary);");
  const componentLines = componentRows.map(
    (r) => `  --${r.cssVar}: ${r.cssValue};`,
  );
  const legacyLines = LEGACY_ALIASES.map(
    ([alias, target]) => `  --${alias}: var(--${target});`,
  );

  const darkSemantic = semanticRows
    .filter((r) => darkMap.has(r.cssVar))
    .map((r) => `  --${r.cssVar}: ${darkMap.get(r.cssVar)};`);
  // Component tokens that reference var(--x) pick up dark automatically; only emit if overridden
  const darkComponent = componentRows
    .filter((r) => darkMap.has(r.cssVar))
    .map((r) => `  --${r.cssVar}: ${darkMap.get(r.cssVar)};`);

  return `/* AUTO-GENERATED by scripts/build-tokens.mjs — do not edit by hand */
:root {
  color-scheme: light;
${cssBlockComment("Semantic design tokens (meaning-first)")}${semanticLines.join("\n")}
${cssBlockComment("Component tokens (design-system primitives only)")}${componentLines.join("\n")}
${cssBlockComment("Legacy aliases (gradual migration)")}${legacyLines.join("\n")}
}

[data-theme="dark"] {
  color-scheme: dark;
${cssBlockComment("Semantic + component overrides for dark mode")}${[...darkSemantic, ...darkComponent].join("\n")}
}
`;
}

function buildThemeCss() {
  return `/* AUTO-GENERATED by scripts/build-tokens.mjs — theme supplements (typography/motion/z-index live in tokens.css) */
[data-theme="dark"] {
  /* Tooltip shadow tuned for dark surfaces */
  --shadow-tooltip: 0 8px 24px rgb(0 0 0 / 45%);
}
`;
}

function buildTailwindThemeCss() {
  return `/* AUTO-GENERATED — Tailwind v4 @theme bridge → semantic CSS variables
 * Imported after \`@import url("tailwindcss")\` in app.css (see src/styles/app.css).
 * Use e.g. bg-background, text-foreground, border-border in feature code. */
@theme inline {
  --color-background: var(--bg-canvas);
  --color-foreground: var(--text-primary);
  --color-muted: var(--text-secondary);
  --color-subtle: var(--text-tertiary);
  --color-card: var(--bg-surface);
  --color-card-muted: var(--bg-surface-muted);
  --color-border: var(--border-default);
  --color-border-subtle: var(--border-subtle);
  --color-input: var(--border-default);
  --color-ring: var(--border-focus);
  --color-primary: var(--accent-primary);
  --color-primary-foreground: var(--text-inverse);
  --color-destructive: var(--text-danger);
  --color-destructive-foreground: var(--text-inverse);
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --shadow-panel: var(--panel-shadow);
}
`;
}

function buildTsModule(semanticRows, componentRows) {
  const semanticObj = semanticRows.map(
    (r) => `  "${r.cssVar}": "--${r.cssVar}",`,
  );
  const componentObj = componentRows.map(
    (r) => `  "${r.cssVar}": "--${r.cssVar}",`,
  );
  return `/* AUTO-GENERATED by scripts/build-tokens.mjs */
/** CSS custom property name for a semantic token (use with var(...)) */
export type SemanticCssVar = ${semanticRows.map((r) => `"--${r.cssVar}"`).join(" | ") || '"--bg-canvas"'};

/** Runtime reference: semantic token → var(--name) */
export const semanticVars = {
${semanticObj.join("\n")}
} as const;

/** Design-system component tokens — do not use in feature pages */
export const componentVars = {
${componentObj.join("\n")}
} as const;

export function varRef(name: keyof typeof semanticVars): string {
  return \`var(\${semanticVars[name]})\`;
}
`;
}

/**
 * @param {Record<string, string>} light
 * @param {Record<string, string>} dark
 */
function buildThemeColorsTs(light, dark) {
  const themeHexBlock = (L) =>
    `{\n  accent: ${JSON.stringify(hexUpper(L["accent-primary"]))},\n  text: ${JSON.stringify(hexUpper(L["text-primary"]))},\n  textSoft: ${JSON.stringify(hexUpper(L["text-tertiary"]))},\n  bg: ${JSON.stringify(hexUpper(L["bg-canvas"]))},\n  bgSoft: ${JSON.stringify(hexUpper(L["bg-surface"]))},\n  borderDefault: ${JSON.stringify(hexUpper(L["border-default"]))},\n  borderSubtle: ${JSON.stringify(hexUpper(L["border-subtle"]))},\n  slate: ${JSON.stringify(hexUpper(L["chart-8"]))},\n  rose: ${JSON.stringify(hexUpper(L["text-danger"]))},\n  mint: ${JSON.stringify(hexUpper(L["text-success"]))},\n  amber: ${JSON.stringify(hexUpper(L["text-warning"]))},\n} as const`;

  const resourceKeys = [
    ["model", "dbt-type-model"],
    ["test", "dbt-type-test"],
    ["seed", "dbt-type-seed"],
    ["snapshot", "dbt-type-snapshot"],
    ["source", "dbt-type-source"],
    ["source_freshness", "dbt-type-source"],
    ["exposure", "dbt-type-exposure"],
    ["metric", "dbt-type-metric"],
    ["semantic_model", "dbt-type-semantic-model"],
    ["analysis", "dbt-type-test"],
    ["unit_test", "dbt-type-test"],
  ];
  const hexMapLight = (L) => {
    const lines = resourceKeys.map(
      ([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(hexUpper(L[v]))},`,
    );
    return `{\n${lines.join("\n")}\n}`;
  };
  const hexMapDark = (L) => {
    const lines = resourceKeys.map(
      ([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(hexLower(L[v]))},`,
    );
    return `{\n${lines.join("\n")}\n}`;
  };
  const softMap = (L) => {
    const lines = resourceKeys.map(([k, v]) => {
      const softKey = `${v}-soft`;
      return `  ${JSON.stringify(k)}: ${JSON.stringify(L[softKey])},`;
    });
    return `{\n${lines.join("\n")}\n}`;
  };

  const canvas = (L, theme) => {
    const td = L["text-danger"];
    const tw = L["text-warning"];
    const failStripe =
      td.startsWith("#") && td.length === 7
        ? hexToRgba(td, theme === "light" ? 0.9 : 0.88)
        : td;
    const skipStripe =
      tw.startsWith("#") && tw.length === 7
        ? hexToRgba(tw, theme === "light" ? 0.88 : 0.88)
        : tw;
    return `{\n  rowStripe: ${JSON.stringify(hexUpper(L["bg-surface-muted"]))},\n  rowStripeHover: ${JSON.stringify(hexUpper(L["bg-selection-soft"]))},\n  labelText: ${JSON.stringify(hexUpper(L["text-primary"]))},\n  metaText: ${JSON.stringify(hexUpper(L["text-tertiary"]))},\n  axisTick: ${JSON.stringify(hexUpper(L["chart-8"]))},\n  gridLine: ${JSON.stringify(hexUpper(L["border-subtle"]))},\n  barHoverStroke: ${JSON.stringify(hexUpper(L["accent-primary"]))},\n  testFailStripe: ${JSON.stringify(failStripe)},\n  testSkipStripe: ${JSON.stringify(skipStripe)},\n  hullStroke: ${JSON.stringify(hexUpper(L["border-strong"]))},\n  hullFill: ${JSON.stringify(theme === "light" ? "rgba(230, 233, 240, 0.35)" : "rgba(38, 46, 71, 0.4)")},\n} as const`;
  };

  return `/* AUTO-GENERATED by scripts/build-tokens.mjs — canvas/chart hex mirrors of CSS tokens */
export type ThemeMode = "light" | "dark";

export const THEME_HEX_LIGHT = ${themeHexBlock(light)};

export const THEME_HEX_DARK = ${themeHexBlock(dark)};

export function getThemeHex(theme: ThemeMode) {
  return theme === "dark" ? THEME_HEX_DARK : THEME_HEX_LIGHT;
}

export const STATUS_HEX_LIGHT = {
  success: THEME_HEX_LIGHT.mint,
  error: THEME_HEX_LIGHT.rose,
  skipped: THEME_HEX_LIGHT.slate,
  "run error": THEME_HEX_LIGHT.rose,
  pass: THEME_HEX_LIGHT.mint,
  fail: THEME_HEX_LIGHT.rose,
  warn: THEME_HEX_LIGHT.amber,
  "no op": THEME_HEX_LIGHT.slate,
} as const;

export const STATUS_HEX_DARK = {
  success: THEME_HEX_DARK.mint,
  error: THEME_HEX_DARK.rose,
  skipped: THEME_HEX_DARK.slate,
  "run error": THEME_HEX_DARK.rose,
  pass: THEME_HEX_DARK.mint,
  fail: THEME_HEX_DARK.rose,
  warn: THEME_HEX_DARK.amber,
  "no op": THEME_HEX_DARK.slate,
} as const;

export const RESOURCE_TYPE_HEX_LIGHT: Record<string, string> = ${hexMapLight(light)};

export const RESOURCE_TYPE_HEX_DARK: Record<string, string> = ${hexMapDark(dark)};

export const RESOURCE_TYPE_SOFT_FILL_LIGHT: Record<string, string> = ${softMap(light)};

export const RESOURCE_TYPE_SOFT_FILL_DARK: Record<string, string> = ${softMap(dark)};

export function getResourceTypeHexMap(theme: ThemeMode): Record<string, string> {
  return theme === "dark" ? RESOURCE_TYPE_HEX_DARK : RESOURCE_TYPE_HEX_LIGHT;
}

export function getResourceTypeSoftFillMap(theme: ThemeMode): Record<string, string> {
  return theme === "dark" ? RESOURCE_TYPE_SOFT_FILL_DARK : RESOURCE_TYPE_SOFT_FILL_LIGHT;
}

export function getResourceTypeSoftFill(resourceType: string | undefined, theme: ThemeMode): string {
  const map = getResourceTypeSoftFillMap(theme);
  if (resourceType && map[resourceType]) return map[resourceType]!;
  return map["test"]!;
}

export const CANVAS_LIGHT = ${canvas(light, "light")};

export const CANVAS_DARK = ${canvas(dark, "dark")};

export function getCanvasColors(theme: ThemeMode) {
  return theme === "dark" ? CANVAS_DARK : CANVAS_LIGHT;
}
`;
}

function main() {
  const semanticDir = path.join(TOKENS_DIR, "semantics");
  const componentDir = path.join(TOKENS_DIR, "components");
  const semanticRows = loadAllSemantics(semanticDir);
  const componentRows = loadComponentTokens(componentDir);
  const darkMap = loadDarkOverrides();
  const { light, dark } = buildResolvedMaps(semanticRows, darkMap);

  fs.writeFileSync(OUT_CSS, buildTokensCss(semanticRows, componentRows, darkMap));
  fs.writeFileSync(OUT_THEME, buildThemeCss());
  fs.writeFileSync(OUT_TW, buildTailwindThemeCss());
  fs.writeFileSync(OUT_TS, buildTsModule(semanticRows, componentRows));
  fs.writeFileSync(OUT_THEME_COLORS, buildThemeColorsTs(light, dark));

  console.log(
    `Wrote ${path.relative(PKG_ROOT, OUT_CSS)}, ${path.relative(PKG_ROOT, OUT_THEME)}, ${path.relative(PKG_ROOT, OUT_TW)}, ${path.relative(PKG_ROOT, OUT_TS)}, ${path.relative(PKG_ROOT, OUT_THEME_COLORS)}`,
  );
}

main();
