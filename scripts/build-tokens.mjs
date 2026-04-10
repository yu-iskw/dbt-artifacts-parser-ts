#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import StyleDictionary from "style-dictionary";

const repoRoot = process.cwd();
const webRoot = path.join(repoRoot, "packages/dbt-tools/web");
const tokenRoot = path.join(webRoot, "tokens");
const srcRoot = path.join(webRoot, "src");
const stylesOutDir = path.join(srcRoot, "styles");
const libOutDir = path.join(srcRoot, "lib");

const fileHeader = [
  "/**",
  " * AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.",
  " */",
  "",
];

StyleDictionary.registerFormat({
  name: "dbt-tools/css-semantic-vars",
  format: ({ dictionary }) => {
    const allBaseTokens = dictionary.allTokens;

    const lines = allBaseTokens.map((token) => {
      const name = `--dt-${token.path.join("-")}`;
      return `  ${name}: ${token.value};`;
    });

    return [
      ...fileHeader,
      ":root {",
      "  color-scheme: light;",
      ...lines,
      "}",
      "",
    ].join("\n");
  },
});

StyleDictionary.registerFormat({
  name: "dbt-tools/css-dark-theme-overrides",
  format: ({ dictionary }) => {
    const semanticAndComponent = dictionary.allTokens.filter(
      (token) => token.path[0] === "semantic" || token.path[0] === "component",
    );
    const lines = semanticAndComponent.map((token) => {
      const name = `--dt-${token.path.join("-")}`;
      return `  ${name}: ${token.value};`;
    });

    return [
      ...fileHeader,
      '[data-theme="dark"] {',
      "  color-scheme: dark;",
      ...lines,
      "}",
      "",
    ].join("\n");
  },
});

StyleDictionary.registerFormat({
  name: "dbt-tools/typed-tokens",
  format: ({ dictionary }) => {
    const semanticAndComponent = dictionary.allTokens.filter(
      (token) => token.path[0] === "semantic" || token.path[0] === "component",
    );

    const rows = semanticAndComponent.map((token) => {
      const key = token.path.join(".");
      const cssVar = `--dt-${token.path.join("-")}`;
      return `  "${key}": "var(${cssVar})",`;
    });

    const tokenNames = semanticAndComponent.map(
      (token) => `  | "${token.path.join(".")}"`,
    );

    return [
      ...fileHeader,
      "export const tokens = {",
      ...rows,
      "} as const;",
      "",
      "export type TokenName =",
      ...tokenNames,
      ";",
      "",
      "export function tokenVar(name: TokenName): string {",
      "  return tokens[name];",
      "}",
      "",
    ].join("\n");
  },
});

StyleDictionary.registerFormat({
  name: "dbt-tools/tailwind-bridge",
  format: ({ dictionary }) => {
    const semanticColor = dictionary.allTokens.filter(
      (token) => token.path.slice(0, 2).join(".") === "semantic.color",
    );

    const rows = semanticColor.map((token) => {
      const tailwindName = token.path.slice(2).join("-");
      const cssVar = `--dt-${token.path.join("-")}`;
      return `  "${tailwindName}": "rgb(from var(${cssVar}) r g b / <alpha-value>)",`;
    });

    return [
      ...fileHeader,
      "export const tailwindSemanticColors = {",
      ...rows,
      "} as const;",
      "",
    ].join("\n");
  },
});

const baseConfig = {
  source: [
    `${tokenRoot}/primitives/**/*.json`,
    `${tokenRoot}/semantics/**/*.json`,
    `${tokenRoot}/components/**/*.json`,
    `${tokenRoot}/themes/light.json`,
  ],
  platforms: {
    css: {
      transformGroup: "css",
      buildPath: `${stylesOutDir}/`,
      files: [
        {
          destination: "tokens.css",
          format: "dbt-tools/css-semantic-vars",
        },
      ],
    },
    ts: {
      transformGroup: "js",
      buildPath: `${libOutDir}/`,
      files: [
        { destination: "tokens.ts", format: "dbt-tools/typed-tokens" },
        {
          destination: "tailwind-theme-bridge.ts",
          format: "dbt-tools/tailwind-bridge",
        },
      ],
    },
  },
};

const darkConfig = {
  include: [
    `${tokenRoot}/primitives/**/*.json`,
    `${tokenRoot}/semantics/**/*.json`,
    `${tokenRoot}/components/**/*.json`,
    `${tokenRoot}/themes/light.json`,
  ],
  source: [`${tokenRoot}/themes/dark.json`],
  platforms: {
    css: {
      transformGroup: "css",
      buildPath: `${stylesOutDir}/`,
      files: [
        {
          destination: "theme.css",
          format: "dbt-tools/css-dark-theme-overrides",
        },
      ],
    },
  },
};

await fs.mkdir(stylesOutDir, { recursive: true });
await fs.mkdir(libOutDir, { recursive: true });

await new StyleDictionary(baseConfig).buildAllPlatforms();
await new StyleDictionary(darkConfig).buildAllPlatforms();

console.log("Built design tokens for @dbt-tools/web.");
