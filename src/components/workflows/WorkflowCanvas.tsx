'use client';

import { useMemo } from 'react';
import { actionLabel, computeStageLayout, describeCondition } from './constants';
import type { WorkflowStage, WorkflowTransition } from '@/types/models';

const NODE_WIDTH = 176;
const NODE_HEIGHT = 92;
const COL_GAP = 230;
const ROW_GAP = 112;
const ORIGIN_X = 24;
const ORIGIN_Y = 200;

interface PositionedNode {
  stage: WorkflowStage;
  x: number;
  y: number;
}

interface Edge {
  transition: WorkflowTransition;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
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
}

/**
 * Stages laid out by their actual position in the routing graph — column is
 * how many hops from the first stage, row separates branch siblings that
 * share a source — instead of a flat left-to-right row keyed to array order.
 * The flat layout is what caused a real, reported problem: a branch and its
 * required fallback rarely land on adjacent array entries, so a transition
 * connecting them had to visually cross whatever stage card sat between them
 * in the row. A layered graph layout has nowhere for that to happen in the
 * common case (a stage fans out, its branches soon reconverge).
 *
 * This is purely the visual/selection surface — editing a stage's routing
 * happens in the side panel's Transitions tab (`StagePanel`), not here.
 * Clicking a branch line still selects its stage and jumps the panel to that
 * tab (`onEditBranch`), so the line is a real shortcut, not just a picture.
 *
 * Trade-off: stages are no longer drag-to-reorder. Position is now derived
 * from the graph, so manually dragging a card would only be cosmetic for an
 * unbranched stage and actively misleading for a branched one (it can't
 * change where a line points). Reordering support, if it's still wanted,
 * belongs on the underlying stage list (e.g. move up/down in Properties),
 * not as a drag on this canvas.
 */
export function WorkflowCanvas({ stages, transitions, selectedStageId, onSelect, onEditBranch, assigneeSummary }: WorkflowCanvasProps) {
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
    transitions.forEach((t) => outgoingCountByStage.set(t.from, (outgoingCountByStage.get(t.from) || 0) + 1));

    return transitions
      .map((t): Edge | null => {
        const from = nodeById.get(t.from);
        const to = nodeById.get(t.to);
        if (!from || !to) return null;
        const isBranch = (outgoingCountByStage.get(t.from) || 0) > 1;
        return {
          transition: t,
          x1: from.x + NODE_WIDTH,
          y1: from.y + NODE_HEIGHT / 2,
          x2: to.x,
          y2: to.y + NODE_HEIGHT / 2,
          kind: t.condition ? 'conditional' : isBranch ? 'fallback' : 'plain',
        };
      })
      .filter((e): e is Edge => e !== null);
  }, [transitions, nodeById]);

  const bounds = useMemo(() => {
    const maxX = Math.max(NODE_WIDTH, ...nodes.map((n) => n.x + NODE_WIDTH));
    const minY = Math.min(0, ...nodes.map((n) => n.y));
    const maxY = Math.max(0, ...nodes.map((n) => n.y + NODE_HEIGHT));
    return { width: maxX + 40, height: maxY - minY + 40, offsetY: -minY + 20 };
  }, [nodes]);

  if (stages.length === 0) {
    return (
      <div className="caption" style={{ padding: '20px' }}>
        No stages yet — add the first one.
      </div>
    );
  }

  return (
    <div className="wfd-canvas">
      <div className="wfd-canvas-graph" style={{ width: bounds.width, height: bounds.height }}>
        {nodes.map(({ stage, x, y }) => (
          <div
            key={stage.id}
            className={`wf-node ${selectedStageId === stage.id ? 'selected' : ''}`}
            style={{ left: x, top: y + bounds.offsetY, width: NODE_WIDTH }}
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

        <svg className="wfd-connectors" style={{ width: bounds.width, height: bounds.height }}>
          {edges.map((edge, i) => {
            const y1 = edge.y1 + bounds.offsetY;
            const y2 = edge.y2 + bounds.offsetY;
            const midX = (edge.x1 + edge.x2) / 2;
            return (
              <path
                key={i}
                d={`M ${edge.x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${edge.x2} ${y2}`}
                fill="none"
                strokeWidth={2}
                className={`wfd-connector-${edge.kind}`}
              />
            );
          })}
        </svg>

        {edges
          .filter((e) => e.kind !== 'plain')
          .map((edge, i) => (
            <button
              key={i}
              type="button"
              className={`wfd-branch-label ${edge.kind === 'conditional' ? 'conditional' : 'fallback'}`}
              style={{ left: (edge.x1 + edge.x2) / 2, top: (edge.y1 + edge.y2) / 2 + bounds.offsetY }}
              onClick={() => onEditBranch(edge.transition.from)}
              title={edge.kind === 'conditional' ? 'Edit this branch' : 'Edit the fallback target'}
            >
              {edge.kind === 'conditional' ? describeCondition(edge.transition.condition) : 'else'}
            </button>
          ))}
      </div>

      <div className="caption" style={{ marginTop: '12px' }}>
        Click a stage to configure it on the right. A stage with more than one outgoing line is
        branching: amber for a condition, green for the required fallback — click either to jump
        straight to its Transitions tab.
      </div>
    </div>
  );
}
