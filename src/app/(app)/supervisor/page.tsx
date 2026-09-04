'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useTasks, useReassignTask } from '@/apis/hooks/useTasks';
import {
  useTeamStatusMatrix,
  useOpenItemsByCabinet,
} from '@/apis/hooks/useWorkflowInstances';
import { useUsers } from '@/apis/hooks/useUsers';
import { useCreateAuditLog } from '@/apis/hooks/useAudit';
import { Spinner } from '@/components/common/Spinner';
import { Icon } from '@/components/ui/Icons';
import { Table, Column } from '@/components/ui/Table';
import { Avatar } from '@/components/ui/Avatar';
import { HBarChart } from '@/components/ui/Charts';
import { StatusBadge } from '@/components/ui/Badges';
import { exportCsv } from '@/utils/exportCsv';
import { Task, WorkflowTeamStatusMember } from '@/types/models';

export default function SupervisorDashboard() {
  const router = useRouter();
  const { setPageTitle, openModal, closeModal, openDrawer, closeDrawer, addToast } = useUIStore();

  // Both endpoints omit departmentId — the backend resolves the supervisor's
  // own department automatically. See the Workflow Module API guide §4.
  const { data: members, isLoading: isLoadingMatrix } = useTeamStatusMatrix();
  const { data: byCabinetData, isLoading: isLoadingByCabinet } = useOpenItemsByCabinet();
  const { data: usersData, isLoading: isLoadingUsers } = useUsers();

  const users = usersData?.data || [];
  const byCabinet = byCabinetData?.cabinets || [];

  const reassignTask = useReassignTask();
  const createAuditLog = useCreateAuditLog();

  useEffect(() => {
    setPageTitle('Team Overview');
  }, [setPageTitle]);

  if (isLoadingMatrix || isLoadingByCabinet || isLoadingUsers) return <Spinner />;

  const team = members || [];

  const totals = team.reduce(
    (acc, m) => ({
      pending: acc.pending + m.pending,
      inProgress: acc.inProgress + m.inProgress,
      overdue: acc.overdue + m.overdue,
      closed: acc.closed + m.closed,
    }),
    { pending: 0, inProgress: 0, overdue: 0, closed: 0 },
  );

  const tiles = [
    { label: 'Pending', val: totals.pending, cls: 't-pending', ico: 'clock' },
    { label: 'In Progress', val: totals.inProgress, cls: 't-progress', ico: 'pulse' },
    { label: 'Closed (30d)', val: totals.closed, cls: 't-closed', ico: 'check' },
    { label: 'Overdue / SLA', val: totals.overdue, cls: 't-overdue', ico: 'alert' },
  ];

  const byCab = byCabinet
    .filter((c) => c.openItems > 0)
    .map((c) => ({
      label: c.cabinetName,
      value: c.openItems,
      color: 'var(--brand-primary-light)',
      onClick: () => router.push(`/staff/cabinets?cabinetId=${c.cabinetId}`),
    }));

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

  const handleRowClick = (m: WorkflowTeamStatusMember) => {
    openDrawer({
      title: `${m.memberName} — open items`,
      body: (
        <MemberDrawerBody
          member={m}
          onReassign={(t) => handleReassignModal(t, () => handleRowClick(m))}
          onOpenDocument={(docId) => {
            closeDrawer();
            router.push(`/doc/${docId}`);
          }}
        />
      ),
    });
  };

  const cols: Column<WorkflowTeamStatusMember>[] = [
    {
      key: 'memberName',
      label: 'Member',
      render: (r) => (
        <span className="flex aic g8">
          <Avatar user={{ name: r.memberName }} sm />
          <span>
            <div style={{ fontWeight: 700 }}>{r.memberName}</div>
            <div className="caption">{r.departmentName || '—'}</div>
          </span>
        </span>
      ),
    },
    { key: 'pending', label: 'Pending', num: true, sortable: true },
    { key: 'inProgress', label: 'In Prog.', num: true, sortable: true },
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
              onClick={() => exportCsv('Team_Overview_Matrix', team)}
            >
              Export
            </button>
          </div>
          <Table cols={cols} rows={team} onRow={handleRowClick} />
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

/**
 * The matrix only carries counts, so a member's open items are fetched here
 * on demand when their drawer opens — a standalone component (not a closure
 * inside the page) so it keeps rendering itself as the query resolves,
 * independent of whatever else re-renders the dashboard.
 */
function MemberDrawerBody({
  member,
  onReassign,
  onOpenDocument,
}: {
  member: WorkflowTeamStatusMember;
  onReassign: (task: Task) => void;
  onOpenDocument: (documentId: string) => void;
}) {
  const { data, isLoading } = useTasks({
    assigneeId: member.memberId,
    status: 'pending',
    scope: 'all',
    limit: 100,
  });
  const tasks = data?.data || [];

  return (
    <div>
      <div className="flex aic g12 mb16">
        <Avatar user={{ name: member.memberName }} />
        <div>
          <b style={{ fontSize: '14px', color: 'var(--ink)' }}>{member.memberName}</b>
          <div className="caption">
            {member.memberEmail} · {member.departmentName || 'No department'}
          </div>
        </div>
      </div>

      {isLoading ? (
        <Spinner text="Loading open items…" />
      ) : tasks.length > 0 ? (
        <div className="rowlist">
          {tasks.map((t) => {
            const doc = t.workflowInstance?.document;
            const overdue = !!(t.dueAt && new Date(t.dueAt) < new Date());
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
                onClick={() => doc?.id && onOpenDocument(doc.id)}
              >
                <div className="task-main">
                  <div
                    className="task-title"
                    style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}
                  >
                    {doc?.title || 'Unknown document'}
                  </div>
                  <div className="task-meta flex aic g8">
                    <StatusBadge status={overdue ? 'Overdue' : 'Pending'} />
                  </div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginLeft: '12px', flexShrink: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReassign(t);
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
  );
}
