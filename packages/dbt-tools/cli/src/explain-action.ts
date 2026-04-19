import { shouldOutputJSON } from "@dbt-tools/core";
import type { ArtifactRootCliOptions } from "./cli-artifact-resolve";
import {
  buildIntentContext,
  buildWebUrl,
  emitIntentOutput,
  resolveTargetMatch,
} from "./intent-utils";

export interface ExplainOptions extends ArtifactRootCliOptions {
  fields?: string;
  json?: boolean;
  noJson?: boolean;
}

export interface ExplainOutput {
  intent: "explain";
  schema_version: "1.0";
  stability: "evolving";
  target: {
    input: string;
    resolved_unique_id: string;
  };
  summary: {
    resource_type: string;
    description: string;
    tags: string[];
    owners: string[];
    materialization: string | null;
  };
  why_it_matched: string[];
  provenance: {
    steps: Array<{ op: string; status: "ok" }>;
  };
  next_actions: string[];
  review_url: string;
}

function formatExplainHuman(output: ExplainOutput): string {
  return [
    `Explain ${output.target.resolved_unique_id}`,
    "================================",
    `Type: ${output.summary.resource_type}`,
    `Description: ${output.summary.description || "—"}`,
    `Tags: ${output.summary.tags.join(", ") || "—"}`,
    `Materialization: ${output.summary.materialization ?? "—"}`,
    `Matched because: ${output.why_it_matched.join(", ") || "n/a"}`,
    `Next actions: ${output.next_actions.join(", ")}`,
    `Review URL: ${output.review_url}`,
  ].join("\n");
}

export async function explainAction(
  resource: string,
  options: ExplainOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    const { graph } = await buildIntentContext(options);
    const resolved = resolveTargetMatch(resource, graph);
    const attrs = graph.getGraph().getNodeAttributes(resolved.unique_id);

    const output: ExplainOutput = {
      intent: "explain",
      schema_version: "1.0",
      stability: "evolving",
      target: {
        input: resource,
        resolved_unique_id: resolved.unique_id,
      },
      summary: {
        resource_type: attrs.resource_type,
        description:
          typeof attrs.description === "string" ? attrs.description : "",
        tags: Array.isArray(attrs.tags)
          ? attrs.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
        owners: [],
        materialization:
          typeof attrs.materialized === "string" ? attrs.materialized : null,
      },
      why_it_matched: resolved.reasons,
      provenance: {
        steps: [
          { op: "discover.resolve", status: "ok" },
          { op: "summary.fetch", status: "ok" },
          { op: "deps.fetch", status: "ok" },
        ],
      },
      next_actions: ["impact", "diagnose node"],
      review_url: buildWebUrl("/inventory", {
        view: "inventory",
        resource: resolved.unique_id,
        assetTab: "summary",
      }),
    };

    emitIntentOutput(output, options, (value) =>
      formatExplainHuman(value as ExplainOutput),
    );
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}

