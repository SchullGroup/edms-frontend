'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, userById, effStatus } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { HBarChart } from '@/components/ui/Charts';
import { Table, Column } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icons';
import { StatusBadge } from '@/components/ui/Badges';

export default function BottlenecksPage() {
  const router = useRouter();
  const { documents, users, session, auditAction, updateDocument } = useStore();
  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();

  useEffect(() => {
    setPageTitle('Bottlenecks & Ageing');
  }, [setPageTitle]);

  const teamDocs = documents; // mock team docs
  const open = teamDocs.filter(d => d.status !== 'Closed');
  const aged = open.map(d => ({
    d,
    ageDays: Math.floor((Date.now() - d.created) / 86400000),
    stage: (d.workflow.find((s: any) => s.state === 'current') || {}).name || '—',
    overdue: effStatus(d) === 'Overdue'
  })).sort((a, b) => b.ageDays - a.ageDays);

  const breaches = aged.filter(a => a.overdue);

  const buckets = [
    { label: '0–3 days', value: aged.filter(a => a.ageDays <= 3).length, color: 'var(--status-closed)' },
    { label: '4–7 days', value: aged.filter(a => a.ageDays > 3 && a.ageDays <= 7).length, color: 'var(--status-pending)' },
    { label: '8–14 days', value: aged.filter(a => a.ageDays > 7 && a.ageDays <= 14).length, color: 'var(--brand-accent)' },
    { label: '15+ days', value: aged.filter(a => a.ageDays > 14).length, color: 'var(--status-overdue)' }
  ];

  const byStage: Record<string, number> = {};
  aged.forEach(a => { byStage[a.stage] = (byStage[a.stage] || 0) + 1; });
  const stageItems = Object.entries(byStage).map(([label, value]) => ({ label, value, color: 'var(--brand-primary-light)' }));

  const handleReassign = (d: any) => {
    let newAssignee = '';
    let note = '';
    openModal({
      title: `Reassign — ${d.title.slice(0, 44)}${d.title.length > 44 ? '…' : ''}`,
      body: (
        <div>
          <div className="field">
            <label>Current assignee</label>
            <input className="input" disabled value={userById(users, d.assignee)?.name || ''} />
          </div>
          <div className="field">
            <label>New assignee</label>
            <select className="input" onChange={e => newAssignee = e.target.value}>
              <option value="">Select user...</option>
              {users.filter(u => u.status === 'Active' && u.id !== d.assignee).map(u => (
                <option key={u.id} value={u.id}>{u.name} — {u.roleLabel}</option>
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
            const prev = d.assignee;
            updateDocument(d.id, { assignee: newAssignee });
            const me = userById(users, session || '');
            const name = userById(users, newAssignee)?.name;
            auditAction('REASSIGN', d.id, `Reassigned from ${userById(users, prev)?.name} to ${name}`);
            addToast('Document reassigned to ' + name, 'success');
            closeModal();
          }
        }
      ]
    });
  };

  const cols: Column<any>[] = [
    { key: 'title', label: 'Document', render: r => <b>{r.d.title}</b> },
    { key: 'stage', label: 'Stuck at stage' },
    { key: 'assignee', label: 'Assignee', render: r => <span>{userById(users, r.d.assignee)?.name}</span> },
    { key: 'ageDays', label: 'Age', sortable: true, render: r => <span style={r.ageDays > 7 ? { color: 'var(--status-overdue)', fontWeight: 800 } : {}}>{r.ageDays}d</span> },
    { key: 'status', label: 'Status', render: r => <StatusBadge status={effStatus(r.d)} /> },
    { key: 'act', label: '', render: r => <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleReassign(r.d); }}>Reassign</button> },
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
          <b>{breaches.length} SLA breach{breaches.length > 1 ? 'es' : ''}</b> — escalations have been sent. Oldest: “{breaches[0].d.title.slice(0, 48)}…”
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
        <Table cols={cols} rows={aged} onRow={(r) => router.push(`/doc/${r.d.id}`)} />
      </div>
    </div>
  );
}
