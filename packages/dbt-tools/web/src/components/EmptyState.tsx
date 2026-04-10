import type { ReactNode } from "react";
import { Card } from "@web/design-system/components";

interface EmptyStateProps {
  icon?: string | ReactNode;
  headline: string;
  subtext?: string;
}

export function EmptyState({ icon, headline, subtext }: EmptyStateProps) {
  return (
    <Card className="empty-state-block ds-empty-state">
      {icon !== undefined && (
        <span className="empty-state-block__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <strong className="empty-state-block__headline">{headline}</strong>
      {subtext && <p className="empty-state-block__subtext">{subtext}</p>}
    </Card>
  );
}
