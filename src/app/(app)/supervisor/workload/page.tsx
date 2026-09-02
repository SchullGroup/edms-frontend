'use client';

import React, { useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useAllTasks, useReassignTask } from '@/apis/hooks/useTasks';
import { useUsers } from '@/apis/hooks/useUsers';
import { useCreateAuditLog } from '@/apis/hooks/useAudit';
import { Spinner } from '@/components/common/Spinner';
import { TaskRow } from '@/components/ui/TaskRow';

export default function WorkloadPage() {
  // No backend concept of "my team" exists yet, so this shows the first 5
  // users returned by the API against tenant-wide open tasks — not a real
  // reporting-line relationship.
  const { data: tasksResult, isLoading: isLoadingTasks } = useAllTasks({ status: 'pending' });
  const { data: usersData, isLoading: isLoadingUsers } = useUsers();
  const tasks = tasksResult?.items || [];
  const users = usersData?.data || [];

  const reassignTask = useReassignTask();
  const createAuditLog = useCreateAuditLog();

  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();

  useEffect(() => {
    setPageTitle('Workload & Reassign');
  }, [setPageTitle]);

  if (isLoadingTasks || isLoadingUsers) return <Spinner />;

  const team = users.slice(0, 5); // mock team
  const cap = 8;

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
            Per-member load against capacity. Reassign directly from any row.
          </div>
        </div>
      </div>

      <div>
        {team.map((u) => {
          const open = tasks.filter((t: any) => t.assigneeId === u.id);
          const pct = Math.min(100, Math.round((open.length / cap) * 100));
          const color =
            pct >= 90
              ? 'var(--status-overdue)'
              : pct >= 65
                ? 'var(--status-pending)'
                : 'var(--status-closed)';

          return (
            <div key={u.id} className="card card-pad mb16">
              <div className="flex jcb aic wrap g12">
                <div className="flex aic g12">
                  <div className="avatar">{u.name.charAt(0)}</div>
                  <div>
                    <b>{u.name}</b>
                    <div className="caption">
                      {(u as any).departmentId || 'System'} · {open.length} open / capacity {cap}
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
              </div>

              {open.length > 0 && (
                <div className="rowlist mt8" style={{ borderTop: '1px solid var(--border)' }}>
                  {open.map((t: any) => (
                    <TaskRow
                      key={t.id}
                      item={t}
                      extraActions={
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReassign(t);
                          }}
                        >
                          Reassign
                        </button>
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
