import type { ReactNode } from "react";

export function OverviewPanel({
  title,
  subtitle,
  children,
  accent = "muted",
  headerRight,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  accent?: "muted" | "analysis" | "structure";
  headerRight?: ReactNode;
}) {
  return (
    <section className={`overview-panel overview-panel--${accent}`}>
      <div className="overview-panel__header">
        <div>
          <p className="eyebrow">{title}</p>
          {subtitle && <p className="overview-panel__subtitle">{subtitle}</p>}
        </div>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

export function OverviewScopeBadge({ label }: { label: string }) {
  return <span className="overview-scope-badge">{label}</span>;
}
