import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import sonarjs from "eslint-plugin-sonarjs";
import forAi from "eslint-for-ai";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/resources/**",
      ".claude/**",
      ".cursor/**",
      ".serena/**",
      ".trunk/**",
      "**/*.generated.ts",
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
        ],
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      sonarjs,
      "for-ai": forAi,
    },
    rules: Object.assign({}, tseslint.configs.recommended.rules, {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      // Core ESLint complexity
      complexity: ["warn", { max: 15 }],
      "max-lines-per-function": ["warn", { max: 50 }],
      // SonarJS
      "sonarjs/cyclomatic-complexity": ["warn", { threshold: 10 }],
      "sonarjs/cognitive-complexity": ["warn", 15],
      "sonarjs/no-duplicate-string": "warn",
      "sonarjs/prefer-immediate-return": "warn",
      // eslint-for-ai (plugin only, no full recommended config)
      "for-ai/no-standalone-class": "warn",
      "for-ai/no-bare-wrapper": "warn",
      "for-ai/no-code-after-try-catch": "warn",
      "for-ai/no-constant-assertion": "warn",
      "for-ai/no-interface": "off",
      "for-ai/no-mock-only-test": "off",
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
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
