import type { ReactNode } from "react";

interface EmptyStateProps {
  /** An emoji or small icon element shown above the headline. */
  icon?: string | ReactNode;
  /** The primary message -- short, specific, and actionable. */
  headline: string;
  /** Optional supporting text with more context. */
  subtext?: string;
  /** Optional action element (button, link) rendered below the subtext. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  headline,
  subtext,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={["empty-state-block", className].filter(Boolean).join(" ")}>
      {icon !== undefined && (
        <span className="empty-state-block__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <strong className="empty-state-block__headline">{headline}</strong>
      {subtext && <p className="empty-state-block__subtext">{subtext}</p>}
      {action && <div className="empty-state-block__action">{action}</div>}
    </div>
  );
}
