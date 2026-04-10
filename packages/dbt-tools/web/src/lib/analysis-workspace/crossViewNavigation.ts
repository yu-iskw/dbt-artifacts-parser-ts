import type { AssetTab } from "@web/lib/analysis-workspace/types";

export interface CrossViewContext {
  resourceId?: string | null;
  executionId?: string | null;
}

export interface CrossViewPivotAction {
  key: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}

export type CrossViewTargetView = "health" | "inventory" | "runs" | "timeline";

export type CrossViewNavigate = (
  view: CrossViewTargetView,
  options?: {
    resourceId?: string;
    executionId?: string;
    assetTab?: AssetTab;
    rootResourceId?: string;
  },
) => void;

export function buildCrossViewPivotActions({
  context,
  onNavigateTo,
  includeInventoryTab = "summary",
  includeHealth = true,
}: {
  context: CrossViewContext;
  onNavigateTo: CrossViewNavigate;
  includeInventoryTab?: AssetTab;
  includeHealth?: boolean;
}): CrossViewPivotAction[] {
  const resourceId = context.resourceId ?? null;
  const executionId = context.executionId ?? null;

  const actions: CrossViewPivotAction[] = [
    {
      key: "inventory",
      label: "Inventory",
      disabled: !resourceId,
      onClick: () => {
        if (!resourceId) return;
        onNavigateTo("inventory", {
          resourceId,
          assetTab: includeInventoryTab,
          rootResourceId: resourceId,
        });
      },
    },
    {
      key: "timeline",
      label: "Timeline",
      disabled: !resourceId && !executionId,
      onClick: () => {
        if (!resourceId && !executionId) return;
        onNavigateTo("timeline", {
          ...(resourceId ? { resourceId } : {}),
          ...(executionId ? { executionId } : {}),
        });
      },
    },
    {
      key: "runs",
      label: "Run",
      disabled: !executionId,
      onClick: () => {
        if (!executionId) return;
        onNavigateTo("runs", {
          executionId,
          ...(resourceId ? { resourceId } : {}),
        });
      },
    },
  ];

  if (includeHealth) {
    actions.push({
      key: "health",
      label: "Health",
      onClick: () => onNavigateTo("health"),
    });
  }

  return actions;
}
