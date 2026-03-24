import type { ReactNode } from "react";

interface TooltipProps {
  /**
   * Text shown in the tooltip popup. Keep it concise — long content is
   * truncated with max-width. For full multi-line content use `data-tooltip`
   * directly on an element with the `.tooltip-host` class.
   */
  content: string;
  children: ReactNode;
}

/**
 * Wraps children in a tooltip trigger. The popup appears above on hover/focus.
 * Implemented with CSS `::after` pseudo-elements — no JS state.
 *
 * @example
 * <Tooltip content={resource.uniqueId}>
 *   <span className="truncated-text">{shortName}</span>
 * </Tooltip>
 */
export function Tooltip({ content, children }: TooltipProps) {
  return (
    <span className="tooltip-host" data-tooltip={content}>
      {children}
    </span>
  );
}
