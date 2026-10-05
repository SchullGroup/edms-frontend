'use client';

import React from 'react';
import { dueLabel } from '@/utils/helpers';
import type { WorkflowInstanceStatus, WorkflowStage } from '@/types/models';

export interface WorkflowStageProgressProps {
  stages: WorkflowStage[] | undefined;
  currentStage: string | null | undefined;
  status: WorkflowInstanceStatus | undefined;
  /** Who is sitting on the current stage — the pending task's assignee or role. */
  currentActorName?: string;
  stageDueAt?: string | null;
}

/**
 * The stage rail shared by the document workspace and the workflow monitor.
 * A closed instance marks every stage done — the engine doesn't tell us which
 * stage a `reject`/`close` terminated on, only that the instance is finished.
 */
export function WorkflowStageProgress({
  stages,
  currentStage,
  status,
  currentActorName = 'Unassigned',
  stageDueAt,
}: WorkflowStageProgressProps) {
  if (!stages?.length) return null;

  const curIdx = stages.findIndex((s) => s.id === currentStage);
  const due = stageDueAt ? dueLabel(stageDueAt) : null;

  return (
    <div>
      {stages.map((s, i) => {
        const state =
          status === 'closed' || (curIdx > -1 && i < curIdx)
            ? 'done'
            : i === curIdx
              ? 'current'
              : 'next';

        return (
          <div key={s.id} className={`wf-stage ${state}`} style={{ cursor: 'default' }}>
            <div className="wf-dot">{state === 'done' ? '✓' : String(i + 1)}</div>
            <div className="wf-info" style={{ flex: 1, minWidth: 0 }}>
              <div className="nm">{s.name || s.id}</div>
              <div className="who">
                {state === 'current'
                  ? `${currentActorName} · ${status === 'on_hold' ? 'on hold' : 'in progress'}`
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
    </div>
  );
}
