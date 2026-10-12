'use client';

import React from 'react';
import { useWorkflowInstance } from '@/apis/hooks/useWorkflowInstances';
import { useWorkflowInstanceLifecycle } from '@/hooks/useWorkflowInstanceLifecycle';
import { WorkflowStageProgress } from './WorkflowStageProgress';
import { WorkflowHistoryTimeline } from './WorkflowHistoryTimeline';
import { useWorkflowDocumentPositions } from './useWorkflowDocumentPositions';
import { StatusBadge } from '@/components/ui/Badges';
import { Skeleton, SkeletonText } from '@/components/common/Skeleton';
import { fmtDateTime } from '@/utils/helpers';
import type { WorkflowInstanceStatus } from '@/types/models';

const STATUS_LABEL: Record<WorkflowInstanceStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  closed: 'Closed',
};

export interface WorkflowInstanceDetailProps {
  instanceId: string;
  onOpenDocument?: (documentId: string) => void;
  /** Shows an "Open workflow" button that leads to the full workflow page. */
  onOpenWorkflow?: (instanceId: string) => void;
}

/**
 * Drawer body for one running workflow. The single-instance GET is the only
 * response that embeds both `tasks[]` and the definition's stage list, so this
 * refetches by id rather than taking a row from the list response.
 */
export function WorkflowInstanceDetail({
  instanceId,
  onOpenDocument,
  onOpenWorkflow,
}: WorkflowInstanceDetailProps) {
  const { data: instance, isLoading } = useWorkflowInstance(instanceId);
  const { confirmHold, confirmResume, confirmClose, isPending } = useWorkflowInstanceLifecycle();
  // The monitor is an oversight view, so read the whole trail.
  const { positions } = useWorkflowDocumentPositions(instance, 'all');

  if (isLoading) return <WorkflowInstanceDetailSkeleton />;
  if (!instance) return <div className="caption">This workflow instance could not be loaded.</div>;

  const stages = instance.workflowDefinition?.definition?.stages;
  const pendingTask = instance.tasks?.find((t) => t.status === 'pending');
  const actorName = pendingTask?.assignee?.name || pendingTask?.assignedRole?.name || 'Unassigned';
  const closed = instance.status === 'closed';
  const nearestDue = positions
    .flatMap((p) => p.active.map((e) => e.stageDueAt))
    .filter((d): d is string => !!d)
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
  const documents = instance.documents ?? [];

  return (
    <div>
      <div className="flex gap-2 items-center flex-wrap mb-4">
        <StatusBadge status={STATUS_LABEL[instance.status]} />
        <span className="caption">
          {instance.workflowDefinition?.name || 'Workflow'}
          {instance.workflowDefinition?.version ? ` v${instance.workflowDefinition.version}` : ''}
        </span>
        {onOpenWorkflow && (
          <button
            className="btn btn-primary btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => onOpenWorkflow(instance.id)}
          >
            Open workflow
          </button>
        )}
      </div>

      <div className="field">
        <label>{documents.length === 1 ? 'Document' : `Documents (${documents.length})`}</label>
        {documents.map((d) => {
          const documentId = d.documentId ?? d.document.id;
          return (
            <div key={d.id}>
              {onOpenDocument ? (
                <a
                  onClick={() => onOpenDocument(documentId)}
                  style={{ fontWeight: 700, cursor: 'pointer' }}
                >
                  {d.document.title || documentId}
                </a>
              ) : (
                <b>{d.document.title || documentId}</b>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 flex-wrap mb-4">
        <div>
          <div className="caption">Started</div>
          <div style={{ fontSize: '12.5px', fontWeight: 600 }}>
            {fmtDateTime(instance.startedAt)}
          </div>
        </div>
        {instance.closedAt && (
          <div>
            <div className="caption">Closed</div>
            <div style={{ fontSize: '12.5px', fontWeight: 600 }}>
              {fmtDateTime(instance.closedAt)}
            </div>
          </div>
        )}
      </div>

      <div className="divider"></div>
      <div className="h3 mb-2">Stages</div>
      {stages?.length ? (
        <WorkflowStageProgress
          stages={stages}
          positions={positions}
          status={instance.status}
          currentActorName={actorName}
        />
      ) : (
        <div className="caption">
          The workflow definition wasn&apos;t returned with this instance, so the stage list
          can&apos;t be shown.
        </div>
      )}

      {pendingTask && (
        <div className="wf-detail">
          <b>Waiting on {actorName}</b>
          {nearestDue ? ` · next due ${fmtDateTime(nearestDue)}` : ''}
        </div>
      )}

      <div className="divider"></div>
      <div className="h3 mb-2">Activity trail</div>
      <WorkflowHistoryTimeline
        workflowInstanceId={instance.id}
        scope="all"
        stages={stages}
        emptyMessage="Nothing has happened on this workflow yet."
      />

      {!closed && (
        <>
          <div className="divider"></div>
          <div className="flex gap-2 flex-wrap">
            {instance.status === 'on_hold' ? (
              <button
                className="btn btn-secondary btn-sm"
                disabled={isPending}
                onClick={() => confirmResume(instance)}
              >
                Resume
              </button>
            ) : (
              <button
                className="btn btn-secondary btn-sm"
                disabled={isPending}
                onClick={() => confirmHold(instance)}
              >
                Put on hold
              </button>
            )}
            <button
              className="btn btn-danger btn-sm"
              disabled={isPending}
              onClick={() => confirmClose(instance)}
            >
              Close workflow
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Mirrors the loaded drawer's shape — status line, fields, stage rail, and a
 *  couple of trail entries — instead of a spinner with no sense of layout. */
function WorkflowInstanceDetailSkeleton() {
  return (
    <div>
      <div className="flex gap-2 items-center flex-wrap mb-4">
        <Skeleton height={20} width={80} radius={99} />
        <Skeleton height={12} width={120} />
      </div>

      <div className="field">
        <label>Document</label>
        <Skeleton height={14} width="70%" />
      </div>

      <div className="flex gap-3 flex-wrap mb-4">
        <Skeleton height={30} width={100} />
      </div>

      <div className="divider"></div>
      <div className="h3 mb-2">Stages</div>
      {/* Wrapped so `.wf-stage:last-child` drops the last connector. */}
      <div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="wf-stage" style={{ cursor: 'default' }} aria-hidden="true">
            <Skeleton width={24} height={24} circle />
            <div className="wf-info" style={{ flex: 1 }}>
              <Skeleton height={12} width="55%" style={{ marginBottom: '5px' }} />
              <Skeleton height={10} width="30%" />
            </div>
          </div>
        ))}
      </div>

      <div className="divider"></div>
      <div className="h3 mb-2">Activity trail</div>
      <SkeletonText lines={4} />
    </div>
  );
}
