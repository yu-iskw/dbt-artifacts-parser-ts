import { shouldOutputJSON } from "@dbt-tools/core";
import type { ArtifactRootCliOptions } from "./cli-artifact-resolve";
import {
  buildIntentContext,
  buildWebUrl,
  emitIntentOutput,
  resolveTargetMatch,
} from "./intent-utils";

export interface ImpactOptions extends ArtifactRootCliOptions {
  fields?: string;
  json?: boolean;
  noJson?: boolean;
}

export interface ImpactOutput {
  intent: "impact";
  schema_version: "1.0";
  stability: "evolving";
  target: {
    input: string;
    resolved_unique_id: string;
  };
  impact: {
    upstream_count: number;
    downstream_count: number;
    critical_dependents: string[];
  };
  why_it_matters: string[];
  provenance: {
    steps: Array<{ op: string; status: "ok" }>;
  };
  next_actions: string[];
  review_url: string;
}

function formatImpactHuman(output: ImpactOutput): string {
  return [
    `Impact ${output.target.resolved_unique_id}`,
    "===============================",
    `Upstream: ${output.impact.upstream_count}`,
    `Downstream: ${output.impact.downstream_count}`,
    `Critical dependents: ${output.impact.critical_dependents.join(", ") || "—"}`,
    `Why it matters: ${output.why_it_matters.join("; ") || "n/a"}`,
    `Next actions: ${output.next_actions.join(", ")}`,
    `Review URL: ${output.review_url}`,
  ].join("\n");
}

export async function impactAction(
  resource: string,
  options: ImpactOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    const { graph } = await buildIntentContext(options);
    const resolved = resolveTargetMatch(resource, graph);
    const upstream = graph.getUpstream(resolved.unique_id);
    const downstream = graph.getDownstream(resolved.unique_id);
    const graphologyGraph = graph.getGraph();

    const criticalDependents = downstream
      .map((entry) => ({
        uniqueId: entry.nodeId,
        fanout: graphologyGraph.outDegree(entry.nodeId),
      }))
      .sort((a, b) => b.fanout - a.fanout)
      .slice(0, 3)
      .map((entry) => entry.uniqueId);

    const whyItMatters: string[] = [];
    if (downstream.length >= 10) {
      whyItMatters.push("high downstream fanout");
    }
    if (criticalDependents.length > 0) {
      const firstDependent = criticalDependents[0];
      const dependentSegments = firstDependent?.split(".") ?? [];
      whyItMatters.push(
        `referenced by critical model ${dependentSegments[dependentSegments.length - 1] ?? firstDependent}`,
      );
    }

    const output: ImpactOutput = {
      intent: "impact",
      schema_version: "1.0",
      stability: "evolving",
      target: {
        input: resource,
        resolved_unique_id: resolved.unique_id,
      },
      impact: {
        upstream_count: upstream.length,
        downstream_count: downstream.length,
        critical_dependents: criticalDependents,
      },
      why_it_matters: whyItMatters,
      provenance: {
        steps: [
          { op: "discover.resolve", status: "ok" },
          { op: "deps.upstream", status: "ok" },
          { op: "deps.downstream", status: "ok" },
        ],
      },
      next_actions: ["explain", "diagnose node"],
      review_url: buildWebUrl("/inventory", {
        view: "inventory",
        resource: resolved.unique_id,
        assetTab: "lineage",
        selected: resolved.unique_id,
      }),
    };

    emitIntentOutput(output, options, (value) =>
      formatImpactHuman(value as ImpactOutput),
    );
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
