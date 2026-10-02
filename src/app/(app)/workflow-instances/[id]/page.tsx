'use client';

import React, { Suspense, use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useUsers } from '@/apis/hooks/useUsers';
import { useTask } from '@/apis/hooks/useTasks';
import { useDocument } from '@/apis/hooks/useDocuments';
import { useWorkflowInstance } from '@/apis/hooks/useWorkflowInstances';
import { useWorkflowTaskActions } from '@/components/workflowInstances/useWorkflowTaskActions';
import { WorkflowDocumentViewer } from '@/components/workflowInstances/WorkflowDocumentViewer';
import { WorkflowActivityPanel } from '@/components/workflowInstances/WorkflowActivityPanel';
import { DocumentVersionsPanel } from '@/components/documents/DocumentVersionsPanel';
import { StatusBadge, UrgBadge } from '@/components/ui/Badges';
import { Icon } from '@/components/ui/Icons';
import { Spinner } from '@/components/common/Spinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { fmtDateTime } from '@/utils/helpers';
import type { Task, WorkflowInstanceStatus, WorkflowStageAction } from '@/types/models';

const STATUS_LABEL: Record<WorkflowInstanceStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  closed: 'Closed',
};

const ACTIVE_TASK_STATUSES = ['pending', 'escalated'];

/**
 * The workflow page — where a workflow's documents are reviewed and its
 * current stage is actioned. `/doc/[id]` is view-only; everything that moves a
 * workflow happens here.
 *
 * Reached from the task queue (`TaskRow`), the approvals queue, the workflow
 * monitors, and notification links (`/tasks/:id` forwards here with `?task=`).
 * The instance id is the stable URL — a task id changes every time the stage
 * moves, the instance's doesn't.
 */
export default function WorkflowInstancePage({ params }: { params: Promise<{ id: string }> }) {
  // useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense fallback={<Spinner text="Loading workflow…" />}>
      <WorkflowInstanceView params={params} />
    </Suspense>
  );
}

function WorkflowInstanceView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const taskParam = useSearchParams().get('task');
  const { currentUser: me } = useStore();
  const { setPageTitle } = useUIStore();
  const { can } = usePermissions();
  const { data: usersData } = useUsers();
  const users = usersData?.data || [];

  const { data: instance, isLoading, isError, refetch } = useWorkflowInstance(id);

  const isMineTask = (t: Pick<Task, 'assigneeId' | 'assignedRole'>) =>
    !!me &&
    (t.assigneeId === me.id || (!!t.assignedRole?.name && !!me.roles?.includes(t.assignedRole.name)));
  const isActiveTask = (t: Pick<Task, 'status' | 'stage'>) =>
    ACTIVE_TASK_STATUSES.includes(t.status) && t.stage === instance?.currentStage;

  // Which task this page is about: the one in the link if it's still live,
  // else the caller's own live task, else whoever holds the current stage,
  // else (a finished workflow) the most recent one — its document list is the
  // workflow's final set.
  const tasks = instance?.tasks ?? [];
  const linkedTask = tasks.find((t) => t.id === taskParam);
  const activeTasks = tasks.filter(isActiveTask);
  const latestTask = [...tasks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
  const focusTask =
    (linkedTask && isActiveTask(linkedTask) ? linkedTask : undefined) ??
    activeTasks.find(isMineTask) ??
    activeTasks[0] ??
    linkedTask ??
    latestTask;

  // `GET /tasks/:id` is what carries the documents. Someone who can see the
  // workflow but not its task (e.g. the document owner) gets a 403 here and
  // falls back to the primary document alone.
  const { data: taskDetail } = useTask(focusTask?.id ?? '');

  const documents = taskDetail?.documents?.length
    ? taskDetail.documents.map((s) => ({
        id: s.workflowInstanceDocument.documentId,
        title: s.workflowInstanceDocument.document.title,
        confidentiality: s.workflowInstanceDocument.document.confidentiality,
        versionNumber: s.documentVersion.versionNumber,
      }))
    : instance
      ? [
          {
            id: instance.documentId,
            title: instance.document?.title || 'Document',
            confidentiality: instance.document?.confidentiality || 'internal',
            versionNumber: undefined as number | undefined,
          },
        ]
      : [];

  const [selectedId, setSelectedId] = useState<string | undefined>();
  const selected = documents.find((d) => d.id === selectedId) ?? documents[0];

  // Only needed to know whether the selected document is viewable (the viewer
  // itself fetches it too — same query, deduplicated).
  const { data: selectedDoc } = useDocument(selected?.id ?? '');

  const workflowName = instance?.workflowDefinition?.name || 'Workflow';
  useEffect(() => {
    setPageTitle(workflowName);
  }, [workflowName, setPageTitle]);

  const stageDef = instance?.workflowDefinition?.definition?.stages?.find(
    (s) => s.id === instance?.currentStage,
  );
  const stageLabel = stageDef?.name || stageDef?.id || instance?.currentStage || 'Current stage';

  const canActPermission = can('task', 'action');
  const focusActive = !!focusTask && isActiveTask(focusTask);
  const focusMine = !!focusTask && isMineTask(focusTask);
  const canAct =
    !!me && instance?.status === 'in_progress' && focusActive && focusMine && canActPermission;
  const currentActorName =
    activeTasks[0]?.assignee?.name || activeTasks[0]?.assignedRole?.name || 'Unassigned';
  const disabledReason = !instance
    ? null
    : instance.status === 'closed'
      ? 'This workflow is closed'
      : instance.status === 'on_hold'
        ? 'This workflow is on hold'
        : !focusActive
          ? 'No action is pending on this workflow'
          : !focusMine
            ? `Assigned to ${currentActorName}`
            : !canActPermission
              ? "You don't have permission to act on tasks"
              : null;

  // Whatever the stage definition allows; approve/request-changes is only a
  // fallback when the definition didn't come back. `review` is dropped when
  // `approve` is also offered — it would advance the stage without a signature.
  const allowedRaw: WorkflowStageAction[] = stageDef?.actions?.length
    ? stageDef.actions
    : ['approve', 'request_changes'];
  // "Request changes" sends work back one stage, so it can't apply on the first
  // stage — the backend 409s (`WORKFLOW_PREVIOUS_STAGE_NOT_FOUND`). Hidden there
  // even if an older definition still lists it.
  const isFirstStage = instance?.workflowDefinition?.definition?.stages?.[0]?.id === instance?.currentStage;
  const allowedActions = allowedRaw.filter(
    (a, _i, arr) =>
      (a !== 'review' || !arr.includes('approve')) && !(a === 'request_changes' && isFirstStage),
  );

  const actions = useWorkflowTaskActions({
    taskId: canAct ? focusTask?.id : undefined,
    stageLabel,
    documents,
    selectedDocumentId: selected?.id,
    auditTargetId: instance?.documentId ?? id,
    instanceId: id,
    canAttachDocuments: can('workflow_instance', 'create'),
    uploadDefaults: {
      cabinetId: instance?.document?.cabinetId,
      confidentiality: instance?.document?.confidentiality,
      urgency: instance?.document?.urgency,
    },
    users,
    me: { id: me?.id ?? '', name: me?.name ?? '' },
  });

  if (isLoading) return <Spinner text="Loading workflow…" />;
  if (isError || !instance) {
    return (
      <ErrorMessage
        message="This workflow couldn't be opened — it may not exist, or you may not have access to it."
        retry={() => refetch()}
      />
    );
  }
  if (!me) return <Spinner text="Loading…" />;

  // Revisions an earlier stage asked for, still waiting on a new version.
  const pendingRevisions = taskDetail?.pendingDocumentRevisions ?? [];
  const revisionsFor = (documentId: string) =>
    pendingRevisions.filter((r) => r.workflowInstanceDocument.documentId === documentId);
  const selectedRevisions = selected ? revisionsFor(selected.id) : [];
  // Gated on what `POST /documents/:id/versions` actually checks —
  // `document_version:create` (staff hold it at `own` scope), not `document:edit`
  // (staff don't hold it at all, which used to hide this button from them).
  const canUploadRevision =
    canAct && selectedRevisions.length > 0 && can('document_version', 'create') && !!selectedDoc;

  const stageButtons: {
    action: WorkflowStageAction;
    label: string;
    kind: string;
    icon?: string;
    run: () => void;
  }[] = [
    { action: 'review', label: 'Mark reviewed', kind: 'btn-secondary', run: actions.actReview },
    {
      action: 'request_changes',
      label: 'Request changes',
      kind: 'btn-secondary',
      run: actions.actRequestChanges,
    },
    { action: 'delegate', label: 'Delegate', kind: 'btn-secondary', run: actions.actDelegate },
    { action: 'close', label: 'Close workflow', kind: 'btn-secondary', run: actions.actClose },
    { action: 'reject', label: 'Reject', kind: 'btn-danger', run: actions.actReject },
    { action: 'approve', label: 'Approve', kind: 'btn-success', icon: 'approve', run: actions.actApprove },
  ];

  return (
    <div>
      <div className="crumbs">
        <a onClick={() => router.push('/staff/tasks')}>My tasks</a> <span className="sep">›</span>
        <span className="cur">{workflowName}</span>
      </div>

      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="page-title" style={{ fontSize: '19px' }}>
            {instance.document?.title || workflowName}
          </div>
          <div className="flex gap-2 mt-2 flex-wrap items-center">
            <StatusBadge status={STATUS_LABEL[instance.status]} />
            {instance.document?.urgency && <UrgBadge level={instance.document.urgency} />}
            <span className="caption">
              {workflowName}
              {instance.workflowDefinition?.version ? ` v${instance.workflowDefinition.version}` : ''}{' '}
              · {documents.length} document{documents.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      {/* Stage actions */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {stageButtons
          .filter((b) => allowedActions.includes(b.action))
          .map((b) => (
            <button
              key={b.action}
              className={`btn ${b.kind}`}
              disabled={!canAct}
              title={!canAct && disabledReason ? disabledReason : b.label}
              onClick={b.run}
            >
              {b.icon && (
                <>
                  <Icon name={b.icon} size={14} />{' '}
                </>
              )}
              {b.label}
            </button>
          ))}
      </div>
      <div className="caption mb-4">
        {canAct
          ? `Your action is needed on “${stageLabel}”${focusTask?.dueAt ? ` — due ${fmtDateTime(focusTask.dueAt)}` : ''}.`
          : disabledReason}
      </div>

      {pendingRevisions.length > 0 && focusMine && focusActive && (
        <div className="banner warning">
          <span>
            <Icon name="edit" size={15} />
          </span>{' '}
          Changes were requested on{' '}
          {[...new Set(pendingRevisions.map((r) => r.workflowInstanceDocument.document.title))].join(
            ', ',
          )}
          . Upload a new version of each before moving this stage on.
        </div>
      )}

      {documents.length > 1 && (
        <div className="tabs" role="tablist" aria-label="Workflow documents">
          {documents.map((d) => (
            <button
              key={d.id}
              role="tab"
              aria-selected={d.id === selected?.id}
              className={`tab ${d.id === selected?.id ? 'active' : ''}`}
              onClick={() => setSelectedId(d.id)}
            >
              {d.title}
              {revisionsFor(d.id).length > 0 && (
                <span style={{ color: 'var(--status-pending)' }} title="Changes requested">
                  {' '}
                  ●
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        {/* Sticky on wide screens so the document stays in view while the
            right-hand column (revisions, versions, trail) scrolls past. */}
        <div className="flex flex-col gap-2 lg:sticky lg:top-4 self-start" style={{ minWidth: 0 }}>
          {selected && (
            <WorkflowDocumentViewer
              key={selected.id}
              documentId={selected.id}
              title={selected.title}
              confidentiality={selected.confidentiality}
              viewerId={me.id}
              viewerName={me.name}
            />
          )}
          {selected && selectedDoc && (
            <div className="caption">
              {selected.versionNumber !== undefined &&
                `Under review: v${selected.versionNumber}. `}
              <a style={{ cursor: 'pointer' }} onClick={() => router.push(`/doc/${selected.id}`)}>
                Open document page
              </a>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {selectedRevisions.length > 0 && (
            <div className="card">
              <div className="card-head">
                <span className="h3">Changes requested</span>
              </div>
              <div className="card-body">
                {selectedRevisions.map((r) => (
                  <div key={r.id} className="mb-2">
                    <div style={{ fontSize: '12.5px' }}>{r.comment || 'No reason given.'}</div>
                    <div className="caption">{fmtDateTime(r.createdAt)}</div>
                  </div>
                ))}
                {!canUploadRevision && (
                  <div className="caption">
                    The person holding this stage uploads the revised version.
                  </div>
                )}
              </div>
            </div>
          )}

          {selected && selectedDoc && (
            <DocumentVersionsPanel
              documentId={selected.id}
              currentVersionId={selectedDoc.currentVersionId}
              canView={can('document_version', 'view')}
              canEdit={false}
              canUploadVersion={canUploadRevision}
              getUploaderName={(userId) => users.find((u) => u.id === userId)?.name || 'User'}
            />
          )}

          <WorkflowActivityPanel workflowInstance={instance} currentStageActorName={currentActorName} />
        </div>
      </div>
    </div>
  );
}
