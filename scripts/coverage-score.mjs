#!/usr/bin/env node
/**
 * Coverage harness for AI agent feedback.
 * Runs Vitest with coverage, produces coverage-report.json with score and threshold status.
 * Score: floor of average of lines, branches, functions, statements percentages.
 * Exits 1 if any metric is below its threshold.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const THRESHOLDS = {
  lines: 60,
  branches: 50,
  functions: 60,
  statements: 60,
};

function run() {
  // 1. Run vitest with coverage
  const r = spawnSync("pnpm", ["exec", "vitest", "run", "--coverage"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: "inherit",
  });

  if (r.status !== 0) {
    console.error("Vitest coverage run failed.");
    process.exit(r.status ?? 1);
  }

  // 2. Read coverage summary (Istanbul json-summary format)
  const summaryPath = join(projectRoot, "coverage", "coverage-summary.json");
  if (!existsSync(summaryPath)) {
    console.error(
      "coverage/coverage-summary.json not found. Ensure json-summary reporter is enabled.",
    );
    process.exit(1);
  }

  const summary = JSON.parse(readFileSync(summaryPath, "utf-8"));
  const total = summary.total;
  if (!total) {
    console.error("No total in coverage-summary.json");
    process.exit(1);
  }

  const linesPct = total.lines?.pct ?? 0;
  const branchesPct = total.branches?.pct ?? 0;
  const functionsPct = total.functions?.pct ?? 0;
  const statementsPct = total.statements?.pct ?? 0;

  const metrics = {
    lines: { pct: linesPct, threshold: THRESHOLDS.lines },
    branches: { pct: branchesPct, threshold: THRESHOLDS.branches },
    functions: { pct: functionsPct, threshold: THRESHOLDS.functions },
    statements: { pct: statementsPct, threshold: THRESHOLDS.statements },
  };

  const belowThreshold =
    linesPct < THRESHOLDS.lines ||
    branchesPct < THRESHOLDS.branches ||
    functionsPct < THRESHOLDS.functions ||
    statementsPct < THRESHOLDS.statements;

  const avg = (linesPct + branchesPct + functionsPct + statementsPct) / 4;
  const score = Math.min(100, Math.floor(avg));

  const violations = [];
  if (linesPct < THRESHOLDS.lines) {
    violations.push({
      metric: "lines",
      pct: linesPct,
      threshold: THRESHOLDS.lines,
    });
  }
  if (branchesPct < THRESHOLDS.branches) {
    violations.push({
      metric: "branches",
      pct: branchesPct,
      threshold: THRESHOLDS.branches,
    });
  }
  if (functionsPct < THRESHOLDS.functions) {
    violations.push({
      metric: "functions",
      pct: functionsPct,
      threshold: THRESHOLDS.functions,
    });
  }
  if (statementsPct < THRESHOLDS.statements) {
    violations.push({
      metric: "statements",
      pct: statementsPct,
      threshold: THRESHOLDS.statements,
    });
  }

  const report = {
    score,
    belowThreshold,
    lines: metrics.lines,
    branches: metrics.branches,
    functions: metrics.functions,
    statements: metrics.statements,
    violations,
  };

  const reportPath = join(projectRoot, "coverage-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

  console.log(
    `Coverage report written to coverage-report.json: score=${score}, belowThreshold=${belowThreshold}, violations=${violations.length}`,
  );

  process.exit(belowThreshold ? 1 : 0);
}

run();
