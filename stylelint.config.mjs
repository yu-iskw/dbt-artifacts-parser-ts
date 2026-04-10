/** @type {import('stylelint').Config} */
export default {
  extends: ["stylelint-config-standard"],
  ignoreFiles: [
    "**/dist/**",
    "**/node_modules/**",
    "**/coverage/**",
    "**/playwright-report/**",
    "**/test-results/**",
  ],
  rules: {
    "selector-class-pattern": [
      "^([a-z0-9]+(?:-[a-z0-9]+)*)(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$",
      { resolveNestedSelectors: true },
    ],
    "no-descending-specificity": null,
    "declaration-no-important": true,
    "color-named": "never",
    "rule-empty-line-before": [
      "always-multi-line",
      { except: ["first-nested"], ignore: ["after-comment", "inside-block"] },
    ],
    "comment-empty-line-before": [
      "always",
      {
        except: ["first-nested"],
        ignore: ["after-comment", "stylelint-commands"],
      },
    ],
    "custom-property-empty-line-before": "never",
  },
  overrides: [
    {
      files: ["**/styles/tokens.css"],
      rules: {
        "color-named": null,
      },
    },
    {
      files: [
        "**/styles/app-shell.css",
        "**/styles/workspace.css",
        "**/styles/lineage-graph.css",
      ],
      rules: {
        "color-named": ["never", { severity: "warning" }],
        "declaration-no-important": [true, { severity: "warning" }],
      },
    },
  ],
};
