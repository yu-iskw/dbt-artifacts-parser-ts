/**
 * Optional `{ _meta, data }` wrapper for CLI JSON stdout (agents, reproducible logs).
 */

export type CliJsonEnvelopeArtifactRef = {
  path: string;
  exists?: boolean;
  modified_at?: string;
  age_seconds?: number;
};

export type CliJsonEnvelopeMetaV1 = {
  version: 1;
  cli_version: string;
  /** Logical CLI command path, e.g. `deps`, `diagnose run`. */
  command: string;
  /** Effective `--dbt-target` when resolvable (flag or DBT_TOOLS_DBT_TARGET). */
  dbt_target?: string;
  artifacts?: {
    manifest?: CliJsonEnvelopeArtifactRef;
    run_results?: CliJsonEnvelopeArtifactRef;
    catalog?: CliJsonEnvelopeArtifactRef;
    sources?: CliJsonEnvelopeArtifactRef;
  };
};

export type CliJsonEnvelopedStdout<T = unknown> = {
  _meta: CliJsonEnvelopeMetaV1;
  data: T;
};

export function envelopCliJsonStdout<T>(
  payload: T,
  meta: CliJsonEnvelopeMetaV1,
): CliJsonEnvelopedStdout<T> {
  return { _meta: meta, data: payload };
}
