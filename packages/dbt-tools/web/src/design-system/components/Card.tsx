import type { HTMLAttributes, ReactNode } from "react";

export type DsCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

/**
 * Surface card — semantic background, border, and elevation tokens.
 */
export function DsCard({ children, className = "", ...rest }: DsCardProps) {
  return (
    <div className={["ds-card", className].filter(Boolean).join(" ")} {...rest}>
      <div className="ds-card__body">{children}</div>
    </div>
  );
}
