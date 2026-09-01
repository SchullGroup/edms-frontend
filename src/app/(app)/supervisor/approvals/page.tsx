'use client';

import React, { useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useTasks, useTaskAction, useReassignTask } from '@/apis/hooks/useTasks';
import { useUsers } from '@/apis/hooks/useUsers';
import { useCreateAuditLog } from '@/apis/hooks/useAudit';
import { Spinner } from '@/components/common/Spinner';
import { TaskRow } from '@/components/ui/TaskRow';
import { Icon } from '@/components/ui/Icons';

const URG_ORDER: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };

export default function ApprovalsQueuePage() {
  const { data: tasksData, isLoading: isLoadingTasks } = useTasks({ scope: 'mine', status: 'pending' });
  const { data: usersData, isLoading: isLoadingUsers } = useUsers();
  const tasks = tasksData?.data || [];
  const users = usersData?.data || [];

  const taskAction = useTaskAction();
  const reassignTask = useReassignTask();
  const createAuditLog = useCreateAuditLog();

  const { setPageTitle, openModal, closeModal, openConfirm, addToast } = useUIStore();

  useEffect(() => {
    setPageTitle('Approvals Queue');
  }, [setPageTitle]);

  if (isLoadingTasks || isLoadingUsers) return <Spinner />;

  const queue = [...tasks].sort((a: any, b: any) => {
    const ua = URG_ORDER[a.workflowInstance?.document?.urgency] ?? 2;
    const ub = URG_ORDER[b.workflowInstance?.document?.urgency] ?? 2;
    return ua - ub;
  });

  const handleApprove = (t: any) => {
    const title = t.workflowInstance?.document?.title || 'this document';
    openConfirm({
      title: `Approve “${title.slice(0, 40)}…”?`,
      message:
        'The current stage completes and the file advances. Your decision is recorded in the immutable audit trail.',
      confirmLabel: 'Approve',
      onConfirm: () => {
        taskAction.mutate(
          { id: t.id, actionReq: { action: 'approve' } },
          {
            onSuccess: () => {
              createAuditLog.mutate({
                action: 'APPROVE',
                target: t.workflowInstance?.documentId || t.id,
                detail: 'Approved via approvals queue',
              });
              addToast('Approved', 'success');
            },
          },
        );
      },
    });
  };

  const handleReassign = (t: any) => {
    let newAssignee = '';
    let note = '';
    const title = t.workflowInstance?.document?.title || 'this document';
    openModal({
      title: `Reassign — ${title.slice(0, 44)}${title.length > 44 ? '…' : ''}`,
      body: (
        <div>
          <div className="field">
            <label>Current assignee</label>
            <input className="input" disabled value={t.assignee?.name || t.assignedRole?.name || ''} />
          </div>
          <div className="field">
            <label>New assignee</label>
            <select className="input" onChange={(e) => (newAssignee = e.target.value)}>
              <option value="">Select user...</option>
              {users
                .filter((u) => u.status === 'active' && u.id !== t.assigneeId)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label>Note</label>
            <input
              className="input"
              placeholder="Optional handover note"
              onChange={(e) => (note = e.target.value)}
            />
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Reassign',
          kind: 'btn-primary',
          onClick: () => {
            if (!newAssignee) {
              addToast('Please select a new assignee', 'error');
              return;
            }
            const prevName = t.assignee?.name || t.assignedRole?.name || 'previous assignee';
            const newName = users.find((u) => u.id === newAssignee)?.name || 'new assignee';
            reassignTask.mutate(
              { id: t.id, assigneeId: newAssignee, note: note || undefined },
              {
                onSuccess: () => {
                  createAuditLog.mutate({
                    action: 'REASSIGN',
                    target: t.workflowInstance?.documentId || t.id,
                    detail: `Reassigned from ${prevName} to ${newName}`,
                  });
                  addToast(`Reassigned to ${newName}`, 'success');
                  closeModal();
                },
              },
            );
          },
        },
      ],
    });
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Approvals Queue</div>
          <div className="page-sub">
            Items awaiting your decision — approve inline or open for full context.
          </div>
        </div>
      </div>

      <div className="card">
        {queue.length > 0 ? (
          <div className="rowlist">
            {queue.map((t: any) => (
              <TaskRow
                key={t.id}
                item={t}
                extraActions={
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprove(t);
                      }}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReassign(t);
                      }}
                    >
                      Reassign
                    </button>
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <div className="empty">
            <Icon name="approve" size={32} />
            <div className="h3 mt16 mb8">Approvals queue is clear</div>
            <p className="caption mb16">
              Items routed for your decision will appear here, ordered by urgency and SLA.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
