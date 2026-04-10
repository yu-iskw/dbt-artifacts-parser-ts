import type {
  AssetTab,
  WorkspaceView,
} from "@web/lib/analysis-workspace/types";

export interface NavigationTarget {
  view: WorkspaceView;
  options?: {
    resourceId?: string;
    executionId?: string;
    assetTab?: AssetTab;
    rootResourceId?: string;
  };
}

export interface CrossViewNavigationContext {
  resourceId?: string | null;
  executionId?: string | null;
}

export interface CrossViewNavigationTargets {
  inventory: NavigationTarget | null;
  lineage: NavigationTarget | null;
  runs: NavigationTarget | null;
  timeline: NavigationTarget | null;
  health: NavigationTarget;
}

export function buildCrossViewNavigationTargets(
  context: CrossViewNavigationContext,
): CrossViewNavigationTargets {
  const resourceId = context.resourceId ?? null;
  const executionId = context.executionId ?? null;
  const timelineExecutionId = executionId ?? resourceId;
  return {
    inventory: resourceId
      ? {
          view: "inventory",
          options: {
            resourceId,
            assetTab: "summary",
          },
        }
      : null,
    lineage: resourceId
      ? {
          view: "inventory",
          options: {
            resourceId,
            assetTab: "lineage",
            rootResourceId: resourceId,
          },
        }
      : null,
    runs: executionId
      ? {
          view: "runs",
          options: {
            executionId,
            resourceId: resourceId ?? executionId,
          },
        }
      : null,
    timeline: timelineExecutionId
      ? {
          view: "timeline",
          options: {
            executionId: timelineExecutionId,
            resourceId: resourceId ?? timelineExecutionId,
          },
        }
      : null,
    health: {
      view: "health",
      options:
        resourceId || executionId
          ? {
              resourceId: resourceId ?? undefined,
              executionId: executionId ?? undefined,
            }
          : undefined,
    },
  };
}
