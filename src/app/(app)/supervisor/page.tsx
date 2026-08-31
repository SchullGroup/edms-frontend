'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useAllTasks, useReassignTask } from '@/apis/hooks/useTasks';
import { useUsers } from '@/apis/hooks/useUsers';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { useCreateAuditLog } from '@/apis/hooks/useAudit';
import { Spinner } from '@/components/common/Spinner';
import { Icon } from '@/components/ui/Icons';
import { Table, Column } from '@/components/ui/Table';
import { Avatar } from '@/components/ui/Avatar';
import { HBarChart } from '@/components/ui/Charts';
import { StatusBadge, UrgBadge } from '@/components/ui/Badges';
import { exportCsv } from '@/utils/exportCsv';
import { Task } from '@/types/models';

export default function SupervisorDashboard() {
  const router = useRouter();
  const { setPageTitle, openModal, closeModal, openDrawer, closeDrawer, addToast } = useUIStore();

  // No backend concept of "my team" exists yet, so this shows the first 5
  // users returned by the API against tenant-wide tasks — not a real
  // reporting-line relationship. Consistent with workload/bottlenecks.
  const { data: tasksResult, isLoading: isLoadingTasks } = useAllTasks({});
  const { data: usersData, isLoading: isLoadingUsers } = useUsers();
  const { data: cabsData, isLoading: isLoadingCabs } = useCabinets();

  const tasks = tasksResult?.items || [];
  const users = usersData?.data || [];
  const cabinets = cabsData?.data || [];

  const reassignTask = useReassignTask();
  const createAuditLog = useCreateAuditLog();

  useEffect(() => {
    setPageTitle('Team Overview');
  }, [setPageTitle]);

  if (isLoadingTasks || isLoadingUsers || isLoadingCabs) return <Spinner />;

  const team = users.slice(0, 5);
  const teamIds = new Set(team.map((u) => u.id));
  const teamTasks = tasks.filter((t: Task) => !!t.assigneeId && teamIds.has(t.assigneeId));

  const isOverdue = (t: Task): boolean =>
    !!(t.status === 'pending' && t.dueAt && new Date(t.dueAt) < new Date());
  // Tasks have no separate "in progress" state — pending covers both, same
  // convention used on the staff dashboard.
  const countPending = (arr: Task[]) => arr.filter((t) => t.status === 'pending').length;
  const countClosed = (arr: Task[]) => arr.filter((t) => t.status === 'completed').length;
  const countOverdue = (arr: Task[]) => arr.filter(isOverdue).length;

  const tiles = [
    { label: 'Pending', val: countPending(teamTasks), cls: 't-pending', ico: 'clock' },
    { label: 'In Progress', val: countPending(teamTasks), cls: 't-progress', ico: 'pulse' },
    { label: 'Closed (30d)', val: countClosed(teamTasks), cls: 't-closed', ico: 'check' },
    { label: 'Overdue / SLA', val: countOverdue(teamTasks), cls: 't-overdue', ico: 'alert' },
  ];

  const matrix = team.map((u) => {
    const mt = tasks.filter((t: Task) => t.assigneeId === u.id);
    return {
      uid: u.id,
      name: u.name,
      dept: (u as any)?.departmentId || '',
      pending: countPending(mt),
      progress: countPending(mt),
      overdue: countOverdue(mt),
      closed: countClosed(mt),
      total: mt.length,
    };
  });

  const byCab = cabinets
    .map((c) => ({
      label: c.name,
      value: teamTasks.filter(
        (t: Task) => t.workflowInstance?.document?.cabinetId === c.id && t.status === 'pending',
      ).length,
      color: 'var(--brand-primary-light)',
      onClick: () => router.push(`/cabinets?cab=${c.id}`),
    }))
    .filter((c) => c.value > 0);

  const handleReassignModal = (t: Task, onDone?: () => void) => {
    let newAssignee = '';
    let note = '';
    const title = t.workflowInstance?.document?.title || 'this document';

    openModal({
      title: `Reassign — ${title.slice(0, 44)}${title.length > 44 ? '…' : ''}`,
      body: (
        <div>
          <div className="field mb12">
            <label>Current Assignee</label>
            <input
              className="input"
              disabled
              value={t.assignee?.name || t.assignedRole?.name || 'Unassigned'}
            />
          </div>
          <div className="field mb12">
            <label>
              New Assignee <span className="req">*</span>
            </label>
            <select className="input" onChange={(e) => (newAssignee = e.target.value)}>
              <option value="">Select team member...</option>
              {users
                .filter((u) => u.status === 'active' && u.id !== t.assigneeId)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({(u as any).departmentId || 'System'})
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label>Handover Note</label>
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
            const newUser = users.find((u) => u.id === newAssignee);

            reassignTask.mutate(
              { id: t.id, assigneeId: newAssignee, note: note || undefined },
              {
                onSuccess: () => {
                  createAuditLog.mutate({
                    action: 'REASSIGN',
                    target: t.workflowInstance?.documentId || t.id,
                    detail: `Reassigned from ${prevName} to ${newUser?.name}${note ? ` (Note: ${note})` : ''}`,
                  });
                  addToast(`Reassigned to ${newUser?.name}`, 'success');
                  closeModal();
                  if (onDone) onDone();
                },
              },
            );
          },
        },
      ],
    });
  };

  const handleRowClick = (r: { name: string; uid: string; dept: string }) => {
    const member = users.find((u) => u.id === r.uid);
    const mTasks = tasks.filter((t: Task) => t.assigneeId === r.uid && t.status === 'pending');

    openDrawer({
      title: `${r.name} — open items`,
      body: (
        <div>
          <div className="flex aic g12 mb16">
            <Avatar user={{ name: r.name }} />
            <div>
              <b style={{ fontSize: '14px', color: 'var(--ink)' }}>{r.name}</b>
              <div className="caption">
                {member?.email || ''} · {r.dept}
              </div>
            </div>
          </div>

          {mTasks.length > 0 ? (
            <div className="rowlist">
              {mTasks.map((t: Task) => {
                const doc = t.workflowInstance?.document;
                return (
                  <div
                    key={t.id}
                    className="task-row"
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '9px',
                      marginBottom: '8px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      closeDrawer();
                      if (doc?.id) router.push(`/doc/${doc.id}`);
                    }}
                  >
                    <div className="task-main">
                      <div
                        className="task-title"
                        style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}
                      >
                        {doc?.title || 'Unknown document'}
                      </div>
                      <div className="task-meta flex aic g8">
                        <StatusBadge status={isOverdue(t) ? 'Overdue' : 'Pending'} />
                        {doc?.urgency && <UrgBadge level={doc.urgency} />}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ marginLeft: '12px', flexShrink: 0 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReassignModal(t, () => handleRowClick(r));
                      }}
                    >
                      Reassign
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty" style={{ padding: '32px 16px' }}>
              <Icon name="approve" size={32} />
              <div className="h3 mt16 mb8">No open items</div>
              <p className="caption">This member’s queue is clear.</p>
            </div>
          )}
        </div>
      ),
    });
  };

  const cols: Column<any>[] = [
    {
      key: 'name',
      label: 'Member',
      render: (r) => (
        <span className="flex aic g8">
          <Avatar user={{ name: r.name }} sm />
          <span>
            <div style={{ fontWeight: 700 }}>{r.name}</div>
            <div className="caption">{r.dept}</div>
          </span>
        </span>
      ),
    },
    { key: 'pending', label: 'Pending', num: true, sortable: true },
    { key: 'progress', label: 'In Prog.', num: true, sortable: true },
    {
      key: 'overdue',
      label: 'Overdue',
      num: true,
      sortable: true,
      render: (r) => (
        <span style={r.overdue ? { color: 'var(--status-overdue)', fontWeight: 800 } : undefined}>
          {r.overdue}
        </span>
      ),
    },
    { key: 'closed', label: 'Closed', num: true, sortable: true },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Team Overview</div>
          <div className="page-sub">
            Live status across your team and cabinets. Click through to detail.
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => router.push('/supervisor/approvals')}>
            <Icon name="approve" size={15} /> Approvals queue
          </button>
        </div>
      </div>

      <div className="grid cols-4 mb16">
        {tiles.map((t, i) => (
          <div
            key={i}
            className={`tile ${t.cls}`}
            role="button"
            tabIndex={0}
            onClick={() =>
              router.push(
                t.label.startsWith('Overdue') ? '/supervisor/bottlenecks' : '/supervisor/workload',
              )
            }
          >
            <div className="cnt">{t.val}</div>
            <div className="lbl">
              <Icon name={t.ico} size={13} /> {t.label}
            </div>
          </div>
        ))}
      </div>

      <div className="dash-body">
        <div className="card">
          <div className="card-head">
            <span className="h3">Member × status matrix</span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => exportCsv('Team_Overview_Matrix', matrix)}
            >
              Export
            </button>
          </div>
          <Table cols={cols} rows={matrix} onRow={handleRowClick} />
        </div>

        <div className="card">
          <div className="card-head">
            <span className="h3">Open items by cabinet</span>
          </div>
          <div className="card-body">
            <HBarChart items={byCab} />
          </div>
        </div>
      </div>
    </div>
  );
}
