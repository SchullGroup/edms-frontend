'use client';

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { actionLabel, computeStageLayout, describeCondition } from './constants';
import type { WorkflowStage, WorkflowTransition } from '@/types/models';

const NODE_WIDTH = 176;
/** Fixed, so a card with two rows of action tags never grows into its neighbour. */
const NODE_HEIGHT = 116;
/** Leaves ~144px between columns — room for a branch label on the line. */
const COL_GAP = 320;
/** Leaves ~54px between stacked cards, so a line can pass between them. */
const ROW_GAP = 170;
const ORIGIN_X = 24;
const ORIGIN_Y = 200;
/** How far a line routed around a card clears it. */
const DETOUR = 28;

interface PositionedNode {
  stage: WorkflowStage;
  x: number;
  y: number;
}

interface Edge {
  transition: WorkflowTransition;
  d: string;
  /** Where the branch label sits — the curve's midpoint. */
  labelX: number;
  labelY: number;
  kind: 'plain' | 'conditional' | 'fallback';
}

export interface WorkflowCanvasProps {
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
  selectedStageId: string | null;
  onSelect: (id: string) => void;
  /** A branch line's own label was clicked, not just its stage card — selects
   *  the stage same as `onSelect`, but the caller also jumps straight to the
   *  Transitions tab in the side panel, since that's unambiguously what a
   *  click on a routing line means. */
  onEditBranch: (id: string) => void;
  assigneeSummary: (stage: WorkflowStage) => string;
  /** Names a metadata field in branch labels ("Invoice Amount > 5000000"). */
  metadataFieldName?: (metadataFieldId: string) => string | undefined;
}

/** The point halfway along a cubic Bézier. */
const bezierMid = (p0: number, c1: number, c2: number, p1: number) =>
  (p0 + 3 * c1 + 3 * c2 + p1) / 8;

/**
 * Stages laid out by their position in the routing graph (`computeStageLayout`:
 * column = longest path from the first stage, row = siblings in a column), so
 * a fork and the stage it reconverges on read left to right. A line that skips
 * a column is routed above or below any card in its way, never through it.
 *
 * The canvas is a fixed-height viewport that scrolls on its own — adding stages
 * grows the graph inside it, not the page — and dragging its empty background
 * pans it. Cards themselves don't drag: their position comes from the routing,
 * so moving one by hand couldn't change where its lines go and would only
 * mislead. Editing happens in the side panel (`StagePanel`); clicking a branch
 * label jumps straight to that stage's Transitions tab.
 */
export function WorkflowCanvas({
  stages,
  transitions,
  selectedStageId,
  onSelect,
  onEditBranch,
  assigneeSummary,
  metadataFieldName,
}: WorkflowCanvasProps) {
  const nodes: PositionedNode[] = useMemo(() => {
    const layout = computeStageLayout(stages, transitions);
    const rowOffset = new Map(layout.map((l) => [l.id, l.row]));
    const colByStage = new Map(layout.map((l) => [l.id, l.column]));
    return stages.map((stage) => ({
      stage,
      x: ORIGIN_X + (colByStage.get(stage.id) ?? 0) * COL_GAP,
      y: ORIGIN_Y + (rowOffset.get(stage.id) ?? 0) * ROW_GAP,
    }));
  }, [stages, transitions]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.stage.id, n])), [nodes]);

  const edges: Edge[] = useMemo(() => {
    const outgoingCountByStage = new Map<string, number>();
    transitions.forEach((t) =>
      outgoingCountByStage.set(t.from, (outgoingCountByStage.get(t.from) || 0) + 1),
    );

    return transitions
      .map((t): Edge | null => {
        const from = nodeById.get(t.from);
        const to = nodeById.get(t.to);
        if (!from || !to) return null;
        const isBranch = (outgoingCountByStage.get(t.from) || 0) > 1;
        const kind: Edge['kind'] = t.condition ? 'conditional' : isBranch ? 'fallback' : 'plain';

        const x1 = from.x + NODE_WIDTH;
        const y1 = from.y + NODE_HEIGHT / 2;
        const x2 = to.x;
        const y2 = to.y + NODE_HEIGHT / 2;

        // Cards strictly between the two ends horizontally that the straight
        // curve would pass through.
        const inTheWay = nodes.filter((n) => {
          if (n === from || n === to || n.x <= from.x || n.x + NODE_WIDTH >= to.x) return false;
          const yAtCard = y1 + ((n.x + NODE_WIDTH / 2 - x1) / (x2 - x1 || 1)) * (y2 - y1);
          return yAtCard > n.y - DETOUR / 2 && yAtCard < n.y + NODE_HEIGHT + DETOUR / 2;
        });

        let c1x: number, c1y: number, c2x: number, c2y: number;
        if (inTheWay.length > 0) {
          // Go around: over the top of the blocking cards, or under them when
          // the line starts below their middle.
          const top = Math.min(...inTheWay.map((n) => n.y)) - DETOUR;
          const bottom = Math.max(...inTheWay.map((n) => n.y + NODE_HEIGHT)) + DETOUR;
          const midOfBlockers = (top + bottom) / 2;
          const detourY = y1 <= midOfBlockers ? top : bottom;
          // A cubic's peak reaches 3/4 of the way to its control points.
          const ctrlY = detourY + (detourY - (y1 + y2) / 2) / 3;
          c1x = x1 + (x2 - x1) * 0.25;
          c2x = x2 - (x2 - x1) * 0.25;
          c1y = ctrlY;
          c2y = ctrlY;
        } else {
          const midX = (x1 + x2) / 2;
          c1x = midX;
          c1y = y1;
          c2x = midX;
          c2y = y2;
        }

        return {
          transition: t,
          d: `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`,
          labelX: bezierMid(x1, c1x, c2x, x2),
          labelY: bezierMid(y1, c1y, c2y, y2),
          kind,
        };
      })
      .filter((e): e is Edge => e !== null);
  }, [transitions, nodeById, nodes]);

  const bounds = useMemo(() => {
    const maxX = Math.max(NODE_WIDTH, ...nodes.map((n) => n.x + NODE_WIDTH));
    const minY = Math.min(0, ...nodes.map((n) => n.y), ...edges.map((e) => e.labelY)) - DETOUR;
    const maxY =
      Math.max(0, ...nodes.map((n) => n.y + NODE_HEIGHT), ...edges.map((e) => e.labelY)) + DETOUR;
    return { width: maxX + 40, height: maxY - minY + 40, offsetY: -minY + 20 };
  }, [nodes, edges]);

  // Drag the empty background to pan. Cards and branch labels keep their own
  // clicks — a drag only starts on the canvas itself.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const panStart = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [panning, setPanning] = useState(false);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !scrollerRef.current) return;
    if ((e.target as HTMLElement).closest('.wf-node, .wfd-branch-label')) return;
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      left: scrollerRef.current.scrollLeft,
      top: scrollerRef.current.scrollTop,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setPanning(true);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = panStart.current;
    if (!start || !scrollerRef.current) return;
    scrollerRef.current.scrollLeft = start.left - (e.clientX - start.x);
    scrollerRef.current.scrollTop = start.top - (e.clientY - start.y);
  };
  const endPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!panStart.current) return;
    panStart.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setPanning(false);
  };

  if (stages.length === 0) {
    return (
      <div className="caption" style={{ padding: '20px' }}>
        No stages yet — add the first one.
      </div>
    );
  }

  return (
    <div>
      <div
        ref={scrollerRef}
        className={`wfd-canvas ${panning ? 'panning' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <div className="wfd-canvas-graph" style={{ width: bounds.width, height: bounds.height }}>
          <svg className="wfd-connectors" style={{ width: bounds.width, height: bounds.height }}>
            <defs>
              {(['plain', 'conditional', 'fallback'] as const).map((kind) => (
                <marker
                  key={kind}
                  id={`wfd-arrow-${kind}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" className={`wfd-arrow-${kind}`} />
                </marker>
              ))}
            </defs>
            <g transform={`translate(0 ${bounds.offsetY})`}>
              {edges.map((edge, i) => (
                <path
                  key={i}
                  d={edge.d}
                  fill="none"
                  className={`wfd-connector-${edge.kind}`}
                  markerEnd={`url(#wfd-arrow-${edge.kind})`}
                />
              ))}
            </g>
          </svg>

          {nodes.map(({ stage, x, y }) => (
            <div
              key={stage.id}
              className={`wf-node ${selectedStageId === stage.id ? 'selected' : ''}`}
              style={{ left: x, top: y + bounds.offsetY, width: NODE_WIDTH, height: NODE_HEIGHT }}
              onClick={() => onSelect(stage.id)}
            >
              <div className="wf-node-name">{stage.name || stage.id}</div>
              <div className="wf-node-meta">
                {assigneeSummary(stage)} · {stage.sla_hours || 48}h
              </div>
              <div className="wf-node-tags">
                {(stage.actions || []).map((a) => (
                  <span key={a} className="wf-node-tag">
                    {actionLabel(a)}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {edges
            .filter((e) => e.kind !== 'plain')
            .map((edge, i) => {
              const text =
                edge.kind === 'conditional'
                  ? describeCondition(edge.transition.condition, metadataFieldName)
                  : 'Fallback';
              return (
                <button
                  key={i}
                  type="button"
                  className={`wfd-branch-label ${edge.kind === 'conditional' ? 'conditional' : 'fallback'}`}
                  style={{ left: edge.labelX, top: edge.labelY + bounds.offsetY }}
                  onClick={() => onEditBranch(edge.transition.from)}
                  title={`${text} — click to edit this stage's transitions`}
                >
                  {text}
                </button>
              );
            })}
        </div>
      </div>

      <div className="caption" style={{ padding: '10px 20px 14px' }}>
        Click a stage to configure it on the right; drag the background to move around. Where a
        stage branches, amber lines are conditions and the dashed green line is the fallback — click
        a label to jump to that stage&rsquo;s Transitions tab.
      </div>
    </div>
  );
}
