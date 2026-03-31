import type {
  LineageDisplayMode,
  LineageGraphNodeLayout,
} from "@web/lib/analysis-workspace/lineageModel";
import {
  getLensNodeFill,
  supportsTests,
} from "@web/lib/analysis-workspace/lineageModel";
import type { LensMode } from "@web/lib/analysis-workspace/types";
import { ResourceTypeIcon, formatResourceTypeLabel } from "../shared";
import { estimateBadgeWidth } from "./lineageOverlayConstants";

/** SVG edges + node shapes (no HTML hotspot layer). */
export function LineageGraphSvgBody({
  visibleEdges,
  visibleNodeLayouts,
  getEffectivePos,
  nodeWidth,
  nodeHeight,
  nodeRadius,
  displayMode,
  lensMode,
  highlightedIds,
  hasHoverFocus,
}: {
  visibleEdges: Array<{ from: string; to: string }>;
  visibleNodeLayouts: Map<string, LineageGraphNodeLayout>;
  getEffectivePos: (
    nodeId: string,
    baseX: number,
    baseY: number,
  ) => { x: number; y: number };
  nodeWidth: number;
  nodeHeight: number;
  nodeRadius: number;
  displayMode: LineageDisplayMode;
  lensMode: LensMode;
  highlightedIds: Set<string>;
  hasHoverFocus: boolean;
}) {
  return (
    <>
      {visibleEdges.map((edge) => {
        const from = visibleNodeLayouts.get(edge.from);
        const to = visibleNodeLayouts.get(edge.to);
        if (!from || !to) return null;
        const fp = getEffectivePos(edge.from, from.x, from.y);
        const tp = getEffectivePos(edge.to, to.x, to.y);
        const startX = fp.x + nodeWidth;
        const startY = fp.y + nodeHeight / 2;
        const endX = tp.x;
        const endY = tp.y + nodeHeight / 2;
        const curve = Math.max(28, Math.abs(endX - startX) * 0.34);
        return (
          <path
            key={`${edge.from}->${edge.to}`}
            d={`M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`}
            className={`dependency-graph__edge${!hasHoverFocus || highlightedIds.has(edge.from) || highlightedIds.has(edge.to) ? "" : " dependency-graph__edge--dimmed"}`}
          />
        );
      })}
      {Array.from(visibleNodeLayouts.values()).map((node) => {
        const isHighlighted =
          !hasHoverFocus || highlightedIds.has(node.resource.uniqueId);
        const { x, y } = getEffectivePos(
          node.resource.uniqueId,
          node.x,
          node.y,
        );
        const passLabel = String(node.passCount);
        const failLabel = String(node.failCount);
        const passBadgeWidth = estimateBadgeWidth(passLabel);
        const failBadgeWidth = estimateBadgeWidth(failLabel);
        const badgeGap = 6;
        const badgeY =
          displayMode === "summary" ? y + nodeHeight - 20 : y + nodeHeight - 23;
        const badgeHeight = displayMode === "summary" ? 15 : 17;
        const badgeRadius = badgeHeight / 2;
        const runTone = node.resource.statusTone ?? "neutral";
        const toneOutlineClass = ` dependency-graph__node--tone-${runTone}`;
        return (
          <g key={node.resource.uniqueId}>
            <rect
              x={x}
              y={y}
              width={nodeWidth}
              height={nodeHeight}
              rx={nodeRadius}
              className={`dependency-graph__node${node.side === "selected" ? " dependency-graph__node--selected" : ""}${isHighlighted ? "" : " dependency-graph__node--dimmed"}${toneOutlineClass}`}
              {...(node.side === "selected"
                ? {
                    stroke: "var(--graph-node-selected-stroke)",
                    strokeWidth: 3,
                  }
                : {})}
              style={{
                fill: getLensNodeFill(node.resource, lensMode),
              }}
            />
            <foreignObject
              x={x + 16}
              y={displayMode === "summary" ? y + 10 : y + 14}
              width={nodeWidth - 32}
              height={24}
            >
              <div
                className="dependency-graph__node-title-row"
                title={`${node.resource.name} (${formatResourceTypeLabel(node.resource.resourceType)})`}
              >
                <span
                  className="dependency-graph__node-title-icon"
                  title={formatResourceTypeLabel(node.resource.resourceType)}
                >
                  <ResourceTypeIcon resourceType={node.resource.resourceType} />
                </span>
                <span className="dependency-graph__node-title-text">
                  {node.resource.name}
                </span>
              </div>
            </foreignObject>
            {supportsTests(node.resource.resourceType) && (
              <>
                <rect
                  x={x + 16}
                  y={badgeY}
                  width={passBadgeWidth}
                  height={badgeHeight}
                  rx={badgeRadius}
                  className="dependency-graph__node-stat-pill dependency-graph__node-stat-pill--pass"
                />
                <text
                  x={x + 16 + passBadgeWidth / 2}
                  y={badgeY + badgeHeight / 2}
                  className="dependency-graph__node-stat dependency-graph__node-stat--pass"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {passLabel}
                </text>
                <rect
                  x={x + 16 + passBadgeWidth + badgeGap}
                  y={badgeY}
                  width={failBadgeWidth}
                  height={badgeHeight}
                  rx={badgeRadius}
                  className={`dependency-graph__node-stat-pill ${
                    node.failCount === 0
                      ? "dependency-graph__node-stat-pill--neutral"
                      : "dependency-graph__node-stat-pill--fail"
                  }`}
                />
                <text
                  x={x + 16 + passBadgeWidth + badgeGap + failBadgeWidth / 2}
                  y={badgeY + badgeHeight / 2}
                  className={`dependency-graph__node-stat ${
                    node.failCount === 0
                      ? "dependency-graph__node-stat--neutral"
                      : "dependency-graph__node-stat--fail"
                  }`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {failLabel}
                </text>
              </>
            )}
          </g>
        );
      })}
    </>
  );
}
