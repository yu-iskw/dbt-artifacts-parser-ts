import type { ReactNode } from "react";
import "./Badge.css";

type BadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

interface BadgeProps {
  tone?: BadgeTone;
  /** Show a small dot indicator before the label. */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={["ui-badge", `ui-badge--${tone}`, className]
        .filter(Boolean)
        .join(" ")}
    >
      {dot && <span className="ui-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
