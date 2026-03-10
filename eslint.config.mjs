import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

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
    },
    rules: Object.assign({}, tseslint.configs.recommended.rules, {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
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
