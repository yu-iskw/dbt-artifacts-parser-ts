import {
  discoverResources,
  shouldOutputJSON,
  type DiscoveryResult,
} from "@dbt-tools/core";
import type { ArtifactRootCliOptions } from "./cli-artifact-resolve";
import {
  buildIntentContext,
  buildWebUrl,
  emitIntentOutput,
} from "./intent-utils";

export interface DiscoverOptions extends ArtifactRootCliOptions {
  fields?: string;
  json?: boolean;
  noJson?: boolean;
  type?: string;
  limit?: number;
}

export interface DiscoverOutput extends DiscoveryResult {
  intent: "discover";
  schema_version: "1.0";
  stability: "core";
  review_url: string;
}

function formatDiscoverHuman(output: DiscoverOutput): string {
  const lines = [
    `Discover "${output.query}"`,
    "=".repeat(Math.max(12, output.query.length + 11)),
    `${output.matches.length} match${output.matches.length === 1 ? "" : "es"}`,
  ];
  for (const match of output.matches) {
    lines.push(
      `- ${match.unique_id} (${match.resource_type}) score=${match.score.toFixed(2)} confidence=${match.confidence}`,
    );
    lines.push(`  reasons: ${match.reasons.join(", ")}`);
    if (match.disambiguation.length > 0) {
      lines.push(`  also consider: ${match.disambiguation.join(", ")}`);
    }
  }
  lines.push(`Review URL: ${output.review_url}`);
  return lines.join("\n");
}

export async function discoverAction(
  query: string,
  options: DiscoverOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    const { graph } = await buildIntentContext(options);
    const types = options.type
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const discovered = discoverResources(graph, query, {
      limit: options.limit ?? 10,
      resourceTypes: types as DiscoverOutput["matches"][number]["resource_type"][],
    });

    const output: DiscoverOutput = {
      intent: "discover",
      schema_version: "1.0",
      stability: "core",
      ...discovered,
      review_url: buildWebUrl("/inventory", {
        view: "inventory",
        q: query,
      }),
    };

    emitIntentOutput(output, options, (value) =>
      formatDiscoverHuman(value as DiscoverOutput),
    );
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}

