import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import sonarjs from "eslint-plugin-sonarjs";
import vitest from "@vitest/eslint-plugin";

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
        ecmaVersion: 2017,
        sourceType: "module",
        project: [
          "./packages/dbt-artifacts-parser/tsconfig.json",
          "./packages/dbt-tools/core/tsconfig.json",
          "./packages/dbt-tools/cli/tsconfig.json",
          "./packages/dbt-tools/web/tsconfig.json",
          "./packages/dbt-tools/web/tsconfig.node.json",
          "./packages/dbt-tools/web/tsconfig.e2e.json",
        ],
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      sonarjs,
    },
    rules: Object.assign({}, tseslint.configs.recommended.rules, {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      // Security
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "prefer-const": "error",
      // Core ESLint complexity (error for AI agent feedback)
      complexity: ["error", { max: 20 }],
      "max-lines-per-function": ["error", { max: 280 }],
      // SonarJS (error for AI agent feedback)
      "sonarjs/cyclomatic-complexity": ["error", { threshold: 20 }],
      "sonarjs/cognitive-complexity": ["error", 20],
      "sonarjs/no-duplicate-string": "error",
      "sonarjs/prefer-immediate-return": "error",
      "no-unreachable": "error",
    }),
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
