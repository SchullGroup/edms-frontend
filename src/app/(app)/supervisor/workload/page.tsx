'use client';

import React, { useEffect, useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useTaskWorkload, useTasks, useReassignTask } from '@/apis/hooks/useTasks';
import { useUsers } from '@/apis/hooks/useUsers';
import { useCreateAuditLog } from '@/apis/hooks/useAudit';
import { Spinner } from '@/components/common/Spinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { TaskRow } from '@/components/ui/TaskRow';
import { Icon } from '@/components/ui/Icons';
import { Task, TaskWorkloadMember } from '@/types/models';

export default function WorkloadPage() {
  // Real per-member capacity/utilization from the backend — only directly
  // assigned, active, current-stage tasks count; role-pool tasks aren't
  // duplicated across every holder of the role. Omit departmentId; the
  // backend resolves the supervisor's own department automatically.
  const {
    data: workload,
    isLoading: isLoadingWorkload,
    isError: isWorkloadError,
    refetch: refetchWorkload,
  } = useTaskWorkload();
  const { data: usersData, isLoading: isLoadingUsers } = useUsers();
  const users = usersData?.data || [];

  const reassignTask = useReassignTask();
  const createAuditLog = useCreateAuditLog();

  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();

  useEffect(() => {
    setPageTitle('Workload & Reassign');
  }, [setPageTitle]);

  const handleReassign = (t: Task) => {
    let newAssignee = '';
    let note = '';
    const title = t.workflowInstance?.document?.title || 'this document';
    openModal({
      title: `Reassign — ${title.slice(0, 44)}${title.length > 44 ? '…' : ''}`,
      body: (
        <div>
          <div className="field">
            <label>Current assignee</label>
            <input
              className="input"
              disabled
              value={t.assignee?.name || t.assignedRole?.name || ''}
            />
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
          <div className="page-title">Workload & Reassign</div>
          <div className="page-sub">
            Per-member load against capacity. Expand a row to reassign directly from it.
          </div>
        </div>
      </div>

      {isLoadingWorkload || isLoadingUsers ? (
        <Spinner />
      ) : isWorkloadError ? (
        <ErrorMessage message="Failed to load workload" retry={() => refetchWorkload()} />
      ) : (
        <div>
          {(workload?.members || []).map((m) => (
            <WorkloadMemberCard key={m.memberId} member={m} onReassign={handleReassign} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A member's open tasks are only fetched once the row is expanded — the
 * workload summary above already gives real counts/capacity without walking
 * every task in the tenant.
 */
function WorkloadMemberCard({
  member,
  onReassign,
}: {
  member: TaskWorkloadMember;
  onReassign: (task: Task) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useTasks(
    { assigneeId: member.memberId, status: 'pending', scope: 'all', limit: 100 },
    { enabled: expanded },
  );
  const tasks = data?.data || [];

  const pct = Math.min(100, Math.round(member.utilizationPercent));
  const color =
    pct >= 90 ? 'var(--status-overdue)' : pct >= 65 ? 'var(--status-pending)' : 'var(--status-closed)';

  return (
    <div className="card card-pad mb16">
      <div
        className="flex jcb aic wrap g12"
        style={{ cursor: 'pointer' }}
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex aic g12">
          <div className="avatar">{member.memberName.charAt(0)}</div>
          <div>
            <b>{member.memberName}</b>
            <div className="caption">
              {member.departmentName || 'No department'} · {member.open} open / capacity{' '}
              {member.capacity}
              {member.overdue > 0 && (
                <span style={{ color: 'var(--status-overdue)' }}> · {member.overdue} overdue</span>
              )}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: '160px', maxWidth: '300px' }}>
          <div
            className="pbar"
            style={{
              height: '8px',
              background: 'var(--bg-body)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <i
              style={{
                display: 'block',
                height: '100%',
                width: `${pct}%`,
                background: color,
              }}
            />
          </div>
        </div>
        <span
          className="tnum"
          style={{
            fontWeight: 800,
            color: pct >= 90 ? 'var(--status-overdue)' : 'inherit',
          }}
        >
          {pct}%
        </span>
        <Icon name={expanded ? 'chevD' : 'chevR'} size={14} />
      </div>

      {expanded && (
        <div className="rowlist mt8" style={{ borderTop: '1px solid var(--border)' }}>
          {isLoading ? (
            <Spinner text="Loading tasks…" />
          ) : tasks.length > 0 ? (
            tasks.map((t) => (
              <TaskRow
                key={t.id}
                item={t}
                extraActions={
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReassign(t);
                    }}
                  >
                    Reassign
                  </button>
                }
              />
            ))
          ) : (
            <p className="caption" style={{ padding: '12px 0' }}>
              No open tasks.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
