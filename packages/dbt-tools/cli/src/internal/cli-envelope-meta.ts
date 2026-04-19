import * as fs from "node:fs";
import type {
  ArtifactPaths,
  CliJsonEnvelopeArtifactRef,
  CliJsonEnvelopeMetaV1,
} from "@dbt-tools/core";
import { CLI_PACKAGE_VERSION } from "./version";

export function resolveDbtTargetDisplayForEnvelope(
  flag?: string,
): string | undefined {
  const f = flag?.trim();
  if (f !== undefined && f !== "") {
    return f;
  }
  const env = process.env.DBT_TOOLS_DBT_TARGET?.trim();
  return env !== undefined && env !== "" ? env : undefined;
}

export function statArtifactRef(path: string): CliJsonEnvelopeArtifactRef {
  try {
    const st = fs.statSync(path);
    return {
      path,
      exists: true,
      modified_at: st.mtime.toISOString(),
      age_seconds: Math.floor((Date.now() - st.mtime.getTime()) / 1000),
    };
  } catch {
    return { path, exists: false };
  }
}

export function buildStdoutEnvelopeMeta(input: {
  command: string;
  cliVersion?: string;
  dbtTargetFlag?: string;
  paths?: ArtifactPaths;
}): CliJsonEnvelopeMetaV1 {
  const meta: CliJsonEnvelopeMetaV1 = {
    version: 1,
    cli_version: input.cliVersion ?? CLI_PACKAGE_VERSION,
    command: input.command,
    dbt_target: resolveDbtTargetDisplayForEnvelope(input.dbtTargetFlag),
  };

  if (input.paths !== undefined) {
    meta.artifacts = {
      manifest: statArtifactRef(input.paths.manifest),
      run_results: statArtifactRef(input.paths.runResults),
    };
    if (input.paths.catalog !== undefined) {
      meta.artifacts.catalog = statArtifactRef(input.paths.catalog);
    }
    if (input.paths.sources !== undefined) {
      meta.artifacts.sources = statArtifactRef(input.paths.sources);
    }
  }

  return meta;
}
