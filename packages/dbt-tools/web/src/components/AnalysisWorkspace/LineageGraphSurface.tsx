import {
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { EmptyState } from "../EmptyState";
import type { AnalysisState, ResourceNode } from "@web/types";
import { PILL_ACTIVE, PILL_BASE } from "@web/lib/analysis-workspace/constants";
import {
  type LineageGraphModel,
  type LineageDisplayMode,
  type LensLegendItem,
  buildLineageGraphModel,
  clampDepth,
  collectHighlightedGraphIds,
  getLensNodeFill,
  getLensLegendItems,
} from "@web/lib/analysis-workspace/lineageModel";
import type { LensMode } from "@web/lib/analysis-workspace/types";
import { SectionCard, formatResourceTypeLabel } from "./shared";
import { formatSeconds } from "@web/lib/analysis-workspace/utils";

const OVERLAY_VIEWPORT_MARGIN = 12;
const OVERLAY_CURSOR_OFFSET = 6;
const TOOLTIP_OVERLAY_SIZE = { width: 280, height: 180 };
const CONTEXT_MENU_OVERLAY_SIZE = { width: 220, height: 120 };

function estimateBadgeWidth(label: string): number {
  return 16 + label.length * 6.2;
}

function positionOverlay({
  anchorX,
  anchorY,
  width,
  height,
  offset = OVERLAY_CURSOR_OFFSET,
  margin = OVERLAY_VIEWPORT_MARGIN,
}: {
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
  offset?: number;
  margin?: number;
}) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let x = anchorX + offset;
  let y = anchorY + offset;

  if (x + width + margin > viewportWidth) {
    x = anchorX - width - offset;
  }
  if (y + height + margin > viewportHeight) {
    y = anchorY - height - offset;
  }

  x = Math.min(
    Math.max(margin, x),
    Math.max(margin, viewportWidth - width - margin),
  );
  y = Math.min(
    Math.max(margin, y),
    Math.max(margin, viewportHeight - height - margin),
  );

  return { x, y };
}

function positionOverlayAgainstRect({
  anchorRect,
  width,
  height,
  offset = OVERLAY_CURSOR_OFFSET,
  margin = OVERLAY_VIEWPORT_MARGIN,
}: {
  anchorRect: DOMRect;
  width: number;
  height: number;
  offset?: number;
  margin?: number;
}) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const spaceRight = viewportWidth - anchorRect.right - margin;
  const spaceLeft = anchorRect.left - margin;

  let x =
    spaceRight >= width + offset || spaceRight >= spaceLeft
      ? anchorRect.right + offset
      : anchorRect.left - width - offset;
  let y = anchorRect.top + anchorRect.height / 2 - height / 2;

  x = Math.min(
    Math.max(margin, x),
    Math.max(margin, viewportWidth - width - margin),
  );
  y = Math.min(
    Math.max(margin, y),
    Math.max(margin, viewportHeight - height - margin),
  );

  return { x, y };
}

export function DepthStepper({
  label,
  value,
  setValue,
  disabled = false,
}: {
  label: string;
  value: number;
  setValue: Dispatch<SetStateAction<number>>;
  disabled?: boolean;
}) {
  return (
    <div
      className={`lineage-stepper${disabled ? " lineage-stepper--disabled" : ""}`}
    >
      <span className="lineage-stepper__label">{label}</span>
      <div className="lineage-stepper__controls">
        <button
          type="button"
          className="lineage-stepper__button"
          disabled={disabled || value <= 1}
          onClick={() => setValue((current) => clampDepth(current - 1))}
        >
          −
        </button>
        <span className="lineage-stepper__value">{value}</span>
        <button
          type="button"
          className="lineage-stepper__button"
          disabled={disabled || value >= 3}
          onClick={() => setValue((current) => clampDepth(current + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}

// eslint-disable-next-line max-lines-per-function -- single SVG lineage surface
export function LineageGraphSurface({
  model,
  onSelectResource,
  lensMode = "type",
  fullscreen = false,
  displayMode = "focused",
}: {
  model: LineageGraphModel;
  onSelectResource: (id: string) => void;
  lensMode?: LensMode;
  fullscreen?: boolean;
  displayMode?: LineageDisplayMode;
}) {
  const {
    graphEdges,
    nodeLayouts,
    svgHeight,
    svgWidth,
    hasRelatedNodes,
    nodeWidth,
    nodeHeight,
    nodeRadius,
  } = model;
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [nodeOffsets, setNodeOffsets] = useState<
    Map<string, { dx: number; dy: number }>
  >(new Map());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);

  const panDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  const nodeDragRef = useRef<{
    nodeId: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    initialDx: number;
    initialDy: number;
    hasMoved: boolean;
  } | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setZoom(1);
      setNodeOffsets(new Map());
      const viewport = viewportRef.current;
      if (viewport) {
        viewport.scrollLeft = 0;
        viewport.scrollTop = 0;
      }
    });
  }, [model]);

  useLayoutEffect(() => {
    const pending = pendingScrollRef.current;
    if (pending && viewportRef.current) {
      viewportRef.current.scrollLeft = pending.x;
      viewportRef.current.scrollTop = pending.y;
      pendingScrollRef.current = null;
    }
  }, [zoom]);

  useEffect(() => {
    if (!contextMenu) return;
    const dismiss = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const rect = viewport.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        const scrollLeft = viewport.scrollLeft;
        const scrollTop = viewport.scrollTop;
        setZoom((oldZoom) => {
          const newZoom = Math.max(
            0.4,
            Math.min(2.5, oldZoom * (1 - e.deltaY * 0.003)),
          );
          pendingScrollRef.current = {
            x: ((scrollLeft + cursorX) / oldZoom) * newZoom - cursorX,
            y: ((scrollTop + cursorY) / oldZoom) * newZoom - cursorY,
          };
          return newZoom;
        });
      } else {
        viewport.scrollLeft += e.deltaX;
        viewport.scrollTop += e.deltaY;
      }
    };
    viewport.addEventListener("wheel", handler, { passive: false });
    return () => viewport.removeEventListener("wheel", handler);
  }, []);

  if (nodeLayouts.size === 0) {
    return (
      <div
        className={`dependency-graph dependency-graph--empty dependency-graph--${displayMode}${fullscreen ? " dependency-graph--fullscreen" : ""}`}
      >
        <EmptyState
          icon="↔"
          headline="No lineage available"
          subtext="This resource could not be placed on the lineage canvas."
        />
      </div>
    );
  }

  const legendItems: LensLegendItem[] = getLensLegendItems(
    lensMode,
    nodeLayouts,
  );
  const highlightedIds = collectHighlightedGraphIds(hoveredId, graphEdges);
  const hasHoverFocus = highlightedIds.size > 0;

  const getEffectivePos = (nodeId: string, baseX: number, baseY: number) => {
    const off = nodeOffsets.get(nodeId);
    return { x: baseX + (off?.dx ?? 0), y: baseY + (off?.dy ?? 0) };
  };

  return (
    <div
      className={`dependency-graph dependency-graph--${displayMode}${fullscreen ? " dependency-graph--fullscreen" : ""}`}
    >
      <div className="lineage-legend">
        <span className="lineage-legend__mode-label">
          {lensMode === "status"
            ? "By status"
            : lensMode === "type"
              ? "By type"
              : "By coverage"}
        </span>
        {legendItems.map((item) => (
          <span key={item.key} className="lineage-legend__item">
            <span
              className="lineage-legend__swatch"
              style={{
                background: item.color,
                borderColor: item.borderColor,
              }}
            />
            {item.label}
          </span>
        ))}
      </div>
      <div className="lineage-graph__viewport-toolbar">
        <div className="lineage-graph__zoom-controls">
          <button
            type="button"
            className={PILL_BASE}
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
          >
            −
          </button>
          <button
            type="button"
            className={PILL_BASE}
            onClick={() => setZoom(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className={PILL_BASE}
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}
          >
            +
          </button>
          {nodeOffsets.size > 0 && (
            <button
              type="button"
              className={PILL_BASE}
              onClick={() => setNodeOffsets(new Map())}
            >
              Reset layout
            </button>
          )}
        </div>
        <p className="lineage-graph__summary">
          {model.upstreamMap.size} upstream · {model.downstreamMap.size}{" "}
          downstream
        </p>
      </div>
      <div
        ref={viewportRef}
        className={`lineage-graph__viewport${fullscreen ? " lineage-graph__viewport--fullscreen" : ""}`}
        onPointerDown={(event) => {
          const viewport = viewportRef.current;
          if (!viewport) return;
          panDragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            scrollLeft: viewport.scrollLeft,
            scrollTop: viewport.scrollTop,
          };
          viewport.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = panDragRef.current;
          const viewport = viewportRef.current;
          if (!drag || !viewport || drag.pointerId !== event.pointerId) return;
          viewport.scrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
          viewport.scrollTop = drag.scrollTop - (event.clientY - drag.startY);
        }}
        onPointerUp={(event) => {
          const viewport = viewportRef.current;
          if (panDragRef.current?.pointerId === event.pointerId && viewport) {
            viewport.releasePointerCapture(event.pointerId);
          }
          panDragRef.current = null;
        }}
        onPointerCancel={() => {
          panDragRef.current = null;
        }}
      >
        <div
          className="lineage-graph__canvas"
          style={{
            width: `${svgWidth * zoom}px`,
            height: `${svgHeight * zoom}px`,
          }}
        >
          <svg
            className="dependency-graph__svg"
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            {graphEdges.map((edge) => {
              const from = nodeLayouts.get(edge.from);
              const to = nodeLayouts.get(edge.to);
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
            {Array.from(nodeLayouts.values()).map((node) => {
              const isHighlighted =
                !hasHoverFocus || highlightedIds.has(node.resource.uniqueId);
              const { x, y } = getEffectivePos(
                node.resource.uniqueId,
                node.x,
                node.y,
              );
              const passLabel = `✓${node.passCount}`;
              const failLabel = `✗${node.failCount}`;
              const passBadgeWidth = estimateBadgeWidth(passLabel);
              const failBadgeWidth = estimateBadgeWidth(failLabel);
              const badgeGap = 6;
              const badgeY =
                displayMode === "summary"
                  ? y + nodeHeight - 18
                  : y + nodeHeight - 21;
              const badgeHeight = displayMode === "summary" ? 14 : 16;
              const badgeRadius = badgeHeight / 2;
              return (
                <g key={node.resource.uniqueId}>
                  <rect
                    x={x}
                    y={y}
                    width={nodeWidth}
                    height={nodeHeight}
                    rx={nodeRadius}
                    style={{ fill: getLensNodeFill(node.resource, lensMode) }}
                    className={`dependency-graph__node${node.side === "selected" ? " dependency-graph__node--selected" : ""}${isHighlighted ? "" : " dependency-graph__node--dimmed"}`}
                  />
                  <text
                    x={x + 16}
                    y={displayMode === "summary" ? y + 20 : y + 25}
                    className="dependency-graph__node-label"
                  >
                    {node.resource.name}
                  </text>
                  <text
                    x={x + 16}
                    y={displayMode === "summary" ? y + 35 : y + 45}
                    className="dependency-graph__node-meta"
                  >
                    {node.side === "selected"
                      ? formatResourceTypeLabel(node.resource.resourceType)
                      : `${formatResourceTypeLabel(node.resource.resourceType)} · Depth ${node.depth}`}
                  </text>
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
                    className="dependency-graph__node-stat-pill dependency-graph__node-stat-pill--fail"
                  />
                  <text
                    x={x + 16 + passBadgeWidth + badgeGap + failBadgeWidth / 2}
                    y={badgeY + badgeHeight / 2}
                    className="dependency-graph__node-stat dependency-graph__node-stat--fail"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {failLabel}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="dependency-graph__interactive-layer">
            {Array.from(nodeLayouts.values()).map((node) => {
              const { x, y } = getEffectivePos(
                node.resource.uniqueId,
                node.x,
                node.y,
              );
              const hotspotStyle: CSSProperties = {
                left: `${(x / svgWidth) * 100}%`,
                top: `${(y / svgHeight) * 100}%`,
                width: `${(nodeWidth / svgWidth) * 100}%`,
                height: `${(nodeHeight / svgHeight) * 100}%`,
              };
              return (
                <button
                  key={node.resource.uniqueId}
                  type="button"
                  className={`dependency-graph__hotspot dependency-graph__hotspot--${node.side}`}
                  style={hotspotStyle}
                  onClick={() => {
                    if (nodeDragRef.current?.hasMoved) return;
                    onSelectResource(node.resource.uniqueId);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    const position = positionOverlay({
                      anchorX: event.clientX,
                      anchorY: event.clientY,
                      width: CONTEXT_MENU_OVERLAY_SIZE.width,
                      height: CONTEXT_MENU_OVERLAY_SIZE.height,
                    });
                    setContextMenu({
                      x: position.x,
                      y: position.y,
                      nodeId: node.resource.uniqueId,
                    });
                  }}
                  onMouseEnter={(event) => {
                    setHoveredId(node.resource.uniqueId);
                    const position = positionOverlayAgainstRect({
                      anchorRect: event.currentTarget.getBoundingClientRect(),
                      width: TOOLTIP_OVERLAY_SIZE.width,
                      height: TOOLTIP_OVERLAY_SIZE.height,
                    });
                    setTooltipInfo({
                      x: position.x,
                      y: position.y,
                      nodeId: node.resource.uniqueId,
                    });
                  }}
                  onMouseLeave={() => {
                    setHoveredId(null);
                    setTooltipInfo(null);
                  }}
                  title={node.resource.uniqueId}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    const existing = nodeOffsets.get(
                      node.resource.uniqueId,
                    ) ?? {
                      dx: 0,
                      dy: 0,
                    };
                    nodeDragRef.current = {
                      nodeId: node.resource.uniqueId,
                      pointerId: event.pointerId,
                      startClientX: event.clientX,
                      startClientY: event.clientY,
                      initialDx: existing.dx,
                      initialDy: existing.dy,
                      hasMoved: false,
                    };
                    (event.currentTarget as HTMLElement).setPointerCapture(
                      event.pointerId,
                    );
                  }}
                  onPointerMove={(event) => {
                    const drag = nodeDragRef.current;
                    if (
                      !drag ||
                      drag.pointerId !== event.pointerId ||
                      drag.nodeId !== node.resource.uniqueId
                    )
                      return;
                    const rawDx = event.clientX - drag.startClientX;
                    const rawDy = event.clientY - drag.startClientY;
                    if (Math.abs(rawDx) > 4 || Math.abs(rawDy) > 4) {
                      drag.hasMoved = true;
                    }
                    const dx = drag.initialDx + rawDx / zoom;
                    const dy = drag.initialDy + rawDy / zoom;
                    setNodeOffsets((prev) => {
                      const next = new Map(prev);
                      next.set(drag.nodeId, { dx, dy });
                      return next;
                    });
                  }}
                  onPointerUp={(event) => {
                    if (nodeDragRef.current?.pointerId === event.pointerId) {
                      (
                        event.currentTarget as HTMLElement
                      ).releasePointerCapture(event.pointerId);
                      setTimeout(() => {
                        nodeDragRef.current = null;
                      }, 0);
                    }
                  }}
                  onPointerCancel={() => {
                    nodeDragRef.current = null;
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
      {contextMenu && (
        <div
          className="graph-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="graph-context-menu__item"
            onClick={() => {
              onSelectResource(contextMenu.nodeId);
              setContextMenu(null);
            }}
          >
            Focus on this node
          </button>
          {(() => {
            const layout = nodeLayouts.get(contextMenu.nodeId);
            return layout ? (
              <div className="graph-context-menu__label">
                {layout.resource.name}
              </div>
            ) : null;
          })()}
        </div>
      )}
      {tooltipInfo &&
        (() => {
          const layout = nodeLayouts.get(tooltipInfo.nodeId);
          if (!layout) return null;
          const r = layout.resource;
          return (
            <div
              className="graph-node-tooltip"
              style={{ left: tooltipInfo.x, top: tooltipInfo.y }}
              aria-hidden="true"
            >
              <div className="graph-node-tooltip__name">{r.name}</div>
              <div className="graph-node-tooltip__meta">
                {formatResourceTypeLabel(r.resourceType)}
                {r.packageName ? ` · ${r.packageName}` : ""}
              </div>
              {r.status && (
                <div
                  className={`graph-node-tooltip__status graph-node-tooltip__status--${r.statusTone}`}
                >
                  {r.status}
                  {r.executionTime != null
                    ? ` · ${formatSeconds(r.executionTime)}`
                    : ""}
                </div>
              )}
              {r.description && (
                <div className="graph-node-tooltip__description">
                  {r.description}
                </div>
              )}
            </div>
          );
        })()}
    </div>
  );
}

function LensSelector({
  lensMode,
  setLensMode,
}: {
  lensMode: LensMode;
  setLensMode: (mode: LensMode) => void;
}) {
  const modes: Array<{ value: LensMode; label: string }> = [
    { value: "type", label: "Type" },
    { value: "status", label: "Status" },
    { value: "coverage", label: "Coverage" },
  ];
  return (
    <div className="lens-selector">
      <span className="lens-selector__label">Lens</span>
      {modes.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={lensMode === value ? PILL_ACTIVE : PILL_BASE}
          onClick={() => setLensMode(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function LineagePanel({
  resource,
  dependencySummary,
  dependencyIndex,
  resourceById,
  upstreamDepth,
  downstreamDepth,
  allDepsMode,
  lensMode,
  setUpstreamDepth,
  setDownstreamDepth,
  setAllDepsMode,
  setLensMode,
  onSelectResource,
  displayMode = "focused",
}: {
  resource: ResourceNode;
  dependencySummary: AnalysisState["dependencyIndex"][string] | undefined;
  dependencyIndex: AnalysisState["dependencyIndex"];
  resourceById: Map<string, ResourceNode>;
  upstreamDepth: number;
  downstreamDepth: number;
  allDepsMode: boolean;
  lensMode: LensMode;
  setUpstreamDepth: Dispatch<SetStateAction<number>>;
  setDownstreamDepth: Dispatch<SetStateAction<number>>;
  setAllDepsMode: Dispatch<SetStateAction<boolean>>;
  setLensMode: (mode: LensMode) => void;
  onSelectResource: (id: string) => void;
  displayMode?: LineageDisplayMode;
}) {
  const [isFullscreenOpen, setFullscreenOpen] = useState(false);
  const ALL_DEPS_DEPTH = 20;

  const graphModel = useMemo(
    () =>
      buildLineageGraphModel({
        resource,
        dependencySummary,
        dependencyIndex,
        resourceById,
        upstreamDepth: allDepsMode ? ALL_DEPS_DEPTH : upstreamDepth,
        downstreamDepth: allDepsMode ? ALL_DEPS_DEPTH : downstreamDepth,
        displayMode,
      }),
    [
      allDepsMode,
      dependencyIndex,
      dependencySummary,
      displayMode,
      downstreamDepth,
      resource,
      resourceById,
      upstreamDepth,
    ],
  );

  const depthToolbar = (withClose = false) => (
    <div className="lineage-toolbar">
      <LensSelector lensMode={lensMode} setLensMode={setLensMode} />
      <DepthStepper
        label="Upstream"
        value={upstreamDepth}
        setValue={setUpstreamDepth}
        disabled={allDepsMode}
      />
      <DepthStepper
        label="Downstream"
        value={downstreamDepth}
        setValue={setDownstreamDepth}
        disabled={allDepsMode}
      />
      <button
        type="button"
        className={allDepsMode ? PILL_ACTIVE : PILL_BASE}
        onClick={() => {
          if (allDepsMode) {
            setAllDepsMode(false);
            setUpstreamDepth(2);
            setDownstreamDepth(2);
          } else {
            setAllDepsMode(true);
          }
        }}
      >
        {allDepsMode ? "Depth 2" : "Show all"}
      </button>
      {withClose ? (
        <button
          type="button"
          className="workspace-pill"
          onClick={() => setFullscreenOpen(false)}
        >
          Close
        </button>
      ) : (
        displayMode === "focused" && (
          <button
            type="button"
            className="workspace-pill"
            onClick={() => setFullscreenOpen(true)}
          >
            Expand
          </button>
        )
      )}
    </div>
  );

  return (
    <>
      <SectionCard
        title={displayMode === "summary" ? "Lineage graph" : "Lineage"}
        subtitle={
          displayMode === "summary"
            ? undefined
            : `Exact upstream and downstream lineage for ${resource.name}.`
        }
        headerRight={displayMode === "focused" ? depthToolbar() : undefined}
      >
        <div className={`lineage-summary lineage-summary--${displayMode}`}>
          <div className="lineage-summary__stats">
            <div className="lineage-summary__stat">
              <span>Selected resource</span>
              <strong>{formatResourceTypeLabel(resource.resourceType)}</strong>
            </div>
            <div className="lineage-summary__stat">
              <span>Upstream</span>
              <strong>{dependencySummary?.upstreamCount ?? 0}</strong>
            </div>
            <div className="lineage-summary__stat">
              <span>Downstream</span>
              <strong>{dependencySummary?.downstreamCount ?? 0}</strong>
            </div>
          </div>
          <LineageGraphSurface
            model={graphModel}
            onSelectResource={onSelectResource}
            lensMode={lensMode}
            displayMode={displayMode}
          />
        </div>
      </SectionCard>

      {isFullscreenOpen && (
        <div className="lineage-dialog" role="dialog" aria-modal="true">
          <button
            type="button"
            className="lineage-dialog__backdrop"
            aria-label="Close lineage graph"
            onClick={() => setFullscreenOpen(false)}
          />
          <section className="lineage-dialog__panel">
            <div className="lineage-dialog__header">
              <div>
                <p className="eyebrow">Lineage</p>
                <h3>{resource.name}</h3>
                <p className="lineage-dialog__subtitle">
                  Exact dependency graph with staged upstream and downstream
                  columns.
                </p>
              </div>
              {depthToolbar(true)}
            </div>
            <LineageGraphSurface
              model={graphModel}
              onSelectResource={onSelectResource}
              lensMode={lensMode}
              displayMode="focused"
              fullscreen
            />
          </section>
        </div>
      )}
    </>
  );
}
