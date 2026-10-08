'use client';

import React from 'react';
import { dueLabel } from '@/utils/helpers';
import type { WorkflowInstanceStatus, WorkflowStage } from '@/types/models';
import type { WorkflowDocumentPosition } from './useWorkflowDocumentPositions';

export interface WorkflowStageProgressProps {
  stages: WorkflowStage[] | undefined;
  /** Where each document stands (`useWorkflowDocumentPositions`). */
  positions: WorkflowDocumentPosition[];
  status: WorkflowInstanceStatus | undefined;
  /** Who is sitting on the current stage — the pending task's assignee or role. */
  currentActorName?: string;
}

/**
 * The stage rail shared by the workflow page and the workflow monitor. A
 * workflow's documents move through the stages on their own (edms-backend
 * `919d0ef`), so any stage holding a document is "current", with how many and
 * the nearest deadline; stages before the earliest of those are done. A closed
 * workflow marks every stage done — the engine doesn't say which stage a
 * `reject`/`close` ended on. With more than one document, a per-document list
 * follows the rail.
 */
export function WorkflowStageProgress({
  stages,
  positions,
  status,
  currentActorName = 'Unassigned',
}: WorkflowStageProgressProps) {
  if (!stages?.length) return null;

  const stageIndex = new Map(stages.map((s, i) => [s.id, i]));
  const executions = positions.flatMap((p) => p.active);
  const occupiedIdx = executions
    .map((e) => stageIndex.get(e.currentStage))
    .filter((i): i is number => i !== undefined);
  const firstOccupied = occupiedIdx.length ? Math.min(...occupiedIdx) : -1;
  const multiDoc = positions.length > 1;
  const onHold = status === 'on_hold';

  return (
    <div>
      {stages.map((s, i) => {
        const here = executions.filter((e) => e.currentStage === s.id);
        const state =
          status === 'closed' || (firstOccupied > -1 && i < firstOccupied)
            ? 'done'
            : here.length
              ? 'current'
              : 'next';
        const nearestDue = here
          .map((e) => e.stageDueAt)
          .filter((d): d is string => !!d)
          .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
        const due = nearestDue ? dueLabel(nearestDue) : null;

        return (
          <div key={s.id} className={`wf-stage ${state}`} style={{ cursor: 'default' }}>
            <div className="wf-dot">{state === 'done' ? '✓' : String(i + 1)}</div>
            <div className="wf-info" style={{ flex: 1, minWidth: 0 }}>
              <div className="nm">{s.name || s.id}</div>
              <div className="who">
                {state === 'current'
                  ? [
                      multiDoc ? `${here.length} document${here.length === 1 ? '' : 's'}` : null,
                      currentActorName,
                      onHold ? 'on hold' : 'in progress',
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : s.role || ''}
                {state === 'current' && due && (
                  <span style={due.late ? { color: 'var(--status-overdue)', fontWeight: 700 } : {}}>
                    {' '}
                    · {due.text}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {multiDoc && (
        <div className="mt-2">
          <div className="caption" style={{ fontWeight: 700, marginBottom: '4px' }}>
            DOCUMENTS
          </div>
          {positions.map((p) => {
            const stageNames = p.active
              .map((e) => stages.find((s) => s.id === e.currentStage)?.name || e.currentStage)
              .join(' + ');
            const nearestDue = p.active
              .map((e) => e.stageDueAt)
              .filter((d): d is string => !!d)
              .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
            const due = nearestDue ? dueLabel(nearestDue) : null;
            return (
              <div key={p.id} className="metric-li">
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.title}
                </span>
                <span className="caption" style={{ whiteSpace: 'nowrap' }}>
                  {status === 'closed' ? 'Closed' : stageNames || '—'}
                  {due && (
                    <span
                      style={due.late ? { color: 'var(--status-overdue)', fontWeight: 700 } : {}}
                    >
                      {' '}
                      · {due.text}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
