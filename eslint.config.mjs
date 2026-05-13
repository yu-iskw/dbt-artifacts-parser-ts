import eslintCommentsPlugin from "@eslint-community/eslint-plugin-eslint-comments";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import vitestPlugin from "@vitest/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import sonarjs from "eslint-plugin-sonarjs";

/** @type {import("@typescript-eslint/parser").ParserOptions} */
const tsProjectOptions = {
  ecmaVersion: 2022,
  sourceType: "module",
  project: ["./packages/dbt-artifacts-parser/tsconfig.eslint.json"],
};

const importResolverSettings = {
  "import/resolver": {
    typescript: {
      project: tsProjectOptions.project,
      alwaysTryTypes: true,
    },
    node: true,
  },
};

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
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-new-func": "error",
  "prefer-const": "error",
  "max-lines-per-function": ["error", { max: 280 }],
  "max-depth": ["error", { max: 6 }],
  "max-params": ["error", { max: 8 }],
  "max-nested-callbacks": ["error", { max: 4 }],
  "sonarjs/cyclomatic-complexity": ["error", { threshold: 15 }],
  "sonarjs/cognitive-complexity": ["error", 15],
  "sonarjs/no-duplicate-string": "error",
  "sonarjs/prefer-immediate-return": "error",
  "no-unreachable": "error",
});

const sharedImportRules = {
  "import/no-cycle": "error",
  "import/no-unresolved": "error",
  "import/no-useless-path-segments": "error",
};

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
    ],
    plugins: {
      "eslint-comments": eslintCommentsPlugin,
    },
    rules: {
      "eslint-comments/no-unused-disable": "error",
      "eslint-comments/disable-enable-pair": "error",
    },
  },
  {
    files: ["packages/**/*.ts"],
    ignores: ["**/dist/**", "**/*.test.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: tsProjectOptions,
    },
    plugins: {
      "@typescript-eslint": tseslint,
      sonarjs,
      import: importPlugin,
    },
    settings: importResolverSettings,
    rules: {
      ...sharedTsRules,
      ...sharedImportRules,
      "@typescript-eslint/no-unused-private-class-members": "error",
    },
  },
  {
    files: ["packages/**/*.test.ts"],
    ignores: ["**/dist/**"],
    languageOptions: {
      parser: tsparser,
      parserOptions: tsProjectOptions,
      globals: vitestPlugin.environments.env.globals,
    },
    plugins: {
      "@typescript-eslint": tseslint,
      sonarjs,
      import: importPlugin,
      ...vitestPlugin.configs.recommended.plugins,
    },
    settings: importResolverSettings,
    rules: {
      ...sharedTsRules,
      ...sharedImportRules,
      ...vitestPlugin.configs.recommended.rules,
      "vitest/no-conditional-expect": "off",
      "sonarjs/no-duplicate-string": "off",
      "max-lines-per-function": ["error", { max: 700 }],
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
