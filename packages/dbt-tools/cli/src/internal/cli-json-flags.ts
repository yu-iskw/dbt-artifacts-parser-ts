import { shouldOutputJSON } from "@dbt-tools/core";

export function shouldOutputJsonForCli(
  json?: boolean,
  noJson?: boolean,
): boolean {
  return shouldOutputJSON(json, noJson);
}

/**
 * Opt-in `{ _meta, data }` JSON envelope: `--json-envelope` or `DBT_TOOLS_JSON_ENVELOPE=1|true|yes`.
 */
export function resolveJsonEnvelopeRequested(opts: {
  jsonEnvelope?: boolean;
}): boolean {
  if (opts.jsonEnvelope === true) {
    return true;
  }
  const env = process.env.DBT_TOOLS_JSON_ENVELOPE?.trim().toLowerCase();
  return env === "1" || env === "true" || env === "yes";
}
