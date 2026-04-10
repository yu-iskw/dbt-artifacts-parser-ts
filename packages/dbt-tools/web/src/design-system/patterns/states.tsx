import type { PropsWithChildren } from "react";
import { Card } from "../components";

interface EmptyStatePatternProps {
  title: string;
  description: string;
}

export function EmptyStatePattern({
  title,
  description,
}: EmptyStatePatternProps) {
  return (
    <Card className="ds-empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </Card>
  );
}

interface LoadingStatePatternProps {
  label: string;
}

export function LoadingStatePattern({
  label,
  children,
}: PropsWithChildren<LoadingStatePatternProps>) {
  return <Card className="ds-loading-state">{children ?? label}</Card>;
}
