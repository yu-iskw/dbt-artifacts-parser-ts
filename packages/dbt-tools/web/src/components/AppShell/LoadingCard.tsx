import { LoadingStatePattern } from "@web/design-system/patterns/states";
import { Skeleton } from "../ui/Skeleton";

export function LoadingCard() {
  return (
    <LoadingStatePattern label="Loading workspace…">
      <Skeleton className="loading-card__skeleton-icon" />
      <div>
        <Skeleton className="loading-card__skeleton-title" />
        <Skeleton className="loading-card__skeleton-body" />
      </div>
    </LoadingStatePattern>
  );
}
