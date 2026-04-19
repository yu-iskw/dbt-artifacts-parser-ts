import type { ArtifactPaths } from "@dbt-tools/core";
import { formatCliStdoutJson } from "@dbt-tools/core";
import { buildStdoutEnvelopeMeta } from "./cli-envelope-meta";
import {
  resolveJsonEnvelopeRequested,
  shouldOutputJsonForCli,
} from "./cli-json-flags";
import { CLI_PACKAGE_VERSION } from "./version";

export type CliJsonStdoutOpts = {
  payload: unknown;
  json?: boolean;
  noJson?: boolean;
  jsonEnvelope?: boolean;
  /** Logical CLI command path for `_meta.command`. */
  command: string;
  dbtTarget?: string;
  paths?: ArtifactPaths;
};

export type CliJsonEmitOptions = Pick<
  CliJsonStdoutOpts,
  "json" | "noJson" | "jsonEnvelope" | "dbtTarget"
>;

/**
 * Shorthand for the common `stringifyCliJsonStdout` call: same json flags, a
 * command name, and resolved artifact paths.
 */
export function stringifyCliJsonForAction(
  command: string,
  paths: ArtifactPaths | undefined,
  opts: CliJsonEmitOptions,
  payload: unknown,
): string {
  return stringifyCliJsonStdout({
    payload,
    json: opts.json,
    noJson: opts.noJson,
    jsonEnvelope: opts.jsonEnvelope,
    command,
    dbtTarget: opts.dbtTarget,
    paths,
  });
}

/**
 * Single JSON stdout line with optional `{ _meta, data }` envelope for agents.
 * Skip envelope for `schema` introspection so stdout stays a plain command schema object.
 */
export function stringifyCliJsonStdout(opts: CliJsonStdoutOpts): string {
  const useJson = shouldOutputJsonForCli(opts.json, opts.noJson);
  const allowEnvelope =
    opts.command !== "schema" && useJson && resolveJsonEnvelopeRequested(opts);
  const envelopeMeta = allowEnvelope
    ? buildStdoutEnvelopeMeta({
        command: opts.command,
        cliVersion: CLI_PACKAGE_VERSION,
        dbtTargetFlag: opts.dbtTarget,
        paths: opts.paths,
      })
    : undefined;

  return formatCliStdoutJson({
    payload: opts.payload,
    forceJson: opts.json,
    forceNoJson: opts.noJson,
    envelopeMeta,
  });
}
