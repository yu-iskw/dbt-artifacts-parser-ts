import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import sonarjs from "eslint-plugin-sonarjs";
import vitestPlugin from "@vitest/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

/** @type {import("@typescript-eslint/parser").ParserOptions} */
const tsProjectOptions = {
  ecmaVersion: 2022,
  sourceType: "module",
  project: [
    "./packages/dbt-artifacts-parser/tsconfig.eslint.json",
    "./packages/dbt-tools/core/tsconfig.eslint.json",
    "./packages/dbt-tools/cli/tsconfig.eslint.json",
    "./packages/dbt-tools/web/tsconfig.eslint.json",
    "./packages/dbt-tools/web/tsconfig.node.json",
    "./packages/dbt-tools/web/tsconfig.e2e.json",
  ],
};

/**
 * Shared production + test rules (AI agent feedback).
 * Cyclomatic: only SonarJS (core `complexity` removed — duplicated sonarjs/cyclomatic-complexity).
 * Cognitive: sonarjs/cognitive-complexity (primary “hard to change” signal).
 * Structural: max-depth / max-params / max-nested-callbacks (catch wide APIs / deep nesting).
 */
const sharedTsRules = Object.assign({}, tseslint.configs.recommended.rules, {
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-misused-promises": [
    "error",
    { checksVoidReturn: { attributes: true } },
  ],
  "@typescript-eslint/consistent-type-imports": [
    "error",
    { prefer: "type-imports", fixStyle: "separate-type-imports" },
  ],
  // Security
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-new-func": "error",
  "prefer-const": "error",
  "max-lines-per-function": ["error", { max: 280 }],
  "max-depth": ["error", { max: 6 }],
  "max-params": ["error", { max: 8 }],
  "max-nested-callbacks": ["error", { max: 4 }],
  // SonarJS
  "sonarjs/cyclomatic-complexity": ["error", { threshold: 20 }],
  "sonarjs/cognitive-complexity": ["error", 20],
  "sonarjs/no-duplicate-string": "error",
  "sonarjs/prefer-immediate-return": "error",
  "no-unreachable": "error",
});

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/codeql-db/**",
      "**/resources/**",
      ".claude/**",
      ".cursor/**",
      ".serena/**",
      ".trunk/**",
      "**/*.generated.ts",
      "packages/dbt-artifacts-parser/resources/**/*.json",
      "**/playwright-report/**",
      "**/test-results/**",
    ],
  },
  {
    files: ["packages/**/*.ts", "packages/**/*.tsx"],
    ignores: ["**/dist/**", "**/*.test.ts", "**/*.test.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ...tsProjectOptions,
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      sonarjs,
    },
    rules: sharedTsRules,
  },
  {
    files: ["packages/**/*.test.ts", "packages/**/*.test.tsx"],
    ignores: ["**/dist/**"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ...tsProjectOptions,
        ecmaFeatures: { jsx: true },
      },
      globals: vitestPlugin.environments.env.globals,
    },
    plugins: {
      "@typescript-eslint": tseslint,
      sonarjs,
      ...vitestPlugin.configs.recommended.plugins,
    },
    rules: {
      ...sharedTsRules,
      ...vitestPlugin.configs.recommended.rules,
      // Tests often repeat string literals and use conditional expects; keep signal without noise.
      "vitest/no-conditional-expect": "off",
      "sonarjs/no-duplicate-string": "off",
      "max-lines-per-function": ["error", { max: 700 }],
    },
  },
  {
    files: ["packages/dbt-tools/web/e2e/**/*.spec.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ...tsProjectOptions,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      sonarjs,
    },
    rules: {
      ...sharedTsRules,
      // Long Playwright flows: relax structural limits without silencing security/type rules
      "max-lines-per-function": ["error", { max: 400 }],
      "max-depth": ["error", { max: 10 }],
      "sonarjs/cognitive-complexity": ["error", 35],
      "sonarjs/cyclomatic-complexity": ["error", { threshold: 30 }],
      "max-nested-callbacks": ["error", { max: 8 }],
    },
  },
  {
    files: ["packages/dbt-tools/web/**/*.tsx"],
    ignores: ["**/dist/**", "**/*.test.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ...tsProjectOptions,
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    settings: {
      react: { version: "18.3" },
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactPlugin.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs.flat.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "react/prop-types": "off",
      "react-hooks/exhaustive-deps": "error",
      "max-lines": [
        "error",
        { max: 1200, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: ["**/*.js"],
    ignores: ["**/dist/**", "**/node_modules/**"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];
