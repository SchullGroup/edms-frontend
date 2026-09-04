'use client';

import React from 'react';
import { useWorkflowHistory } from '@/apis/hooks/useWorkflowHistory';
import { fmtDateTime } from '@/utils/helpers';
import type { WorkflowStage } from '@/types/models';

/**
 * `action` on a history row is a free-form string — the engine emits both
 * lifecycle events (`workflow_started`) and the stage action a user took
 * (`approve`). Anything unmapped falls back to a humanised slug rather than
 * being hidden, so a new backend event type still reads sensibly here.
 */
const ACTION_LABEL: Record<string, string> = {
  workflow_started: 'Workflow started',
  workflow_closed: 'Workflow closed',
  workflow_held: 'Put on hold',
  workflow_resumed: 'Resumed',
  workflow_completed: 'Workflow completed',
  task_created: 'Stage opened',
  task_assigned: 'Stage assigned',
  task_reassigned: 'Reassigned',
  task_escalated: 'Escalated',
  review: 'Reviewed',
  approve: 'Approved',
  reject: 'Rejected',
  request_changes: 'Changes requested',
  delegate: 'Delegated',
  close: 'Closed',
};

const ACTION_TONE: Record<string, string> = {
  approve: 'var(--status-closed)',
  review: 'var(--status-closed)',
  workflow_closed: 'var(--status-closed)',
  workflow_completed: 'var(--status-closed)',
  reject: 'var(--status-overdue)',
  task_escalated: 'var(--status-overdue)',
  request_changes: 'var(--status-pending)',
  workflow_held: 'var(--status-pending)',
  delegate: 'var(--status-progress)',
  task_reassigned: 'var(--status-progress)',
  workflow_started: 'var(--status-progress)',
};

function humanise(action: string) {
  const words = action.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function fmtElapsed(seconds?: number | null) {
  if (!seconds || seconds < 60) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h in stage`;
  return h > 0 ? `${h}h ${m}m in stage` : `${m}m in stage`;
}

export interface WorkflowHistoryTimelineProps {
  workflowInstanceId?: string;
  /** Falls back to a document-wide trail when no instance id is known. */
  documentId?: string;
  /** Oversight screens pass `'all'`; leave unset so staff get the backend's `'mine'` default. */
  scope?: 'mine' | 'all';
  limit?: number;
  /** Stage list from the workflow definition, used to show names instead of raw stage ids. */
  stages?: WorkflowStage[];
  emptyMessage?: string;
}

export function WorkflowHistoryTimeline({
  workflowInstanceId,
  documentId,
  scope,
  limit = 50,
  stages,
  emptyMessage = 'No recorded activity yet.',
}: WorkflowHistoryTimelineProps) {
  const enabled = !!workflowInstanceId || !!documentId;

  const { data, isLoading, isError } = useWorkflowHistory(
    {
      ...(workflowInstanceId ? { workflowInstanceId } : {}),
      ...(!workflowInstanceId && documentId ? { documentId } : {}),
      ...(scope ? { scope } : {}),
      order: 'desc',
      limit,
    },
    { enabled },
  );

  const stageName = (id?: string | null) => {
    if (!id) return null;
    return stages?.find((s) => s.id === id)?.name || id;
  };

  if (!enabled) return <div className="caption">No workflow started for this document.</div>;
  if (isLoading) return <div className="caption">Loading activity…</div>;
  if (isError) return <div className="caption">Couldn&apos;t load the workflow trail.</div>;

  const records = data?.data || [];
  if (records.length === 0) return <div className="caption">{emptyMessage}</div>;

  return (
    <div>
      {records.map((r) => {
        const tone = ACTION_TONE[r.action] || 'var(--border-strong)';
        const from = stageName(r.fromStage);
        const to = stageName(r.toStage);
        const elapsed = fmtElapsed(r.elapsedSeconds);
        const move =
          from && to && from !== to ? `${from} → ${to}` : to || from || null;

        return (
          <div key={r.id} className="wf-stage" style={{ cursor: 'default' }}>
            <div
              className="wf-dot"
              style={{ background: tone, borderColor: tone, color: '#fff' }}
              aria-hidden="true"
            />
            <div className="wf-info" style={{ flex: 1, minWidth: 0 }}>
              <div className="nm">
                {ACTION_LABEL[r.action] || humanise(r.action)}
                {move && <span className="muted" style={{ fontWeight: 500 }}> · {move}</span>}
              </div>
              <div className="who">
                {r.actor?.name || 'System'} · {fmtDateTime(r.occurredAt)}
                {elapsed ? ` · ${elapsed}` : ''}
              </div>
              {r.note && <div className="wf-detail">{r.note}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
