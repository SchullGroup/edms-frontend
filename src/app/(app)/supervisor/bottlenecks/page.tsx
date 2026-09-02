'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useAllTasks, useReassignTask } from '@/apis/hooks/useTasks';
import { useUsers } from '@/apis/hooks/useUsers';
import { useCreateAuditLog } from '@/apis/hooks/useAudit';
import { Spinner } from '@/components/common/Spinner';
import { HBarChart } from '@/components/ui/Charts';
import { Table, Column } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icons';
import { StatusBadge } from '@/components/ui/Badges';

export default function BottlenecksPage() {
  const router = useRouter();

  // No backend concept of "my team" exists yet, so this is tenant-wide open
  // work, not scoped to a specific supervisor's reports.
  const { data: tasksResult, isLoading: isLoadingTasks } = useAllTasks({ status: 'pending' });
  const { data: usersData, isLoading: isLoadingUsers } = useUsers();
  const tasks = tasksResult?.items || [];
  const users = usersData?.data || [];

  const reassignTask = useReassignTask();
  const createAuditLog = useCreateAuditLog();
  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();

  useEffect(() => {
    setPageTitle('Bottlenecks & Ageing');
  }, [setPageTitle]);

  if (isLoadingTasks || isLoadingUsers) return <Spinner />;

  const aged = tasks
    .map((t: any) => ({
      t,
      ageDays: Math.floor((Date.now() - new Date(t.createdAt).getTime()) / 86400000),
      stage: t.stage || '—',
      overdue: !!(t.dueAt && new Date(t.dueAt) < new Date()),
    }))
    .sort((a, b) => b.ageDays - a.ageDays);

  const breaches = aged.filter((a) => a.overdue);

  const buckets = [
    { label: '0–3 days', value: aged.filter(a => a.ageDays <= 3).length, color: 'var(--status-closed)' },
    { label: '4–7 days', value: aged.filter(a => a.ageDays > 3 && a.ageDays <= 7).length, color: 'var(--status-pending)' },
    { label: '8–14 days', value: aged.filter(a => a.ageDays > 7 && a.ageDays <= 14).length, color: 'var(--brand-accent)' },
    { label: '15+ days', value: aged.filter(a => a.ageDays > 14).length, color: 'var(--status-overdue)' }
  ];

  const byStage: Record<string, number> = {};
  aged.forEach(a => { byStage[a.stage] = (byStage[a.stage] || 0) + 1; });
  const stageItems = Object.entries(byStage).map(([label, value]) => ({ label, value, color: 'var(--brand-primary-light)' }));

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
            <select className="input" onChange={e => newAssignee = e.target.value}>
              <option value="">Select user...</option>
              {users.filter(u => u.status === 'active' && u.id !== t.assigneeId).map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Note</label>
            <input className="input" placeholder="Optional handover note" onChange={e => note = e.target.value} />
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
            const newName = users.find(u => u.id === newAssignee)?.name || 'new assignee';
            reassignTask.mutate(
              { id: t.id, assigneeId: newAssignee, note: note || undefined },
              {
                onSuccess: () => {
                  createAuditLog.mutate({
                    action: 'REASSIGN',
                    target: t.workflowInstance?.documentId || t.id,
                    detail: `Reassigned from ${prevName} to ${newName}`
                  });
                  addToast('Reassigned to ' + newName, 'success');
                  closeModal();
                },
              },
            );
          }
        }
      ]
    });
  };

  const cols: Column<any>[] = [
    { key: 'title', label: 'Document', render: r => <b>{r.t.workflowInstance?.document?.title || 'Unknown document'}</b> },
    { key: 'stage', label: 'Stuck at stage' },
    { key: 'assignee', label: 'Assignee', render: r => <span>{r.t.assignee?.name || r.t.assignedRole?.name || 'Unassigned'}</span> },
    { key: 'ageDays', label: 'Age', sortable: true, render: r => <span style={r.ageDays > 7 ? { color: 'var(--status-overdue)', fontWeight: 800 } : {}}>{r.ageDays}d</span> },
    { key: 'status', label: 'Status', render: r => <StatusBadge status={r.overdue ? 'Overdue' : 'Pending'} /> },
    { key: 'act', label: '', render: r => <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleReassign(r.t); }}>Reassign</button> },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Bottlenecks & Ageing</div>
          <div className="page-sub">Where files are stuck, and which have breached SLA.</div>
        </div>
      </div>

      {breaches.length > 0 ? (
        <div className="banner error">
          <span dangerouslySetInnerHTML={{ __html: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>` }} style={{ marginRight: '8px' }} />
          <b>{breaches.length} SLA breach{breaches.length > 1 ? 'es' : ''}</b> — escalations have been sent. Oldest: “{(breaches[0].t.workflowInstance?.document?.title || '').slice(0, 48)}…”
        </div>
      ) : (
        <div className="banner success">No active SLA breaches. Nice.</div>
      )}

      <div className="grid cols-2 mb16">
        <div className="card">
          <div className="card-head">
            <span className="h3">Ageing distribution (open items)</span>
          </div>
          <div className="card-body">
            <HBarChart items={buckets} />
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <span className="h3">Open items by workflow stage</span>
          </div>
          <div className="card-body">
            <HBarChart items={stageItems} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">Ageing detail — oldest first</span>
        </div>
        <Table
          cols={cols}
          rows={aged}
          onRow={(r) => {
            const docId = r.t.workflowInstance?.documentId || r.t.workflowInstance?.document?.id;
            if (docId) router.push(`/doc/${docId}`);
          }}
        />
      </div>
    </div>
  );
}
