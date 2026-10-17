'use client';

import React from 'react';
import { dueLabel } from '@/utils/helpers';
import { reachableFrom } from '@/components/workflows/constants';
import { useDepartmentNames } from '@/apis/hooks/useDepartments';
import { ACTIVE_TASK_STATUSES, taskHolderLabel } from '@/utils/supervisor';
import type {
  Task,
  WorkflowInstanceStatus,
  WorkflowStage,
  WorkflowTransition,
} from '@/types/models';
import type { WorkflowDocumentPosition } from './useWorkflowDocumentPositions';

export interface WorkflowStageProgressProps {
  stages: WorkflowStage[] | undefined;
  /** The definition's routing. With it, "done" follows the graph, so a
   *  parallel branch that has finished reads as done while its sibling runs. */
  transitions?: WorkflowTransition[];
  /** Where each document stands (`useWorkflowDocumentPositions`). */
  positions: WorkflowDocumentPosition[];
  status: WorkflowInstanceStatus | undefined;
  /** The workflow's tasks, to name who holds each current stage — parallel
   *  branches are held by different people. */
  tasks?: Task[];
  /** Who is sitting on the current stage when `tasks` can't say. */
  currentActorName?: string;
}

/**
 * The stage rail shared by the workflow page and the workflow monitor. A
 * workflow's documents move through the stages on their own (edms-backend
 * `919d0ef`), and a parallel fork runs one document at several stages at once
 * (edms-backend PR #54), so any stage holding a document is "current", with
 * how many, who holds it and the nearest deadline. A stage is done once nothing
 * sits on it and a stage after it is occupied; without the routing, stages
 * before the earliest occupied one are. A closed workflow marks every stage
 * done — the engine doesn't say which stage a `reject`/`close` ended on. A
 * branch that reached its join before the others shows as waiting there. With
 * more than one document, a per-document list follows the rail.
 */
export function WorkflowStageProgress({
  stages,
  transitions,
  positions,
  status,
  tasks,
  currentActorName = 'Unassigned',
}: WorkflowStageProgressProps) {
  const departmentName = useDepartmentNames();
  if (!stages?.length) return null;

  const stageIndex = new Map(stages.map((s, i) => [s.id, i]));
  const executions = positions.flatMap((p) => p.active);
  const occupied = new Set(executions.map((e) => e.currentStage));
  const occupiedIdx = executions
    .map((e) => stageIndex.get(e.currentStage))
    .filter((i): i is number => i !== undefined);
  const firstOccupied = occupiedIdx.length ? Math.min(...occupiedIdx) : -1;
  const isDone = (stage: WorkflowStage, i: number) => {
    if (status === 'closed') return true;
    if (occupied.has(stage.id)) return false;
    if (!transitions?.length) return firstOccupied > -1 && i < firstOccupied;
    const ahead = reachableFrom(stage.id, transitions);
    return [...occupied].some((id) => ahead.has(id));
  };
  const holderAt = (stageId: string) => {
    const names = (tasks ?? [])
      .filter(
        (t) => t.stage === stageId && (ACTIVE_TASK_STATUSES as readonly string[]).includes(t.status),
      )
      .map((t) => taskHolderLabel(t, departmentName));
    return names.length ? [...new Set(names)].join(', ') : tasks ? null : currentActorName;
  };
  const multiDoc = positions.length > 1;
  const onHold = status === 'on_hold';

  return (
    <div>
      {/* Own wrapper: `.wf-stage:last-child` hides the connector below the last
          stage, which fails if the documents list shares this parent. */}
      <div>
        {stages.map((s, i) => {
          const here = executions.filter((e) => e.currentStage === s.id);
          const state = isDone(s, i) ? 'done' : here.length ? 'current' : 'next';
          // A branch parked at its join, waiting for its siblings — no task, no SLA yet.
          const allWaiting = here.length > 0 && here.every((e) => e.status === 'waiting');
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
                        allWaiting ? null : holderAt(s.id),
                        allWaiting
                          ? 'waiting for the other branches'
                          : onHold
                            ? 'on hold'
                            : 'in progress',
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : s.role || ''}
                  {state === 'current' && due && (
                    <span
                      style={due.late ? { color: 'var(--status-overdue)', fontWeight: 700 } : {}}
                    >
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

      {multiDoc && (
        <div className="mt-2">
          <div className="caption" style={{ fontWeight: 700, marginBottom: '4px' }}>
            DOCUMENTS
          </div>
          {positions.map((p) => {
            const stageNames = p.active
              .map((e) => {
                const name = stages.find((s) => s.id === e.currentStage)?.name || e.currentStage;
                return e.status === 'waiting' ? `${name} (waiting)` : name;
              })
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
