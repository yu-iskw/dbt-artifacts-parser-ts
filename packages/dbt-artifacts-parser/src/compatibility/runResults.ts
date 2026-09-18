import type {
  RunResultOutput,
  RunResultsArtifact,
} from "../run_results/v6";

/**
 * Producer-compatibility overlay for run-results/v6 rows emitted by dbt v2.
 *
 * Keep the generated v6 type canonical to schemas.getdbt.com and layer
 * producer-only fields here.
 */
export type DbtV2CompatibleRunResultOutput = RunResultOutput & {
  static_analysis_off_reason?: string | null;
};

export type DbtV2CompatibleRunResultsV6 = Omit<
  RunResultsArtifact,
  "results"
> & {
  results: DbtV2CompatibleRunResultOutput[];
};
